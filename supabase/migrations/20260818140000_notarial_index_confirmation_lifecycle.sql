-- ======================================= notarial index confirmation lifecycle
--
-- Separa tres conceptos que hasta ahora se confundían:
--   Finalizar Escritura  ≠  Guardar datos del Índice  ≠  Confirmar datos del Índice
--
-- Antes, `isNotarialComplete()` (derivada, nunca almacenada) era la única
-- señal de "el Índice está listo" — el stepper y el listado la usaban
-- directamente. Eso no permite un paso de revisión explícito: un usuario
-- podía guardar un valor mal transcrito y el sistema lo trataba como
-- definitivo apenas los campos requeridos quedaban no vacíos.
--
-- Representación elegida: tres columnas en `document_notarial_metadata`
-- (no en `documents`, no una tabla nueva) — la confirmación es sobre el
-- CONTENIDO de la metadata notarial, el mismo lugar donde ya vive todo lo
-- demás que describe "qué tan lista está esta información":
--   notarial_confirmed_at     — NULL = no confirmado. La única fuente de
--                               verdad de "¿está confirmado?".
--   notarial_confirmed_by     — actor que confirmó (uuid, como
--                               document_activity.actor_user_id).
--   notarial_review_required  — true = estuvo confirmado y una acción
--                               posterior (reabrir la Escritura, o
--                               "Corregir datos" explícito) invalidó esa
--                               confirmación. Los valores se conservan.
--
-- Estado derivado (nunca una columna de estado — evita inconsistencia):
--   confirmed_at IS NOT NULL       -> Confirmado
--   review_required                -> Revisión requerida
--   isNotarialComplete()           -> Listo para confirmar
--   si no                          -> Pendiente
-- El botón "Confirmar" aparece cuando (!confirmed_at && isComplete) — cubre
-- tanto "Listo para confirmar" como "Revisión requerida ya completa de
-- nuevo": misma acción en ambos casos.
--
-- Default seguro para filas existentes: confirmed_at NULL, review_required
-- false. Ningún dato histórico queda confirmado automáticamente, aunque su
-- metadata ya esté completa.

alter table public.document_notarial_metadata
  add column notarial_confirmed_at timestamptz,
  add column notarial_confirmed_by uuid references auth.users(id),
  add column notarial_review_required boolean not null default false;

comment on column public.document_notarial_metadata.notarial_confirmed_at is
  'NULL = no confirmado. Única fuente de verdad de si los datos del Índice fueron revisados y confirmados explícitamente por un usuario.';
comment on column public.document_notarial_metadata.notarial_confirmed_by is
  'Actor que confirmó los datos del Índice (auth.users.id), o NULL si nunca se confirmaron.';
comment on column public.document_notarial_metadata.notarial_review_required is
  'true = los datos estuvieron confirmados y una acción posterior (reabrir la Escritura, o "Corregir datos" explícito) invalidó esa confirmación. Los valores existentes se conservan; deben revisarse y confirmarse de nuevo.';

-- ------------------------------------------------------ permission + lock enforcement
--
-- Extiende el trigger existente (BEFORE UPDATE en document_notarial_metadata,
-- ya gobierna membresía de Workspace y el incremento de `version`). No se usa
-- RLS para esto: distinguir "guardar contenido" de "confirmar" o "iniciar
-- corrección" dentro del mismo UPDATE requiere ver qué columnas cambiaron
-- realmente, algo que un `using`/`with check` de RLS no expresa con
-- claridad — mismo razonamiento ya aplicado a
-- `enforce_document_finalize_permission` (20260804210000, 20260807000000,
-- 20260818130000).
--
-- Reglas, en orden:
--   1) Si la fila está confirmada (old.notarial_confirmed_at is not null) Y
--      la transacción NO está liberando esa confirmación (new confirmed_at
--      sigue igual a old), ningún campo de contenido puede cambiar. La
--      única forma de editar contenido confirmado es primero "Corregir
--      datos" (que limpia confirmed_at) y luego un guardado normal —
--      son dos transacciones, nunca una ventana donde el campo esté
--      editable y el sistema siga diciendo "Confirmado".
--   2) Confirmar (old confirmed_at NULL -> new confirmed_at NOT NULL) exige
--      que los campos requeridos estén completos — misma expresión que ya
--      usa `record_notarial_metadata_activity` y la vista del Índice, no
--      una regla nueva.
--   3) Confirmar o iniciar corrección (cualquier cambio a confirmed_at o a
--      review_required) exige rol propietario/administrador — mismo rol
--      que ya gobierna `notarial_index.generate` (exportar el Índice a
--      Word): confirmar es la misma clase de decisión de confianza sobre
--      estos datos.
create or replace function public.enforce_notarial_metadata_editable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_content_changed boolean;
  v_confirming boolean;
  v_confirmation_state_changed boolean;
