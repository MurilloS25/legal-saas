-- Iteración 6 — Identidad notarial y auditoría de actores.
--
-- Objetivo de esta migración: que cada fila de auditoría (document_activity,
-- receivable_activity, workspace_activity, notarial_index_exports) registre
-- QUIÉN hizo la acción de forma histórica — nombre y rol al momento del
-- hecho — en vez de depender de una resolución en vivo contra auth.users/
-- workspace_members que mostraría el nombre o rol ACTUAL de esa persona
-- (o nada, si ya no es miembro). Antes de esto, la UI solo podía mostrar
-- "Tú" vs "Otro miembro del equipo" (ver comentario en
-- src/features/documents/server/activity-queries.ts) porque no había
-- ningún dato de identidad snapshotteado — este es exactamente el trabajo
-- que ese comentario marcaba como pendiente para la Iteración 6.
--
-- No existe una tabla de "nombre por usuario" en este esquema — cada
-- usuario se identifica solo por su email (auth.users.email);
-- lawyer_profiles es la identidad NOTARIAL compartida del Workspace, no un
-- perfil por persona. Por eso el snapshot de nombre usa el email del actor:
-- es el único identificador estable disponible por persona.

-- ============================================================== columnas

alter table public.document_activity
  add column actor_name_snapshot text,
  add column actor_role_snapshot text;

alter table public.receivable_activity
  add column actor_name_snapshot text,
  add column actor_role_snapshot text;

alter table public.workspace_activity
  add column actor_name_snapshot text,
  add column actor_role_snapshot text;

alter table public.notarial_index_exports
  add column actor_name_snapshot text,
  add column actor_role_snapshot text;

-- ============================================================== resolver

-- Único punto de verdad para "¿cómo se llama y qué rol tiene este actor,
-- ahora mismo, en este Workspace?" — se llama en el momento en que ocurre
-- cada evento de auditoría, y el resultado se persiste (nunca se vuelve a
-- resolver en lectura). 'desconocido' es el fallback defensivo si el
-- usuario ya no existe en auth.users o no tiene ninguna fila en
-- workspace_members para ese Workspace — no debería ocurrir en operación
-- normal, pero una función de auditoría nunca debe fallar por esto.
create or replace function public.resolve_actor_snapshot(
  p_workspace_id uuid,
  p_actor_user_id uuid,
  out actor_name text,
  out actor_role text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    coalesce((select u.email from auth.users u where u.id = p_actor_user_id), 'desconocido'),
    coalesce(
      (select m.role from public.workspace_members m
        where m.workspace_id = p_workspace_id and m.user_id = p_actor_user_id
        order by (m.status = 'active') desc, m.created_at desc
        limit 1),
      'desconocido'
    );
$$;

revoke all on function public.resolve_actor_snapshot(uuid, uuid) from public, anon;
grant execute on function public.resolve_actor_snapshot(uuid, uuid) to authenticated;

-- ============================================================== backfill

-- Mejor esfuerzo para filas ya existentes (anteriores a esta iteración):
-- usa el estado ACTUAL de auth.users/workspace_members, que no
-- necesariamente coincide con el estado real en el momento histórico del
-- evento — es la única aproximación posible sin haber guardado el dato
-- entonces. Todo evento escrito DESDE esta migración en adelante sí queda
-- fijado correctamente para siempre.
-- Nota: no se puede usar `update ... from function(tabla.col)` porque
-- Postgres no deja que el FROM de un UPDATE vea el alias de la tabla que se
-- está actualizando dentro de una llamada a función sin LATERAL explícito
-- (y UPDATE...FROM no admite LATERAL) — de ahí las subconsultas
-- correlacionadas en el SET en vez de un FROM.
update public.document_activity da
   set actor_name_snapshot = (select actor_name from public.resolve_actor_snapshot(da.workspace_id, da.actor_user_id)),
       actor_role_snapshot = (select actor_role from public.resolve_actor_snapshot(da.workspace_id, da.actor_user_id))
 where da.actor_name_snapshot is null;

update public.receivable_activity ra
   set actor_name_snapshot = (select actor_name from public.resolve_actor_snapshot(ra.workspace_id, ra.actor_user_id)),
       actor_role_snapshot = (select actor_role from public.resolve_actor_snapshot(ra.workspace_id, ra.actor_user_id))
 where ra.actor_name_snapshot is null;

update public.workspace_activity wa
   set actor_name_snapshot = (select actor_name from public.resolve_actor_snapshot(wa.workspace_id, wa.actor_user_id)),
       actor_role_snapshot = (select actor_role from public.resolve_actor_snapshot(wa.workspace_id, wa.actor_user_id))
 where wa.actor_name_snapshot is null;

update public.notarial_index_exports nie
   set actor_name_snapshot = (select actor_name from public.resolve_actor_snapshot(nie.workspace_id, nie.owner_id)),
       actor_role_snapshot = (select actor_role from public.resolve_actor_snapshot(nie.workspace_id, nie.owner_id))
 where nie.actor_name_snapshot is null;

alter table public.document_activity
  alter column actor_name_snapshot set not null,
  alter column actor_role_snapshot set not null;

alter table public.receivable_activity
  alter column actor_name_snapshot set not null,
  alter column actor_role_snapshot set not null;

alter table public.workspace_activity
  alter column actor_name_snapshot set not null,
  alter column actor_role_snapshot set not null;

alter table public.notarial_index_exports
  alter column actor_name_snapshot set not null,
  alter column actor_role_snapshot set not null;

-- ==================================================== document_activity

create or replace function public.record_document_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.owner_id, old.owner_id);
  v_actor_name text;
  v_actor_role text;
  v_prev_client_name text;
  v_new_client_name text;
