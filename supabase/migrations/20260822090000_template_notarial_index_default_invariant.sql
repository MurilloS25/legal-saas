-- ============================== notarial index default snapshot invariant
--
-- 20260819210000 introdujo el default del Machote pero dejó el snapshot
-- (Machote → Escritura al crear) exclusivamente en application code
-- (createDocumentDraftAction). Un insert directo a `documents` por Data API
-- (RLS de 20260804210000 ya permite INSERT a documents.create) podía omitir
-- el snapshot o forzar cualquier valor de `include_in_notarial_index`,
-- saltándose la regla de negocio sin tocar ninguna política.
--
-- Fix: mover el snapshot a un trigger BEFORE INSERT — la única fuente de
-- verdad sobre "qué recibe una Escritura nueva de su Machote" pasa a ser la
-- base de datos, sin importar cómo se hizo el insert. `include_in_notarial_index`
-- deja de ser un valor que el cliente pueda fijar al crear: siempre se deriva
-- del Machote (o `true` si el Machote no existe/fue borrado, mismo default
-- histórico de la columna). El application code (createDocumentDraftAction)
-- sigue enviando el valor explícitamente por claridad, pero el trigger es
-- quien manda — cualquier valor que el cliente envíe en el INSERT se
-- descarta.
create or replace function public.enforce_document_notarial_index_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_default boolean;
begin
  select include_in_notarial_index_by_default into v_default
    from public.templates
   where id = new.template_id;

  new.include_in_notarial_index := coalesce(v_default, true);
  return new;
end;
$$;

drop trigger if exists documents_notarial_index_snapshot on public.documents;
create trigger documents_notarial_index_snapshot
  before insert on public.documents
  for each row
  execute function public.enforce_document_notarial_index_snapshot();

-- ------------------------------------------------------------------ AUD-02
--
-- Decisión de producto: trabajar el Índice Notarial (preparar/confirmar
-- metadata, incluir/excluir una Escritura del Índice, generar/exportar el
-- Índice, y configurar el default de un Machote) es tarea de propietario,
-- administrador Y asistente — asistente NO pierde ninguna capacidad del
-- Índice. Lo único que sigue reservado a propietario/administrador es
-- finalizar/reabrir la Escritura en sí (`enforce_document_finalize_permission`
-- más abajo), una operación de ciclo de vida distinta de pertenecer al
-- Índice.
--
-- `set_template_notarial_index_default` ya permitía a asistente (sin
-- cambios aquí, se mantiene el mismo array de roles que 20260819210000) —
-- esta sección solo agrega el retorno de `updated_at` (ver AUD-03 abajo).
--
-- El trigger de permisos que protege `include_in_notarial_index` SÍ debía
-- cambiar: antes exigía el mismo par de roles que finalizar/reabrir
-- (propietario/administrador), lo cual bloqueaba a asistente de incluir o
-- excluir una Escritura del Índice — inconsistente con que ese mismo rol sí
-- puede fijar el default del Machote. Se separa en dos chequeos
-- independientes: finalizar/reabrir sigue exigiendo propietario/
-- administrador; cambiar `include_in_notarial_index` ahora acepta también
-- asistente.
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
  ) then
    if not public.is_workspace_member(new.workspace_id, array['propietario', 'administrador']) then
      raise exception 'finalizing or reopening a document requires propietario or administrador role'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if (new.include_in_notarial_index is distinct from old.include_in_notarial_index) then
    if not public.is_workspace_member(new.workspace_id, array['propietario', 'administrador', 'asistente']) then
      raise exception 'changing notarial index inclusion requires propietario, administrador or asistente role'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

-- AUD-03: `set_template_notarial_index_default` ahora retorna el
-- `updated_at` fresco del Machote, no `void` — el toggle vive en un <form>
-- hermano del formulario principal del Machote (name/description/content/
-- fields), que guarda su propio `expected_updated_at` para concurrencia
-- optimista (save_template_workspace). Sin devolver el valor nuevo, guardar
-- el toggle deja ese `expected_updated_at` apuntando al `updated_at` viejo
-- y el siguiente guardado del Machote se rechaza como conflicto optimista
-- contra el propio usuario. Roles sin cambios respecto a 20260819210000
-- (propietario/administrador/asistente, igual que templates.write).
--
-- Postgres no permite CREATE OR REPLACE cuando cambia el tipo de retorno
-- (void -> timestamptz) — se elimina la función existente primero. Los
-- grants (revoke all / grant execute to authenticated) se restablecen
-- explícitamente después, ya que DROP FUNCTION los descarta.
drop function if exists public.set_template_notarial_index_default(uuid, boolean);