begin
  if tg_op = 'UPDATE'
    and (
      new.document_id is distinct from old.document_id
      or new.workspace_id is distinct from old.workspace_id
    )
  then
    raise exception 'notarial metadata workspace and document link cannot be changed'
      using errcode = 'check_violation';
  end if;

  if not public.is_workspace_member(new.workspace_id, array['propietario', 'administrador', 'asistente']) then
    raise exception 'workspace membership required'
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'UPDATE' then
    v_content_changed :=
      new.instrument_number is distinct from old.instrument_number
      or new.authorized_at is distinct from old.authorized_at
      or new.protocol_book is distinct from old.protocol_book
      or new.initial_folio is distinct from old.initial_folio
      or new.final_folio is distinct from old.final_folio
      or new.act_name_override is distinct from old.act_name_override
      or new.act_name_snapshot is distinct from old.act_name_snapshot
      or new.parties_override is distinct from old.parties_override
      or new.generated_parties is distinct from old.generated_parties
      or new.notes is distinct from old.notes;

    v_confirmation_state_changed :=
      new.notarial_confirmed_at is distinct from old.notarial_confirmed_at
      or new.notarial_review_required is distinct from old.notarial_review_required;

    if (
      old.notarial_confirmed_at is not null
      and new.notarial_confirmed_at is not distinct from old.notarial_confirmed_at
      and v_content_changed
    ) then
      raise exception 'notarial index data is confirmed; use the correction flow to edit it'
        using errcode = 'check_violation';
    end if;

    v_confirming := old.notarial_confirmed_at is null and new.notarial_confirmed_at is not null;
    if v_confirming and not (
      new.instrument_number is not null
      and new.authorized_at is not null
      and coalesce(btrim(new.protocol_book), '') <> ''
      and coalesce(btrim(new.initial_folio), '') <> ''
      and coalesce(btrim(new.final_folio), '') <> ''
      and coalesce(btrim(coalesce(new.act_name_override, new.act_name_snapshot)), '') <> ''
      and coalesce(btrim(coalesce(new.parties_override, new.generated_parties)), '') <> ''
    ) then
      raise exception 'cannot confirm incomplete notarial index data'
        using errcode = 'check_violation';
    end if;
    -- Confirmar siempre limpia review_required, sin depender de que quien
    -- llama lo incluya en su UPDATE — la invariante "confirmado implica no
    -- pendiente de revisión" la garantiza la base de datos, no cada caller.
    if v_confirming then
      new.notarial_review_required := false;
    end if;

    if v_confirmation_state_changed
      and not public.is_workspace_member(new.workspace_id, array['propietario', 'administrador'])
    then
      raise exception 'confirming or correcting notarial index data requires propietario or administrador role'
        using errcode = 'insufficient_privilege';
    end if;

    new.version := old.version + 1;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------------- audit