begin
  select actor_name, actor_role into v_actor_name, v_actor_role
    from public.resolve_actor_snapshot(new.workspace_id, v_actor);

  if (tg_op = 'INSERT') then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, summary, metadata)
    values
      (new.id, new.owner_id, v_actor, v_actor_name, v_actor_role, 'document_created', 'Escritura creada',
       '{}'::jsonb);
    return new;
  end if;

  if (new.status is distinct from old.status) then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, summary, metadata)
    values (
      new.id, new.owner_id, v_actor, v_actor_name, v_actor_role,
      case
        when new.status = 'final' then 'document_finalized'
        when old.status = 'final' and new.status in ('draft', 'ready')
          then 'document_reopened'
        else 'document_status_changed'
      end,
      'Estado actualizado',
      jsonb_build_object('previousStatus', old.status, 'newStatus', new.status)
    );
  end if;

  if (new.client_id is distinct from old.client_id) then
    select full_name into v_prev_client_name
      from public.clients where id = old.client_id;
    select full_name into v_new_client_name
      from public.clients where id = new.client_id;

    insert into public.document_activity
      (document_id, owner_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, summary, metadata)
    values (
      new.id, new.owner_id, v_actor, v_actor_name, v_actor_role,
      case
        when old.client_id is null then 'document_client_assigned'
        when new.client_id is null then 'document_client_removed'
        else 'document_client_changed'
      end,
      'Cliente actualizado',
      jsonb_strip_nulls(jsonb_build_object(
        'previousClientId', old.client_id,
        'previousClientName', v_prev_client_name,
        'newClientId', new.client_id,
        'newClientName', v_new_client_name
      ))
    );
  end if;

  if (new.title is distinct from old.title) then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, summary, metadata)
    values (
      new.id, new.owner_id, v_actor, v_actor_name, v_actor_role, 'document_title_changed',
      'Título actualizado',
      jsonb_build_object('previousTitle', old.title, 'newTitle', new.title)
    );
  end if;

  if (new.field_values is distinct from old.field_values
      or new.rendered_content is distinct from old.rendered_content) then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, summary, metadata)
    values (
      new.id, new.owner_id, v_actor, v_actor_name, v_actor_role, 'document_content_updated',
      'Contenido de la escritura actualizado', '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

create or replace function public.record_notarial_metadata_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_actor_role text;
  v_changed text[] := array[]::text[];
  v_was_complete boolean;
  v_is_complete boolean;
begin
  if v_actor is null or not public.is_workspace_member(new.workspace_id, array['propietario', 'administrador', 'asistente']) then
    raise exception 'authenticated workspace member required'
      using errcode = 'insufficient_privilege';
  end if;

  select actor_name, actor_role into v_actor_name, v_actor_role
    from public.resolve_actor_snapshot(new.workspace_id, v_actor);

  v_is_complete :=
    new.instrument_number is not null
    and new.authorized_at is not null
    and coalesce(btrim(new.protocol_book), '') <> ''
    and coalesce(btrim(new.initial_folio), '') <> ''
    and coalesce(btrim(new.final_folio), '') <> ''
    and coalesce(btrim(coalesce(new.act_name_override, new.act_name_snapshot)), '') <> ''
    and coalesce(btrim(coalesce(new.parties_override, new.generated_parties)), '') <> '';

  if tg_op = 'INSERT' then
    insert into public.document_activity
      (document_id, owner_id, workspace_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, summary, metadata)
    values (new.document_id, new.owner_id, new.workspace_id, v_actor, v_actor_name, v_actor_role, 'notarial_metadata_created',
            'Datos para índice creados', '{}'::jsonb);
    if v_is_complete then
      insert into public.document_activity
        (document_id, owner_id, workspace_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, summary, metadata)
      values (new.document_id, new.owner_id, new.workspace_id, v_actor, v_actor_name, v_actor_role,
              'notarial_metadata_completed', 'Datos para índice completos', '{}'::jsonb);
    end if;
    return new;
  end if;

  if new.instrument_number is distinct from old.instrument_number then v_changed := array_append(v_changed, 'instrument_number'); end if;
  if new.authorized_at is distinct from old.authorized_at then v_changed := array_append(v_changed, 'authorized_at'); end if;
  if new.protocol_book is distinct from old.protocol_book then v_changed := array_append(v_changed, 'protocol_book'); end if;
  if new.initial_folio is distinct from old.initial_folio then v_changed := array_append(v_changed, 'initial_folio'); end if;
  if new.final_folio is distinct from old.final_folio then v_changed := array_append(v_changed, 'final_folio'); end if;
  if new.act_name_snapshot is distinct from old.act_name_snapshot then v_changed := array_append(v_changed, 'act_name_snapshot'); end if;
  if new.act_name_override is distinct from old.act_name_override then v_changed := array_append(v_changed, 'act_name_override'); end if;
  if new.generated_parties is distinct from old.generated_parties then v_changed := array_append(v_changed, 'generated_parties'); end if;
  if new.parties_override is distinct from old.parties_override then v_changed := array_append(v_changed, 'parties_override'); end if;
  if new.notes is distinct from old.notes then v_changed := array_append(v_changed, 'notes'); end if;
  if array_length(v_changed, 1) is null then return new; end if;

  insert into public.document_activity
    (document_id, owner_id, workspace_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, summary, metadata)
  values (new.document_id, new.owner_id, new.workspace_id, v_actor, v_actor_name, v_actor_role, 'notarial_metadata_updated',
          'Datos para índice actualizados',
          pg_catalog.jsonb_build_object('changedFields', pg_catalog.to_jsonb(v_changed)));

  v_was_complete :=
    old.instrument_number is not null
    and old.authorized_at is not null
    and coalesce(btrim(old.protocol_book), '') <> ''
    and coalesce(btrim(old.initial_folio), '') <> ''
    and coalesce(btrim(old.final_folio), '') <> ''
    and coalesce(btrim(coalesce(old.act_name_override, old.act_name_snapshot)), '') <> ''
    and coalesce(btrim(coalesce(old.parties_override, old.generated_parties)), '') <> '';

  if v_is_complete and not v_was_complete then
    insert into public.document_activity
      (document_id, owner_id, workspace_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, summary, metadata)
    values (new.document_id, new.owner_id, new.workspace_id, v_actor, v_actor_name, v_actor_role,
            'notarial_metadata_completed', 'Datos para índice completos', '{}'::jsonb);
  elsif v_was_complete and not v_is_complete then
    insert into public.document_activity
      (document_id, owner_id, workspace_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, summary, metadata)
    values (new.document_id, new.owner_id, new.workspace_id, v_actor, v_actor_name, v_actor_role,
            'notarial_metadata_marked_incomplete',
            'Datos para índice marcados como incompletos', '{}'::jsonb);
  end if;

  return new;
end;
$$;

create or replace function public.log_document_word_generated(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_actor_name text;
  v_actor_role text;
begin
  select * into v_doc from public.documents where id = p_document_id;
  if not found then
    return;
  end if;
  if not public.is_workspace_member(v_doc.workspace_id, array['propietario', 'administrador', 'asistente']) then
    return;
  end if;

  select actor_name, actor_role into v_actor_name, v_actor_role
    from public.resolve_actor_snapshot(v_doc.workspace_id, auth.uid());

  insert into public.document_activity
    (document_id, owner_id, workspace_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, summary, metadata)
  values
    (p_document_id, auth.uid(), v_doc.workspace_id, auth.uid(), v_actor_name, v_actor_role, 'document_word_generated',
     'Documento Word generado', '{}'::jsonb);
end;
$$;

-- ==================================================== receivable_activity

create or replace function public.record_receivable_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.owner_id);
  v_actor_name text;
  v_actor_role text;
begin
  select actor_name, actor_role into v_actor_name, v_actor_role
    from public.resolve_actor_snapshot(new.workspace_id, v_actor);

  if (tg_op = 'INSERT') then
    insert into public.receivable_activity
      (receivable_id, owner_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
    values (new.id, new.owner_id, v_actor, v_actor_name, v_actor_role, 'receivable_created', '{}'::jsonb);
    return new;
  end if;

  -- Cambio de cliente (registrado o nombre libre).
  if (new.client_id is distinct from old.client_id
      or new.client_name_snapshot is distinct from old.client_name_snapshot) then
    insert into public.receivable_activity
      (receivable_id, owner_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
    values (new.id, new.owner_id, v_actor, v_actor_name, v_actor_role, 'receivable_client_changed', '{}'::jsonb);
  end if;

  -- Enlace / desenlace de Escritura.
  if (new.document_id is distinct from old.document_id) then
    if (old.document_id is null) then
      insert into public.receivable_activity
        (receivable_id, owner_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
      values (new.id, new.owner_id, v_actor, v_actor_name, v_actor_role, 'receivable_document_linked', '{}'::jsonb);
    elsif (new.document_id is null) then
      insert into public.receivable_activity
        (receivable_id, owner_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
      values (new.id, new.owner_id, v_actor, v_actor_name, v_actor_role, 'receivable_document_unlinked', '{}'::jsonb);
    else
      insert into public.receivable_activity
        (receivable_id, owner_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
      values (new.id, new.owner_id, v_actor, v_actor_name, v_actor_role, 'receivable_document_linked', '{}'::jsonb);
    end if;
  end if;

  -- Cambio de monto.
  if (new.amount_total is distinct from old.amount_total) then
    insert into public.receivable_activity
      (receivable_id, owner_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
    values (new.id, new.owner_id, v_actor, v_actor_name, v_actor_role, 'receivable_amount_changed',
      jsonb_build_object('previous', old.amount_total, 'new', new.amount_total));
  end if;

  -- Cambio de vencimiento.
  if (new.due_at is distinct from old.due_at) then
    insert into public.receivable_activity
      (receivable_id, owner_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
    values (new.id, new.owner_id, v_actor, v_actor_name, v_actor_role, 'receivable_due_date_changed', '{}'::jsonb);
  end if;

  -- Otros cambios editables (concepto/notas): un único evento genérico.
  if (new.concept is distinct from old.concept
      or new.notes is distinct from old.notes
      or new.currency is distinct from old.currency
      or new.issued_at is distinct from old.issued_at) then
    insert into public.receivable_activity
      (receivable_id, owner_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
    values (new.id, new.owner_id, v_actor, v_actor_name, v_actor_role, 'receivable_updated', '{}'::jsonb);
  end if;

  return new;
end;
$$;

create or replace function public.register_receivable_payment(
  p_receivable_id uuid,
  p_amount numeric,
  p_paid_at date,
  p_method text,
  p_reference text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_rec public.receivables%rowtype;
  v_paid numeric(14, 2);
  v_amount numeric(14, 2);
  v_payment_id uuid;
  v_actor_name text;
  v_actor_role text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_rec
    from public.receivables
   where id = p_receivable_id
   for update;

  if not found then
    raise exception 'receivable not found' using errcode = 'P0002';
  end if;

  if not public.is_workspace_member(v_rec.workspace_id, array['propietario', 'administrador', 'asistente']) then
    raise exception 'workspace membership required' using errcode = '28000';
  end if;

  v_amount := round(p_amount, 2);
  if v_amount is null or v_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22003';
  end if;
  if p_method is null
     or p_method not in ('cash', 'bank_transfer', 'sinpe', 'card', 'other') then
    raise exception 'invalid method' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into v_paid
    from public.receivable_payments
   where receivable_id = p_receivable_id and status = 'active';

  if v_paid + v_amount > v_rec.amount_total then
    raise exception 'payment exceeds balance' using errcode = '23514';
  end if;

  select actor_name, actor_role into v_actor_name, v_actor_role
    from public.resolve_actor_snapshot(v_rec.workspace_id, v_uid);

  insert into public.receivable_payments
    (receivable_id, owner_id, workspace_id, amount, currency, paid_at, method, reference)
  values (
    p_receivable_id, v_uid, v_rec.workspace_id, v_amount, v_rec.currency,
    coalesce(p_paid_at, (now() at time zone 'America/Costa_Rica')::date),
    p_method, nullif(btrim(p_reference), '')
  )
  returning id into v_payment_id;

  insert into public.receivable_activity
    (receivable_id, owner_id, workspace_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
  values (p_receivable_id, v_uid, v_rec.workspace_id, v_uid, v_actor_name, v_actor_role, 'payment_registered',
    jsonb_build_object('amount', v_amount, 'payment_id', v_payment_id));

  if v_paid + v_amount >= v_rec.amount_total then
    insert into public.receivable_activity
      (receivable_id, owner_id, workspace_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
    values (p_receivable_id, v_uid, v_rec.workspace_id, v_uid, v_actor_name, v_actor_role, 'receivable_paid', '{}'::jsonb);
  end if;

  return v_payment_id;
end;
$$;

create or replace function public.void_receivable_payment(
  p_payment_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_rec public.receivables%rowtype;
  v_payment public.receivable_payments%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_was_paid boolean;
  v_paid_after numeric(14, 2);
  v_actor_name text;
  v_actor_role text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_payment
    from public.receivable_payments
   where id = p_payment_id;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;

  if not public.is_workspace_member(v_payment.workspace_id, array['propietario', 'administrador']) then
    raise exception 'workspace membership required' using errcode = '28000';
  end if;
  if v_reason is null then
    raise exception 'void reason is required' using errcode = '22023';
  end if;

  select * into v_rec
    from public.receivables
   where id = v_payment.receivable_id
   for update;

  select * into v_payment
    from public.receivable_payments
   where id = p_payment_id
   for update;

  if v_payment.status = 'voided' then
    raise exception 'payment already voided' using errcode = '23514';
  end if;

  select coalesce(sum(amount), 0) >= v_rec.amount_total into v_was_paid
    from public.receivable_payments
   where receivable_id = v_rec.id and status = 'active';

  update public.receivable_payments
     set status = 'voided',
         voided_at = now(),
         void_reason = v_reason,
         voided_by = v_uid
   where id = p_payment_id;

  select actor_name, actor_role into v_actor_name, v_actor_role
    from public.resolve_actor_snapshot(v_rec.workspace_id, v_uid);

  insert into public.receivable_activity
    (receivable_id, owner_id, workspace_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
  values (v_rec.id, v_uid, v_rec.workspace_id, v_uid, v_actor_name, v_actor_role, 'payment_voided',
    jsonb_build_object('amount', v_payment.amount, 'payment_id', p_payment_id));

  select coalesce(sum(amount), 0) into v_paid_after
    from public.receivable_payments
   where receivable_id = v_rec.id and status = 'active';

  if v_was_paid and v_paid_after < v_rec.amount_total then
    insert into public.receivable_activity
      (receivable_id, owner_id, workspace_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
    values (v_rec.id, v_uid, v_rec.workspace_id, v_uid, v_actor_name, v_actor_role, 'receivable_reopened_after_void', '{}'::jsonb);
  end if;
end;
$$;

-- ==================================================== notarial_index_exports

create or replace function public.log_notarial_index_export(
  p_format text,
  p_from date,
  p_to date,
  p_row_count integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_workspace_id uuid;
  v_actor_name text;
  v_actor_role text;
begin
  if auth.uid() is null then
    return;
  end if;

  select workspace_id into v_workspace_id
    from public.workspace_members
   where user_id = auth.uid() and status = 'active'
   limit 1;

  if v_workspace_id is null
    or not public.is_workspace_member(v_workspace_id, array['propietario', 'administrador']) then
    return;
  end if;
  if p_format is null or p_format not in ('docx') then
    return;
  end if;

  select actor_name, actor_role into v_actor_name, v_actor_role
    from public.resolve_actor_snapshot(v_workspace_id, auth.uid());

  insert into public.notarial_index_exports
    (owner_id, workspace_id, format, from_date, to_date, row_count, actor_name_snapshot, actor_role_snapshot)
  values (
    auth.uid(), v_workspace_id, p_format, p_from, p_to, greatest(coalesce(p_row_count, 0), 0),
    v_actor_name, v_actor_role
  );
end;
$$;

-- ==================================================== workspace_activity

create or replace function public.invite_workspace_member(
  p_user_id uuid,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_workspace_id uuid;
  v_caller_role text;
  v_member_id uuid;
  v_actor_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_role not in ('administrador', 'asistente', 'solo_lectura') then
    raise exception 'invalid role for invitation' using errcode = '22023';
  end if;

  select workspace_id, role into v_workspace_id, v_caller_role
    from public.workspace_members
   where user_id = v_uid and status = 'active'
   limit 1;

  if v_workspace_id is null or v_caller_role not in ('propietario', 'administrador') then
    raise exception 'workspace membership required' using errcode = '28000';
  end if;
  if v_caller_role = 'administrador' and p_role = 'administrador' then
    raise exception 'administrador cannot invite another administrador' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.workspace_members
    where workspace_id = v_workspace_id and user_id = p_user_id
  ) then
    raise exception 'user is already a member of this workspace' using errcode = '23505';
  end if;

  select (select email from auth.users where id = v_uid) into v_actor_name;

  insert into public.workspace_members (workspace_id, user_id, role, status, invited_by)
  values (v_workspace_id, p_user_id, p_role, 'invited', v_uid)
  returning id into v_member_id;

  insert into public.workspace_activity (workspace_id, actor_user_id, target_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
  values (v_workspace_id, v_uid, p_user_id, coalesce(v_actor_name, 'desconocido'), v_caller_role, 'member_invited', jsonb_build_object('role', p_role));

  return v_member_id;
end;
$$;

create or replace function public.accept_workspace_invitation(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor_name text;
  v_actor_role text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.workspace_members
     set status = 'active'
   where workspace_id = p_workspace_id
     and user_id = v_uid
     and status = 'invited';

  if not found then
    raise exception 'no pending invitation found' using errcode = 'P0002';
  end if;

  select actor_name, actor_role into v_actor_name, v_actor_role
    from public.resolve_actor_snapshot(p_workspace_id, v_uid);

  insert into public.workspace_activity (workspace_id, actor_user_id, target_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
  values (p_workspace_id, v_uid, v_uid, v_actor_name, v_actor_role, 'member_invitation_accepted', '{}'::jsonb);

  if p_workspace_id <> v_uid then
    delete from public.workspace_members where workspace_id = v_uid and user_id = v_uid;
  end if;
end;
$$;

create or replace function public.change_workspace_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
  v_actor_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_role not in ('administrador', 'asistente', 'solo_lectura') then
    raise exception 'invalid role' using errcode = '22023';
  end if;

  select role into v_caller_role
    from public.workspace_members
   where workspace_id = p_workspace_id and user_id = v_uid and status = 'active';
  if v_caller_role is null or v_caller_role not in ('propietario', 'administrador') then
    raise exception 'workspace membership required' using errcode = '28000';
  end if;

  select role into v_target_role
    from public.workspace_members
   where workspace_id = p_workspace_id and user_id = p_user_id;
  if v_target_role is null then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  perform public.assert_can_manage_target_member(v_caller_role, v_target_role);

  update public.workspace_members
     set role = p_role
   where workspace_id = p_workspace_id and user_id = p_user_id;

  select (select email from auth.users where id = v_uid) into v_actor_name;

  insert into public.workspace_activity (workspace_id, actor_user_id, target_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
  values (p_workspace_id, v_uid, p_user_id, coalesce(v_actor_name, 'desconocido'), v_caller_role, 'member_role_changed',
    jsonb_build_object('previousRole', v_target_role, 'newRole', p_role));
end;
$$;

create or replace function public.suspend_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
  v_actor_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select role into v_caller_role
    from public.workspace_members
   where workspace_id = p_workspace_id and user_id = v_uid and status = 'active';
  if v_caller_role is null or v_caller_role not in ('propietario', 'administrador') then
    raise exception 'workspace membership required' using errcode = '28000';
  end if;

  select role into v_target_role
    from public.workspace_members
   where workspace_id = p_workspace_id and user_id = p_user_id;
  if v_target_role is null then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  perform public.assert_can_manage_target_member(v_caller_role, v_target_role);

  update public.workspace_members
     set status = 'revoked'
   where workspace_id = p_workspace_id and user_id = p_user_id;

  select (select email from auth.users where id = v_uid) into v_actor_name;

  insert into public.workspace_activity (workspace_id, actor_user_id, target_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
  values (p_workspace_id, v_uid, p_user_id, coalesce(v_actor_name, 'desconocido'), v_caller_role, 'member_suspended', '{}'::jsonb);
end;
$$;

create or replace function public.reactivate_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
  v_actor_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select role into v_caller_role
    from public.workspace_members
   where workspace_id = p_workspace_id and user_id = v_uid and status = 'active';
  if v_caller_role is null or v_caller_role not in ('propietario', 'administrador') then
    raise exception 'workspace membership required' using errcode = '28000';
  end if;

  select role into v_target_role
    from public.workspace_members
   where workspace_id = p_workspace_id and user_id = p_user_id;
  if v_target_role is null then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  perform public.assert_can_manage_target_member(v_caller_role, v_target_role);

  update public.workspace_members
     set status = 'active'
   where workspace_id = p_workspace_id and user_id = p_user_id;

  select (select email from auth.users where id = v_uid) into v_actor_name;

  insert into public.workspace_activity (workspace_id, actor_user_id, target_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
  values (p_workspace_id, v_uid, p_user_id, coalesce(v_actor_name, 'desconocido'), v_caller_role, 'member_reactivated', '{}'::jsonb);
end;
$$;

-- remove_workspace_member: el snapshot del actor (quien remueve) se toma
-- ANTES del delete, igual que ya hacía este RPC con el registro de
-- auditoría en general — el removido puede ser el propio actor en teoría,
-- pero nunca lo es en la práctica (assert_can_manage_target_member ya lo
-- impide vía la inmutabilidad de propietario/no-gestión de pares).
create or replace function public.remove_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
  v_actor_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select role into v_caller_role
    from public.workspace_members
   where workspace_id = p_workspace_id and user_id = v_uid and status = 'active';
  if v_caller_role is null or v_caller_role not in ('propietario', 'administrador') then
    raise exception 'workspace membership required' using errcode = '28000';
  end if;

  select role into v_target_role
    from public.workspace_members
   where workspace_id = p_workspace_id and user_id = p_user_id;
  if v_target_role is null then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  perform public.assert_can_manage_target_member(v_caller_role, v_target_role);

  select (select email from auth.users where id = v_uid) into v_actor_name;

  insert into public.workspace_activity (workspace_id, actor_user_id, target_user_id, actor_name_snapshot, actor_role_snapshot, event_type, metadata)
  values (p_workspace_id, v_uid, p_user_id, coalesce(v_actor_name, 'desconocido'), v_caller_role, 'member_removed', jsonb_build_object('previousRole', v_target_role));

  delete from public.workspace_members
   where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$;

-- ============================================= list_workspace_activity

-- Antes de esta iteración, workspace_activity se escribía pero NUNCA se
-- leía desde ningún lugar de la app — "Mi equipo" no tenía ninguna vista
-- de historial. Este RPC es lo que la alimenta: acota al Workspace activo
-- del caller (igual que list_workspace_members) y resuelve el email
-- ACTUAL del target solo como etiqueta de conveniencia para la UI (no es
-- un snapshot histórico — a diferencia de actor_name_snapshot/
-- actor_role_snapshot, que sí lo son y son la fuente de verdad de quién
-- hizo la acción).
create or replace function public.list_workspace_activity(p_limit integer default 50)
returns table (
  id uuid,
  event_type text,
  metadata jsonb,
  created_at timestamptz,
  actor_name_snapshot text,
  actor_role_snapshot text,
  target_email text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    wa.id, wa.event_type, wa.metadata, wa.created_at,
    wa.actor_name_snapshot, wa.actor_role_snapshot,
    (select u.email from auth.users u where u.id = wa.target_user_id)
  from public.workspace_activity wa
  where wa.workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
  order by wa.created_at desc
  limit greatest(least(coalesce(p_limit, 50), 200), 1);
$$;

revoke all on function public.list_workspace_activity(integer) from public, anon;
grant execute on function public.list_workspace_activity(integer) to authenticated;