create function public.set_template_notarial_index_default(
  p_template_id uuid,
  p_include_by_default boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_include_by_default is null then
    raise exception using errcode = '22023', message = 'invalid_include_by_default';
  end if;

  select workspace_id into v_workspace_id from public.templates where id = p_template_id;
  if v_workspace_id is null
    or not public.is_workspace_member(v_workspace_id, array['propietario', 'administrador', 'asistente']) then
    raise exception using errcode = 'P0002', message = 'template_not_found';
  end if;

  update public.templates
     set include_in_notarial_index_by_default = p_include_by_default
   where id = p_template_id and workspace_id = v_workspace_id
  returning updated_at into v_updated_at;

  return v_updated_at;
end;
$$;

revoke all on function public.set_template_notarial_index_default(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_template_notarial_index_default(uuid, boolean)
  to authenticated;

-- ------------------------------------------------------- AUD-02 (continued)
--
-- `enforce_notarial_metadata_editable` (20260818140000) tenía el MISMO
-- desacople pendiente para confirmar/corregir datos del Índice: exigía
-- propietario/administrador exclusivamente para cualquier cambio a
-- `notarial_confirmed_at`/`notarial_review_required`, aunque el resto de la
-- fila (todos los campos de contenido del Índice) ya aceptaba asistente.
-- Confirmar y corregir son parte del mismo trabajo del Índice que asistente
-- debe poder hacer — se agrega asistente a ese chequeo. El resto de la
-- función (ownership del link documento/workspace, membresía general,
-- reglas de completitud/versión) queda exactamente igual a 20260818140000.
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
      and not public.is_workspace_member(new.workspace_id, array['propietario', 'administrador', 'asistente'])
    then
      raise exception 'confirming or correcting notarial index data requires propietario, administrador or asistente role'
        using errcode = 'insufficient_privilege';
    end if;

    new.version := old.version + 1;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------- AUD-02 (continued)
--
-- `log_notarial_index_export` (20260713160000, redefinida por última vez en
-- 20260805100000) tenía el MISMO desacople pendiente: exigía propietario/
-- administrador exclusivamente para registrar una exportación del Índice,
-- fallando "en silencio" (return temprano, sin insertar) para cualquier
-- otro rol. Generar/exportar el Índice es parte del mismo trabajo que
-- asistente debe poder hacer — se agrega asistente al chequeo de rol.
-- También se corrige la selección de `v_workspace_id` (ver comentario en el
-- cuerpo de la función) — bug preexistente, no relacionado con el rol,
-- descubierto al verificar este cambio con E2E dirigido.
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

  -- Bug preexistente descubierto al verificar el fix de arriba con E2E: todo
  -- usuario tiene además su propio Workspace "bootstrap" personal
  -- (workspace_id = auth.uid(), trigger auth_users_bootstrap_workspace) al
  -- que siempre pertenece como propietario. Un `limit 1` sin `order by`
  -- sobre `workspace_members` es ambiguo entre esa fila bootstrap y la
  -- membresía real por la que el usuario está aquí (p. ej. invitado como
  -- asistente a OTRO Workspace) — podía registrar la exportación en el
  -- Workspace bootstrap equivocado en vez del Workspace donde realmente
  -- trabaja. Mismo criterio de precedencia que ya usa `getWorkspaceAccess`
  -- (src/lib/server/auth.ts): una membresía genuina (workspace_id distinto
  -- de auth.uid()) siempre gana sobre el bootstrap propio.
  select workspace_id into v_workspace_id
    from public.workspace_members
   where user_id = auth.uid() and status = 'active'
   order by (workspace_id = auth.uid()) asc
   limit 1;

  if v_workspace_id is null
    or not public.is_workspace_member(v_workspace_id, array['propietario', 'administrador', 'asistente']) then
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

-- ------------------------------------------------------------------ AUD-06
--
-- El comentario de 20260818130000 describía un modelo donde la inclusión se
-- fijaba al finalizar. Desde 20260819210000 se fija al CREAR (snapshot del
-- default del Machote, ahora garantizado por el trigger de arriba) y solo se
-- corrige después vía setNotarialIndexInclusionAction.
comment on column public.documents.include_in_notarial_index is
  'Decisión de si la Escritura pertenece al universo del Índice Notarial. Se fija al CREAR como snapshot de templates.include_in_notarial_index_by_default (trigger documents_notarial_index_snapshot, no negociable por el cliente) y puede corregirse después desde el paso Índice una vez finalizada. Cambiarla requiere propietario, administrador o asistente (enforce_document_finalize_permission) — finalizar/reabrir la Escritura en sí sigue reservado a propietario/administrador.';