--
-- Extiende `record_notarial_metadata_activity` (ya calcula `changedFields`
-- para ediciones de contenido) con dos eventos nuevos, distinguibles del
-- genérico "notarial_metadata_updated":
--   notarial_index_data_confirmed             — confirmed_at pasó de NULL a
--                                                un valor.
--   notarial_index_data_correction_started    — confirmed_at pasó de un
--                                                valor a NULL (se cubre
--                                                tanto el botón manual
--                                                "Corregir datos" como la
--                                                invalidación automática al
--                                                reabrir la Escritura — se
--                                                distinguen por cercanía
--                                                temporal con el evento
--                                                document_reopened, que ya
--                                                queda registrado aparte;
--                                                no hace falta un campo
--                                                "reason" adicional).
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

  -- Confirmación / inicio de corrección: eventos propios, sin pasar por la
  -- detección genérica de "campos de contenido cambiados" de abajo (estas
  -- transiciones nunca cambian contenido en el mismo statement, ver
  -- enforce_notarial_metadata_editable).
  if (new.notarial_confirmed_at is distinct from old.notarial_confirmed_at) then
    if new.notarial_confirmed_at is not null then
      insert into public.document_activity
        (document_id, owner_id, workspace_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, summary, metadata)
      values (new.document_id, new.owner_id, new.workspace_id, v_actor, v_actor_name, v_actor_role,
              'notarial_index_data_confirmed', 'Datos del Índice confirmados', '{}'::jsonb);
    else
      insert into public.document_activity
        (document_id, owner_id, workspace_id, actor_user_id, actor_name_snapshot, actor_role_snapshot, event_type, summary, metadata)
      values (new.document_id, new.owner_id, new.workspace_id, v_actor, v_actor_name, v_actor_role,
              'notarial_index_data_correction_started',
              'Corrección de datos del Índice iniciada', '{}'::jsonb);
    end if;
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

-- ------------------------------------------------------------- reopen cascade
--
-- Extiende `record_document_activity` (ya dispara AFTER UPDATE en documents
-- cuando cambia `status`; co-ubicar aquí evita crear un trigger nuevo). En
-- la transición final -> no-final, invalida cualquier confirmación previa
-- de la metadata notarial asociada. Autolimitado por el WHERE
-- (notarial_confirmed_at is not null): si la metadata nunca fue confirmada,
-- esta sentencia no actualiza ninguna fila y no genera ruido de auditoría —
-- coincide con "si nunca estuvieron confirmados, no hace falta advertir".
-- Esta UPDATE dispara a su vez `record_notarial_metadata_activity` (arriba),
-- que registra el evento notarial_index_data_correction_started — no se
-- duplica esa inserción aquí.
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

    if old.status = 'final' and new.status in ('draft', 'ready') then
      update public.document_notarial_metadata
         set notarial_confirmed_at = null,
             notarial_confirmed_by = null,
             notarial_review_required = true
       where document_id = new.id
         and workspace_id = new.workspace_id
         and notarial_confirmed_at is not null;
    end if;
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
-- Expone las tres columnas nuevas al Índice general (estado compacto en el
-- listado) — se agregan al final del SELECT, respetando la restricción de
-- CREATE OR REPLACE VIEW de no reordenar columnas existentes.
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
  coalesce(m.authorized_at, d.created_at) as effective_index_date,
  m.notarial_confirmed_at,
  m.notarial_review_required
from public.documents d
left join public.document_notarial_metadata m
  on m.document_id = d.id and m.workspace_id = d.workspace_id
left join public.clients c
  on c.id = d.client_id and c.workspace_id = d.workspace_id
left join public.templates t
  on t.id = d.template_id and t.workspace_id = d.workspace_id
where d.status = 'final' and d.include_in_notarial_index = true;

comment on view public.notarial_index_entries is
  'Escrituras finalizadas Y explícitamente incluidas en el Índice (include_in_notarial_index=true). effective_index_date ubica visualmente las filas sin authorized_at por created_at. notarial_confirmed_at/notarial_review_required exponen el ciclo de confirmación del Índice (ver 20260818140000). act_name cae al nombre del machote cuando nunca se guardó el paso Índice. security_invoker respeta RLS.';
