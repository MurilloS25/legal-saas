-- ================================================ notarial index inclusion
--
-- Hasta ahora `status = 'final'` implicaba automáticamente "pertenece al
-- Índice Notarial" (notarial_index_entries.where d.status = 'final'). El
-- producto necesita distinguir ambas cosas: una Escritura puede finalizarse
-- (queda de solo lectura, con validez de flujo interno) sin que el notario
-- quiera que aparezca en su Índice — p. ej. constancias u otros documentos
-- generados que no corresponden al índice de instrumentos autorizados.
--
-- Representación elegida: columna booleana en `documents`, no en
-- `document_notarial_metadata`. Razones:
--   - Es una decisión sobre la EXISTENCIA de la Escritura en el universo del
--     Índice, no un dato notarial en sí (a diferencia de instrument_number,
--     authorized_at, etc., que sí viven en la fila 1:1 de metadata).
--   - Debe poder fijarse en el momento de finalizar, ANTES de que exista
--     ninguna fila de document_notarial_metadata (ver caso B: final +
--     excluida, sin metadata nunca guardada).
--   - document_notarial_metadata es opcional/lazy (solo existe tras el
--     primer guardado del paso Índice); documents siempre existe.
--
-- Default `true`: preserva exactamente el comportamiento previo (toda
-- Escritura finalizada entraba al Índice) para todas las filas existentes y
-- para el flujo no modificado — nadie pierde visibilidad por este cambio a
-- menos que explícitamente desmarque la casilla al finalizar.

alter table public.documents
  add column include_in_notarial_index boolean not null default true;

comment on column public.documents.include_in_notarial_index is
  'Decisión explícita (no solo status=final) de si la Escritura pertenece al universo del Índice Notarial. Se fija al finalizar (default true, preserva el comportamiento previo) y puede corregirse después desde el paso Índice.';

-- ------------------------------------------------------ permission enforcement
--
-- Misma función/trigger que ya guarda finalizar y reabrir (ver
-- 20260804210000 y 20260807000000) — se extiende en vez de crear una nueva,
-- reutilizando exactamente el mismo conjunto de roles (propietario/
-- administrador) que ya gobierna decisiones de ciclo de vida sensibles del
-- documento. RLS por sí sola no puede distinguir "cambiar el título" de
-- "cambiar la pertenencia al Índice" dentro del mismo UPDATE — de ahí el
-- trigger, igual que para finalizar/reabrir. Se aplica siempre que el valor
-- cambia, sin importar el status resultante, para que la corrección
-- posterior (caso G/H del PR) quede igual de protegida que la decisión
-- inicial al finalizar.
create or replace function public.enforce_document_finalize_permission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if (
    (new.status = 'final' and old.status is distinct from 'final')
    or (old.status = 'final' and new.status is distinct from 'final')
    or (new.include_in_notarial_index is distinct from old.include_in_notarial_index)
  ) then
    if not public.is_workspace_member(new.workspace_id, array['propietario', 'administrador']) then
      raise exception 'finalizing, reopening, or changing notarial index inclusion requires propietario or administrador role'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------------- audit
