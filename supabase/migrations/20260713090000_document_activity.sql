-- Historial de actividad auditable de las Escrituras.
--
-- Decisiones:
-- * Los eventos derivados de mutaciones de `documents` se escriben mediante un
--   trigger `AFTER INSERT/UPDATE` en la MISMA transacción que la operación
--   principal: si el cambio de estado/cliente/título/contenido se revierte,
--   el evento también. No hay una "segunda llamada" independiente.
-- * El trigger es SECURITY DEFINER (se ejecuta como el dueño de la función)
--   para poder escribir en `document_activity`, que no expone política INSERT
--   a los usuarios: nada se puede insertar arbitrariamente desde el navegador.
-- * La identidad del actor se deriva server-side de `auth.uid()` (nunca del
--   cliente); cae a `owner_id` si la sesión no expone el claim.
-- * El evento "Documento Word generado" no es una mutación de `documents`, así
--   que se registra con un RPC SECURITY DEFINER que valida ownership.
-- * Los eventos son inmutables: no hay políticas UPDATE ni DELETE.
-- * `ON DELETE CASCADE` desde documents: las Escrituras se eliminan
--   físicamente hoy, así que la auditoría se elimina con su Escritura (no hay
--   registro huérfano). Se documenta como decisión explícita del MVP.

create table public.document_activity (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  event_type text not null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  -- clock_timestamp() (no now()) para que varios eventos de una misma
  -- transacción/guardado conserven su orden real de inserción; el desempate
  -- por id mantiene la consulta estable ante empates.
  created_at timestamptz not null default clock_timestamp(),
  constraint document_activity_document_owner_fk
    foreign key (document_id, owner_id)
    references public.documents(id, owner_id)
    on delete cascade,
  constraint document_activity_metadata_is_object check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint document_activity_event_type_not_blank check (
    btrim(event_type) <> ''
  )
);

comment on table public.document_activity is
  'Historial de actividad de solo lectura por Escritura. Escrito solo por trigger/RPC SECURITY DEFINER; inmutable (sin UPDATE/DELETE). Base reutilizable para eventos futuros de otros módulos.';

-- Orden de consulta (created_at desc con desempate estable por id).
create index document_activity_document_created_idx
  on public.document_activity (document_id, created_at desc, id desc);
create index document_activity_owner_created_idx
  on public.document_activity (owner_id, created_at desc);

-- ------------------------------------------------------------------ trigger

create or replace function public.record_document_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.owner_id, old.owner_id);
  v_prev_client_name text;
  v_new_client_name text;
begin
  if (tg_op = 'INSERT') then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values
      (new.id, new.owner_id, v_actor, 'document_created', 'Escritura creada',
       '{}'::jsonb);
    return new;
  end if;

  -- UPDATE: un evento por cada cambio real (comparación IS DISTINCT FROM),
  -- de modo que un guardado sin cambios no genere ningún evento.

  if (new.status is distinct from old.status) then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values (
      new.id, new.owner_id, v_actor,
      case
        when new.status = 'final' then 'document_finalized'
        when old.status = 'final' and new.status = 'ready' then 'document_reopened'
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
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values (
      new.id, new.owner_id, v_actor,
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
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values (
      new.id, new.owner_id, v_actor, 'document_title_changed',
      'Título actualizado',
      jsonb_build_object('previousTitle', old.title, 'newTitle', new.title)
    );
  end if;

  if (new.field_values is distinct from old.field_values
      or new.rendered_content is distinct from old.rendered_content) then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values (
      new.id, new.owner_id, v_actor, 'document_content_updated',
      'Contenido de la escritura actualizado', '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

create trigger documents_record_activity
after insert or update on public.documents
for each row execute function public.record_document_activity();

revoke all on function public.record_document_activity() from public, anon, authenticated;

-- ------------------------------------------------------------------ word rpc

create or replace function public.log_document_word_generated(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  -- Solo el dueño registra el evento de su documento; no revela existencia.
  select owner_id into v_owner
    from public.documents
   where id = p_document_id and owner_id = auth.uid();

  if v_owner is null then
    return;
  end if;

  insert into public.document_activity
    (document_id, owner_id, actor_user_id, event_type, summary, metadata)
  values
    (p_document_id, v_owner, auth.uid(), 'document_word_generated',
     'Documento Word generado', '{}'::jsonb);
end;
$$;

revoke all on function public.log_document_word_generated(uuid) from public, anon;
grant execute on function public.log_document_word_generated(uuid) to authenticated;

-- ------------------------------------------------------------------ rls

alter table public.document_activity enable row level security;

-- Solo lectura de la propia actividad. Sin políticas de INSERT/UPDATE/DELETE:
-- la escritura ocurre exclusivamente vía trigger/RPC SECURITY DEFINER.
create policy "document_activity_select_own"
on public.document_activity
for select
to authenticated
using (owner_id = auth.uid());