--
-- Reutiliza document_activity (mismo patrón que status/client_id en
-- record_document_activity) — no se inventa un sistema de auditoría nuevo.
-- Se extiende la definición vigente desde 20260805100000 (actor_name_snapshot/
-- actor_role_snapshot NOT NULL, evento document_title_changed) — NO la
-- versión anterior a esa migración; reemplazarla por una definición más
-- vieja rompería todo insert en document_activity (columnas NOT NULL sin
-- valor) y perdería el evento de título.
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

  if (new.include_in_notarial_index is distinct from old.include_in_notarial_index) then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, summary, metadata)
    values (
      new.id, new.owner_id, v_actor, v_actor_name, v_actor_role,
      'notarial_index_inclusion_changed',
      case
        when new.include_in_notarial_index then 'Incluida en el Índice Notarial'
        else 'Excluida del Índice Notarial'
      end,
      jsonb_build_object('includeInNotarialIndex', new.include_in_notarial_index)
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

-- ------------------------------------------------------------------- view
--
-- `effective_index_date` clasifica visualmente (Año/Mes/Quincena) una
-- Escritura sin `authorized_at` usando `created_at` como resguardo — SOLO
-- para que siga siendo localizable en algún período mientras falta el dato
-- real, nunca como sustituto del dato jurídico:
--   - NO se persiste como authorized_at (columna real de metadata intacta).
--   - NO participa en is_complete (que sigue exigiendo m.authorized_at).
--   - NO se imprime como fecha en el Word (notarial-docx.ts sigue leyendo
--     `authorized_at` crudo vía el mapper, no esta columna).
-- Reemplaza el filtro `authorized_at.is.null OR rango` (PR #177/#181): con
-- effective_index_date nunca NULL, cada fila pertenece a exactamente un
-- período (el real si existe, el provisional si no) en vez de aparecer en
-- TODOS los períodos simultáneamente — evita que Año/Mes/Quincena pierda
-- sentido cuando hay varias Escrituras sin fecha, y en cuanto se configura
-- authorized_at la fila se reclasifica sola al período real (misma
-- expresión, ya no depende de created_at).
create or replace view public.notarial_index_entries
with (security_invoker = on)
as
select
  d.id as document_id,
  d.owner_id,
  d.title,
  d.updated_at,
  d.template_id,
  c.full_name as client_name,
  m.instrument_number,
  m.authorized_at,
  m.protocol_book,
  m.initial_folio,
  m.final_folio,
  m.act_name_snapshot,
  m.act_name_override,
  coalesce(nullif(btrim(m.act_name_override), ''), m.act_name_snapshot, t.name) as act_name,
  m.generated_parties,
  m.parties_override,
  coalesce(nullif(btrim(m.parties_override), ''), m.generated_parties) as parties,
  m.version,
  extract(year from (coalesce(m.authorized_at, d.created_at) at time zone 'America/Costa_Rica'))::integer as period_year,
  extract(month from (coalesce(m.authorized_at, d.created_at) at time zone 'America/Costa_Rica'))::integer as period_month,
  case
    when extract(day from (coalesce(m.authorized_at, d.created_at) at time zone 'America/Costa_Rica')) between 1 and 15 then 'FIRST_HALF'
    else 'SECOND_HALF'
  end as period_half,
  (m.document_id is not null) as has_metadata,
  (
    m.instrument_number is not null
    and m.authorized_at is not null
    and coalesce(btrim(m.protocol_book), '') <> ''
    and coalesce(btrim(m.initial_folio), '') <> ''
    and coalesce(btrim(m.final_folio), '') <> ''
    and coalesce(btrim(coalesce(m.act_name_override, m.act_name_snapshot, t.name)), '') <> ''
    and coalesce(btrim(coalesce(m.parties_override, m.generated_parties)), '') <> ''
  ) as is_complete,
  d.workspace_id,
  coalesce(m.authorized_at, d.created_at) as effective_index_date
from public.documents d
left join public.document_notarial_metadata m
  on m.document_id = d.id and m.workspace_id = d.workspace_id
left join public.clients c
  on c.id = d.client_id and c.workspace_id = d.workspace_id
left join public.templates t
  on t.id = d.template_id and t.workspace_id = d.workspace_id
where d.status = 'final' and d.include_in_notarial_index = true;

comment on view public.notarial_index_entries is
  'Escrituras finalizadas Y explícitamente incluidas en el Índice (include_in_notarial_index=true) — status=final ya no basta por sí solo. effective_index_date ubica visualmente las filas sin authorized_at por created_at (nunca afecta is_complete ni se imprime como fecha real). act_name cae al nombre del machote cuando nunca se guardó el paso Índice. security_invoker respeta RLS.';
