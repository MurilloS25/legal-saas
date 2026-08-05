-- Roles, invitaciones y permisos (Iteración 5).
--
-- Prerrequisito: fundación de Workspaces (Iteración 4,
-- 20260804200000_workspace_foundation.sql). Diseño completo y decisiones no
-- cubiertas por el spec (invariante "1 Workspace por usuario", por qué se
-- rechaza invitar un correo ya registrado, por qué se elimina el Workspace
-- personal al aceptar) documentadas en docs/WORKSPACE_MULTIUSER_ARCHITECTURE.md.
--
-- Cambio estructural clave: `workspace_id` deja de ser una columna generada
-- (`generated always as (owner_id) stored`, truco de la Iteración 4 que solo
-- funcionaba porque un Workspace y su único miembro eran 1:1) y pasa a ser
-- una columna independiente — es lo que por fin permite que un asistente
-- escriba datos DENTRO del Workspace ajeno del que es miembro; antes era
-- estructuralmente imposible.
--
-- Dos consecuencias que hay que resolver juntas, no solo "quitar la
-- expresión generada":
--
-- 1. Sin la expresión generada, cualquier INSERT que no fije workspace_id
--    explícitamente violaría su NOT NULL — incluyendo todo el código
--    TypeScript existente (`.insert({owner_id: user.id, ...})`, sin
--    workspace_id) y los triggers de la Iteración 4 que tampoco lo fijaban.
--    Se agrega un trigger BEFORE INSERT (`default_workspace_id_from_actor`)
--    que rellena workspace_id con el Workspace activo del actor cuando no
--    se especifica — dado el invariante "1 Workspace por usuario", esto
--    resuelve el caso común (un asistente crea un dato: su único Workspace
--    activo YA ES el Workspace compartido) sin tocar ningún Server Action
--    existente, igual que la Iteración 4 logró cero cambios de TypeScript.
--
-- 2. Varias FK compuestas asumían que `owner_id` era igual entre una fila
--    hija y su padre (`(hijo_fk, owner_id) references padre(id, owner_id)`)
--    — cierto en la Iteración 4 porque owner_id y workspace_id eran el
--    mismo valor. Ahora que un asistente puede crear una fila hija
--    (owner_id = el asistente) bajo un padre creado por el propietario
--    (owner_id = el propietario), esa FK rechazaría la operación aunque
--    RLS ya la hubiera permitido. Se reescriben esas FK para validar
--    `workspace_id` en vez de `owner_id` — el alcance real del dato — y
--    `owner_id` queda libre para significar solo "quién escribió esta fila"
--    (su separación formal de "identidad notarial" es trabajo de la
--    Iteración 6).

-- ============================================================ workspace_id

alter table public.lawyer_profiles alter column workspace_id drop expression;
alter table public.document_settings alter column workspace_id drop expression;
alter table public.clients alter column workspace_id drop expression;
alter table public.templates alter column workspace_id drop expression;
alter table public.template_fields alter column workspace_id drop expression;
alter table public.template_index_configurations alter column workspace_id drop expression;
alter table public.template_index_configuration_fields alter column workspace_id drop expression;
alter table public.documents alter column workspace_id drop expression;
alter table public.document_activity alter column workspace_id drop expression;
alter table public.document_notarial_metadata alter column workspace_id drop expression;
alter table public.notarial_index_exports alter column workspace_id drop expression;
alter table public.receivables alter column workspace_id drop expression;
alter table public.receivable_activity alter column workspace_id drop expression;
alter table public.receivable_payments alter column workspace_id drop expression;

-- ================================================== default workspace_id

create or replace function public.default_workspace_id_from_actor()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.workspace_id is null then
    -- coalesce(auth.uid(), new.owner_id): en una request normal auth.uid()
    -- es el actor autenticado (el caso que importa en producción). Cuando
    -- no hay JWT (fixtures de pgTAP, cualquier insert hecho directamente
    -- como postgres/superuser) auth.uid() es null y se resuelve por
    -- owner_id — correcto porque owner_id siempre pertenece a un
    -- propietario de su propio Workspace en esos casos.
    select workspace_id into new.workspace_id
      from public.workspace_members
     where user_id = coalesce(auth.uid(), new.owner_id) and status = 'active'
     limit 1;
  end if;
  return new;
end;
$$;

revoke all on function public.default_workspace_id_from_actor() from public, anon, authenticated;

-- Nombrado "<tabla>_default_workspace_id" a propósito: Postgres ejecuta
-- varios triggers BEFORE ROW en orden alfabético de nombre, no de creación.
-- "default" ordena antes que "enforce"/"sync" (los otros BEFORE INSERT que
-- ya existían en document_notarial_metadata y receivables), así que este
-- trigger siempre rellena workspace_id antes de que cualquier otro lo lea.
create trigger lawyer_profiles_default_workspace_id before insert on public.lawyer_profiles for each row execute function public.default_workspace_id_from_actor();
create trigger document_settings_default_workspace_id before insert on public.document_settings for each row execute function public.default_workspace_id_from_actor();
create trigger clients_default_workspace_id before insert on public.clients for each row execute function public.default_workspace_id_from_actor();
create trigger templates_default_workspace_id before insert on public.templates for each row execute function public.default_workspace_id_from_actor();
create trigger template_fields_default_workspace_id before insert on public.template_fields for each row execute function public.default_workspace_id_from_actor();
create trigger template_index_config_default_workspace_id before insert on public.template_index_configurations for each row execute function public.default_workspace_id_from_actor();
create trigger template_index_fields_default_workspace_id before insert on public.template_index_configuration_fields for each row execute function public.default_workspace_id_from_actor();
create trigger documents_default_workspace_id before insert on public.documents for each row execute function public.default_workspace_id_from_actor();
create trigger document_activity_default_workspace_id before insert on public.document_activity for each row execute function public.default_workspace_id_from_actor();
create trigger dnm_default_workspace_id before insert on public.document_notarial_metadata for each row execute function public.default_workspace_id_from_actor();
create trigger nie_default_workspace_id before insert on public.notarial_index_exports for each row execute function public.default_workspace_id_from_actor();
create trigger receivables_default_workspace_id before insert on public.receivables for each row execute function public.default_workspace_id_from_actor();
create trigger receivable_activity_default_workspace_id before insert on public.receivable_activity for each row execute function public.default_workspace_id_from_actor();
create trigger receivable_payments_default_workspace_id before insert on public.receivable_payments for each row execute function public.default_workspace_id_from_actor();

-- ============================================== composite FKs: owner_id -> workspace_id

-- Unique keys de soporte para las nuevas FK (workspace_id sustituye a
-- owner_id como columna de consistencia padre/hijo).
alter table public.templates add constraint templates_id_workspace_id_key unique (id, workspace_id);
alter table public.clients add constraint clients_id_workspace_id_key unique (id, workspace_id);
alter table public.documents add constraint documents_id_workspace_id_key unique (id, workspace_id);
alter table public.receivables add constraint receivables_id_workspace_id_key unique (id, workspace_id);
alter table public.template_fields add constraint template_fields_id_workspace_template_key unique (id, workspace_id, template_id);
alter table public.template_index_configurations add constraint template_index_config_id_workspace_template_key unique (id, workspace_id, template_id);

-- "Un config por template" era unique(owner_id, template_id) — correcto
-- solo mientras owner_id y workspace_id coincidían (Iteración 4). Ahora que
-- distintos miembros del mismo Workspace pueden configurar el mismo
-- template en momentos distintos (cada uno con su propio owner_id), la
-- invariante real es "un config por template POR WORKSPACE" — se sustituye
-- por unique(workspace_id, template_id), y los `on conflict` de las RPCs de
-- guardado usan esa misma columna.
alter table public.template_index_configurations drop constraint template_index_config_owner_template_key;
alter table public.template_index_configurations add constraint template_index_config_workspace_template_key unique (workspace_id, template_id);

-- Mismo razonamiento para lawyer_profiles/document_settings: "1 fila por
-- owner_id" debe ser "1 fila por Workspace" (settings.manage ya restringe
-- la escritura a propietario/administrador, pero cualquiera de los dos
-- debe actualizar la MISMA fila compartida, no crear la suya propia).
alter table public.lawyer_profiles drop constraint lawyer_profiles_owner_id_key;
alter table public.lawyer_profiles add constraint lawyer_profiles_workspace_id_key unique (workspace_id);

alter table public.document_settings drop constraint document_settings_owner_id_key;
alter table public.document_settings add constraint document_settings_workspace_id_key unique (workspace_id);

-- template_fields -> templates
alter table public.template_fields drop constraint template_fields_template_owner_fk;
alter table public.template_fields add constraint template_fields_template_workspace_fk
  foreign key (template_id, workspace_id) references public.templates (id, workspace_id) on delete cascade;

-- documents -> templates / clients
alter table public.documents drop constraint documents_template_owner_fk;
alter table public.documents add constraint documents_template_workspace_fk
  foreign key (template_id, workspace_id) references public.templates (id, workspace_id);

alter table public.documents drop constraint documents_client_owner_fk;
alter table public.documents add constraint documents_client_workspace_fk
  foreign key (client_id, workspace_id) references public.clients (id, workspace_id) on delete set null (client_id);

-- document_notarial_metadata -> documents
alter table public.document_notarial_metadata drop constraint dnm_document_owner_fk;
alter table public.document_notarial_metadata add constraint dnm_document_workspace_fk
  foreign key (document_id, workspace_id) references public.documents (id, workspace_id) on delete cascade;

-- document_activity -> documents
alter table public.document_activity drop constraint document_activity_document_owner_fk;
alter table public.document_activity add constraint document_activity_document_workspace_fk
  foreign key (document_id, workspace_id) references public.documents (id, workspace_id) on delete cascade;

-- receivables -> clients / documents
alter table public.receivables drop constraint receivables_client_owner_fk;
alter table public.receivables add constraint receivables_client_workspace_fk
  foreign key (client_id, workspace_id) references public.clients (id, workspace_id);

alter table public.receivables drop constraint receivables_document_owner_fk;
alter table public.receivables add constraint receivables_document_workspace_fk
  foreign key (document_id, workspace_id) references public.documents (id, workspace_id) on delete set null (document_id);

-- receivable_activity / receivable_payments -> receivables
alter table public.receivable_activity drop constraint ra_receivable_owner_fk;
alter table public.receivable_activity add constraint ra_receivable_workspace_fk
  foreign key (receivable_id, workspace_id) references public.receivables (id, workspace_id) on delete cascade;

alter table public.receivable_payments drop constraint rp_receivable_owner_fk;
alter table public.receivable_payments add constraint rp_receivable_workspace_fk
  foreign key (receivable_id, workspace_id) references public.receivables (id, workspace_id) on delete cascade;

-- template_index_configurations -> templates
alter table public.template_index_configurations drop constraint template_index_config_template_owner_fk;
alter table public.template_index_configurations add constraint template_index_config_template_workspace_fk
  foreign key (template_id, workspace_id) references public.templates (id, workspace_id) on delete cascade;

-- template_index_configuration_fields -> template_index_configurations / template_fields
alter table public.template_index_configuration_fields drop constraint template_index_fields_configuration_fk;
alter table public.template_index_configuration_fields add constraint template_index_fields_configuration_workspace_fk
  foreign key (configuration_id, workspace_id, template_id)
  references public.template_index_configurations (id, workspace_id, template_id) on delete cascade;

alter table public.template_index_configuration_fields drop constraint template_index_fields_template_field_fk;
alter table public.template_index_configuration_fields add constraint template_index_fields_template_field_workspace_fk
  foreign key (template_field_id, workspace_id, template_id)
  references public.template_fields (id, workspace_id, template_id) on delete cascade;

-- template_index_configurations' 6 optional field mappings -> template_fields
alter table public.template_index_configurations drop constraint template_index_config_instrument_field_fk;
alter table public.template_index_configurations add constraint template_index_config_instrument_field_workspace_fk
  foreign key (instrument_number_field_id, workspace_id, template_id)
  references public.template_fields (id, workspace_id, template_id) on delete set null (instrument_number_field_id);

alter table public.template_index_configurations drop constraint template_index_config_date_field_fk;
alter table public.template_index_configurations add constraint template_index_config_date_field_workspace_fk
  foreign key (authorized_date_field_id, workspace_id, template_id)
  references public.template_fields (id, workspace_id, template_id) on delete set null (authorized_date_field_id);

alter table public.template_index_configurations drop constraint template_index_config_time_field_fk;
alter table public.template_index_configurations add constraint template_index_config_time_field_workspace_fk
  foreign key (authorized_time_field_id, workspace_id, template_id)
  references public.template_fields (id, workspace_id, template_id) on delete set null (authorized_time_field_id);

alter table public.template_index_configurations drop constraint template_index_config_protocol_field_fk;
alter table public.template_index_configurations add constraint template_index_config_protocol_field_workspace_fk
  foreign key (protocol_book_field_id, workspace_id, template_id)
  references public.template_fields (id, workspace_id, template_id) on delete set null (protocol_book_field_id);

alter table public.template_index_configurations drop constraint template_index_config_initial_folio_field_fk;
alter table public.template_index_configurations add constraint template_index_config_initial_folio_field_workspace_fk
  foreign key (initial_folio_field_id, workspace_id, template_id)
  references public.template_fields (id, workspace_id, template_id) on delete set null (initial_folio_field_id);

alter table public.template_index_configurations drop constraint template_index_config_final_folio_field_fk;
alter table public.template_index_configurations add constraint template_index_config_final_folio_field_workspace_fk
  foreign key (final_folio_field_id, workspace_id, template_id)
  references public.template_fields (id, workspace_id, template_id) on delete set null (final_folio_field_id);

-- ============================================================ workspace_members

-- Antes (Iteración 4) solo el propietario administraba miembros; ahora el
-- administrador también puede (members.manage), pero nunca sobre la fila
-- del propio propietario ni sobre otro administrador — lo aplican las RPCs
-- de gestión de equipo más abajo (necesitan validar el rol de la fila
-- OBJETIVO, no solo el del actor, y escribir auditoría atómica).
drop policy "workspace_members_manage_owner" on public.workspace_members;

create policy "workspace_members_manage_admin"
on public.workspace_members for all to authenticated
using (public.is_workspace_member(workspace_id, array['propietario', 'administrador']))
with check (public.is_workspace_member(workspace_id, array['propietario', 'administrador']));

-- ==================================================== workspace_activity

create table public.workspace_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  target_user_id uuid references auth.users(id),
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  constraint workspace_activity_event_type_not_blank check (btrim(event_type) <> ''),
  constraint workspace_activity_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.workspace_activity is
  'Historial de gestión de equipo (invitación, aceptación, cambio de rol, suspensión, reactivación, remoción). Inmutable; escrito solo por las RPCs SECURITY DEFINER de esta migración. No se borra al remover un miembro (target_user_id no tiene on delete cascade).';

create index workspace_activity_workspace_created_idx
  on public.workspace_activity (workspace_id, created_at desc, id desc);

alter table public.workspace_activity enable row level security;

create policy "workspace_activity_select_member"
on public.workspace_activity for select to authenticated
using (public.is_workspace_member(workspace_id));

-- ==================================================== finalize permission guard

-- documents.finalize (y notarial_index.generate, payments.void, más abajo)
-- son acciones sensibles restringidas a propietario/administrador, aun
-- cuando el asistente ya puede editar/crear borradores. RLS por sí sola no
-- distingue "cambiar el título" de "cambiar status a final" dentro del
-- mismo UPDATE — se necesita un trigger dedicado, mismo patrón que
-- `enforce_notarial_metadata_editable`/`block_delete_final_documents` ya
-- usan en este repo.
create or replace function public.enforce_document_finalize_permission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'final' and old.status is distinct from 'final' then
    if not public.is_workspace_member(new.workspace_id, array['propietario', 'administrador']) then
      raise exception 'finalizing a document requires propietario or administrador role'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_document_finalize_permission()
  from public, anon, authenticated;

create trigger documents_enforce_finalize_permission
before update on public.documents
for each row execute function public.enforce_document_finalize_permission();

-- ================================================ owner-equality trigger fixes

-- Tres triggers de la Iteración 4 quedaron sin tocar porque en ese momento
-- `auth.uid() = owner_id` y "es miembro del Workspace" eran equivalentes
-- (un solo miembro por Workspace). Ahora que un asistente puede editar/
-- borrar filas cuyo owner_id pertenece a otro miembro (p. ej. el
-- propietario corrige un dato para índice que un asistente preparó), esa
-- comparación directa rechazaría operaciones legítimas — se sustituye por
-- el mismo chequeo de membresía usado en el resto de esta migración.

-- Nota: NO bloquea edición cuando la Escritura está 'final' — esa regla
-- existió en una versión temprana de esta función y fue retirada
-- deliberadamente en strengthen_notarial_index_data_model.sql ("revisión y
-- corrección del índice ocurre después de finalizar", docs/DATABASE.md).
-- Reintroducirla aquí habría sido una regresión real, no una simplificación.
create or replace function public.enforce_notarial_metadata_editable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
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
    new.version := old.version + 1;
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
  v_changed text[] := array[]::text[];
  v_was_complete boolean;
  v_is_complete boolean;
begin
  if v_actor is null or not public.is_workspace_member(new.workspace_id, array['propietario', 'administrador', 'asistente']) then
    raise exception 'authenticated workspace member required'
      using errcode = 'insufficient_privilege';
  end if;

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
      (document_id, owner_id, workspace_id, actor_user_id, event_type, summary, metadata)
    values (new.document_id, new.owner_id, new.workspace_id, v_actor, 'notarial_metadata_created',
            'Datos para índice creados', '{}'::jsonb);
    if v_is_complete then
      insert into public.document_activity
        (document_id, owner_id, workspace_id, actor_user_id, event_type, summary, metadata)
      values (new.document_id, new.owner_id, new.workspace_id, v_actor,
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
    (document_id, owner_id, workspace_id, actor_user_id, event_type, summary, metadata)
  values (new.document_id, new.owner_id, new.workspace_id, v_actor, 'notarial_metadata_updated',
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
      (document_id, owner_id, workspace_id, actor_user_id, event_type, summary, metadata)
    values (new.document_id, new.owner_id, new.workspace_id, v_actor,
            'notarial_metadata_completed', 'Datos para índice completos', '{}'::jsonb);
  elsif v_was_complete and not v_is_complete then
    insert into public.document_activity
      (document_id, owner_id, workspace_id, actor_user_id, event_type, summary, metadata)
    values (new.document_id, new.owner_id, new.workspace_id, v_actor,
            'notarial_metadata_marked_incomplete',
            'Datos para índice marcados como incompletos', '{}'::jsonb);
  end if;

  return new;
end;
$$;

create or replace function public.mark_template_index_configuration_incomplete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    return old;
  end if;
  if not public.is_workspace_member(old.workspace_id, array['propietario', 'administrador', 'asistente']) then
    raise exception using errcode = '42501', message = 'workspace_membership_required';
  end if;
  update public.template_index_configurations c
     set is_complete = false,
         invalid_mappings = array(
           select distinct invalid_key
           from unnest(
             c.invalid_mappings || array_remove(array[
               case when c.instrument_number_field_id = old.id then 'instrument_number' end,
               case when c.authorized_date_field_id = old.id then 'authorized_date' end,
               case when c.authorized_time_field_id = old.id then 'authorized_time' end,
               case when c.protocol_book_field_id = old.id then 'protocol_book' end,
               case when c.initial_folio_field_id = old.id then 'initial_folio' end,
               case when c.final_folio_field_id = old.id then 'final_folio' end,
               case when exists (
                 select 1 from public.template_index_configuration_fields f
                 where f.configuration_id = c.id
                   and f.template_field_id = old.id
               ) then 'parties' end
             ], null)
           ) invalid_key
           order by invalid_key
         )
   where c.workspace_id = old.workspace_id
     and c.template_id = old.template_id
     and (
       old.id in (
         c.instrument_number_field_id,
         c.authorized_date_field_id,
         c.authorized_time_field_id,
         c.protocol_book_field_id,
         c.initial_folio_field_id,
         c.final_folio_field_id
       )
       or exists (
         select 1 from public.template_index_configuration_fields f
         where f.configuration_id = c.id
           and f.template_field_id = old.id
       )
     );
  return old;
end;
$$;

-- sync_receivable_client_name_snapshot buscaba el cliente por
-- owner_id = new.owner_id — si el actor no coincide con quien creó
-- originalmente al Cliente (ahora un escenario real, no solo teórico), la
-- búsqueda fallaba en silencio y el snapshot quedaba sin sincronizar. Se
-- corrige a buscar por workspace_id, el alcance real del dato.
create or replace function public.sync_receivable_client_name_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.client_id is not null then
    select full_name into new.client_name_snapshot
      from public.clients
     where id = new.client_id and workspace_id = new.workspace_id;
  end if;
  return new;
end;
$$;

-- ==================================================== RLS: escritura ampliada

-- clients (clients.write: propietario/administrador/asistente)

drop policy "clients_insert_workspace" on public.clients;
drop policy "clients_update_workspace" on public.clients;
drop policy "clients_delete_workspace" on public.clients;

create policy "clients_insert_workspace"
on public.clients for insert to authenticated
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente']));

create policy "clients_update_workspace"
on public.clients for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente']));

create policy "clients_delete_workspace"
on public.clients for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente']));

-- templates (templates.write)

drop policy "templates_insert_workspace" on public.templates;
drop policy "templates_update_workspace" on public.templates;
drop policy "templates_delete_workspace" on public.templates;

create policy "templates_insert_workspace"
on public.templates for insert to authenticated
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente']));

create policy "templates_update_workspace"
on public.templates for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente']));

create policy "templates_delete_workspace"
on public.templates for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente']));

-- template_fields

drop policy "template_fields_insert_workspace" on public.template_fields;
drop policy "template_fields_update_workspace" on public.template_fields;
drop policy "template_fields_delete_workspace" on public.template_fields;

create policy "template_fields_insert_workspace"
on public.template_fields for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente'])
  and exists (
    select 1 from public.templates
    where templates.id = template_fields.template_id and templates.workspace_id = template_fields.workspace_id
  )
);

create policy "template_fields_update_workspace"
on public.template_fields for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente'])
  and exists (
    select 1 from public.templates
    where templates.id = template_fields.template_id and templates.workspace_id = template_fields.workspace_id
  )
);

create policy "template_fields_delete_workspace"
on public.template_fields for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente']));

-- template_index_configurations / template_index_configuration_fields
-- (parte de "templates.write": configurar cómo se arma el índice desde un
-- machote es trabajo de preparación, no la exportación en sí — eso lo
-- restringe log_notarial_index_export más abajo).

drop policy "template_index_config_insert_workspace" on public.template_index_configurations;
drop policy "template_index_config_update_workspace" on public.template_index_configurations;
drop policy "template_index_config_delete_workspace" on public.template_index_configurations;

create policy "template_index_config_insert_workspace"
on public.template_index_configurations for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente'])
  and exists (
    select 1 from public.templates t
    where t.id = template_id and t.workspace_id = template_index_configurations.workspace_id
  )
);

create policy "template_index_config_update_workspace"
on public.template_index_configurations for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente'])
  and exists (
    select 1 from public.templates t
    where t.id = template_id and t.workspace_id = template_index_configurations.workspace_id
  )
);

create policy "template_index_config_delete_workspace"
on public.template_index_configurations for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente']));

drop policy "template_index_fields_insert_workspace" on public.template_index_configuration_fields;
drop policy "template_index_fields_update_workspace" on public.template_index_configuration_fields;
drop policy "template_index_fields_delete_workspace" on public.template_index_configuration_fields;

create policy "template_index_fields_insert_workspace"
on public.template_index_configuration_fields for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente'])
  and exists (
    select 1 from public.template_index_configurations c
    where c.id = configuration_id and c.template_id = template_id and c.workspace_id = template_index_configuration_fields.workspace_id
  )
  and exists (
    select 1 from public.template_fields f
    where f.id = template_field_id and f.template_id = template_id and f.workspace_id = template_index_configuration_fields.workspace_id
  )
);

create policy "template_index_fields_update_workspace"
on public.template_index_configuration_fields for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente'])
  and exists (
    select 1 from public.template_index_configurations c
    where c.id = configuration_id and c.template_id = template_id and c.workspace_id = template_index_configuration_fields.workspace_id
  )
  and exists (
    select 1 from public.template_fields f
    where f.id = template_field_id and f.template_id = template_id and f.workspace_id = template_index_configuration_fields.workspace_id
  )
);

create policy "template_index_fields_delete_workspace"
on public.template_index_configuration_fields for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente']));

-- documents (finalize queda bloqueado por el trigger de arriba, no aquí)

drop policy "documents_insert_workspace" on public.documents;
drop policy "documents_update_workspace" on public.documents;
drop policy "documents_delete_workspace" on public.documents;

create policy "documents_insert_workspace"
on public.documents for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente'])
  and exists (
    select 1 from public.templates
    where templates.id = documents.template_id and templates.workspace_id = documents.workspace_id
  )
);

create policy "documents_update_workspace"
on public.documents for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente'])
  and exists (
    select 1 from public.templates
    where templates.id = documents.template_id and templates.workspace_id = documents.workspace_id
  )
);

create policy "documents_delete_workspace"
on public.documents for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente']) and status <> 'final');

-- document_notarial_metadata (preparar datos = trabajo de borrador; la
-- exportación del índice está restringida en log_notarial_index_export)

drop policy "dnm_insert_workspace" on public.document_notarial_metadata;
drop policy "dnm_update_workspace" on public.document_notarial_metadata;
drop policy "dnm_delete_workspace" on public.document_notarial_metadata;

create policy "dnm_insert_workspace"
on public.document_notarial_metadata for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente'])
  and exists (
    select 1 from public.documents
    where documents.id = document_notarial_metadata.document_id and documents.workspace_id = document_notarial_metadata.workspace_id
  )
);

create policy "dnm_update_workspace"
on public.document_notarial_metadata for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente']));

create policy "dnm_delete_workspace"
on public.document_notarial_metadata for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente']));

-- receivables (receivables.manage)

drop policy "receivables_insert_workspace" on public.receivables;
drop policy "receivables_update_workspace" on public.receivables;
drop policy "receivables_delete_workspace" on public.receivables;

create policy "receivables_insert_workspace"
on public.receivables for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente'])
  and (
    client_id is null
    or exists (select 1 from public.clients where clients.id = receivables.client_id and clients.workspace_id = receivables.workspace_id)
  )
  and (
    document_id is null
    or exists (select 1 from public.documents where documents.id = receivables.document_id and documents.workspace_id = receivables.workspace_id)
  )
);

create policy "receivables_update_workspace"
on public.receivables for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente'])
  and (
    client_id is null
    or exists (select 1 from public.clients where clients.id = receivables.client_id and clients.workspace_id = receivables.workspace_id)
  )
  and (
    document_id is null
    or exists (select 1 from public.documents where documents.id = receivables.document_id and documents.workspace_id = receivables.workspace_id)
  )
);

create policy "receivables_delete_workspace"
on public.receivables for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario', 'administrador', 'asistente']));

-- lawyer_profiles / document_settings (settings.manage: prop/admin only)

drop policy "lawyer_profiles_insert_workspace" on public.lawyer_profiles;
drop policy "lawyer_profiles_update_workspace" on public.lawyer_profiles;
drop policy "lawyer_profiles_delete_workspace" on public.lawyer_profiles;

create policy "lawyer_profiles_insert_workspace"
on public.lawyer_profiles for insert to authenticated
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario', 'administrador']));

create policy "lawyer_profiles_update_workspace"
on public.lawyer_profiles for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario', 'administrador']));

create policy "lawyer_profiles_delete_workspace"
on public.lawyer_profiles for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario', 'administrador']));

drop policy "document_settings_insert_workspace" on public.document_settings;
drop policy "document_settings_update_workspace" on public.document_settings;
drop policy "document_settings_delete_workspace" on public.document_settings;

create policy "document_settings_insert_workspace"
on public.document_settings for insert to authenticated
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario', 'administrador']));

create policy "document_settings_update_workspace"
on public.document_settings for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario', 'administrador']));

create policy "document_settings_delete_workspace"
on public.document_settings for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario', 'administrador']));

-- notarial_index_exports (historial operativo de exportación — borrarlo es
-- una conveniencia de limpieza, se deja en prop/admin junto con la propia
-- acción de exportar)

drop policy "nie_delete_workspace" on public.notarial_index_exports;

create policy "nie_delete_workspace"
on public.notarial_index_exports for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario', 'administrador']));

-- ==================================================== RPCs: permisos ampliados

-- register_receivable_payment: payments.register (prop/admin/asistente).
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

  insert into public.receivable_payments
    (receivable_id, owner_id, workspace_id, amount, currency, paid_at, method, reference)
  values (
    p_receivable_id, v_uid, v_rec.workspace_id, v_amount, v_rec.currency,
    coalesce(p_paid_at, (now() at time zone 'America/Costa_Rica')::date),
    p_method, nullif(btrim(p_reference), '')
  )
  returning id into v_payment_id;

  insert into public.receivable_activity
    (receivable_id, owner_id, workspace_id, actor_user_id, event_type, metadata)
  values (p_receivable_id, v_uid, v_rec.workspace_id, v_uid, 'payment_registered',
    jsonb_build_object('amount', v_amount, 'payment_id', v_payment_id));

  if v_paid + v_amount >= v_rec.amount_total then
    insert into public.receivable_activity
      (receivable_id, owner_id, workspace_id, actor_user_id, event_type, metadata)
    values (p_receivable_id, v_uid, v_rec.workspace_id, v_uid, 'receivable_paid', '{}'::jsonb);
  end if;

  return v_payment_id;
end;
$$;

-- void_receivable_payment: payments.void (prop/admin only).
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

  insert into public.receivable_activity
    (receivable_id, owner_id, workspace_id, actor_user_id, event_type, metadata)
  values (v_rec.id, v_uid, v_rec.workspace_id, v_uid, 'payment_voided',
    jsonb_build_object('amount', v_payment.amount, 'payment_id', p_payment_id));

  select coalesce(sum(amount), 0) into v_paid_after
    from public.receivable_payments
   where receivable_id = v_rec.id and status = 'active';

  if v_was_paid and v_paid_after < v_rec.amount_total then
    insert into public.receivable_activity
      (receivable_id, owner_id, workspace_id, actor_user_id, event_type, metadata)
    values (v_rec.id, v_uid, v_rec.workspace_id, v_uid, 'receivable_reopened_after_void', '{}'::jsonb);
  end if;
end;
$$;

-- log_document_word_generated: parte del trabajo normal de borrador
-- (documents.edit), prop/admin/asistente.
create or replace function public.log_document_word_generated(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
begin
  select * into v_doc from public.documents where id = p_document_id;
  if not found then
    return;
  end if;
  if not public.is_workspace_member(v_doc.workspace_id, array['propietario', 'administrador', 'asistente']) then
    return;
  end if;

  insert into public.document_activity
    (document_id, owner_id, workspace_id, actor_user_id, event_type, summary, metadata)
  values
    (p_document_id, auth.uid(), v_doc.workspace_id, auth.uid(), 'document_word_generated',
     'Documento Word generado', '{}'::jsonb);
end;
$$;

-- log_notarial_index_export: notarial_index.generate (prop/admin only).
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

  insert into public.notarial_index_exports
    (owner_id, workspace_id, format, from_date, to_date, row_count)
  values (
    auth.uid(), v_workspace_id, p_format, p_from, p_to, greatest(coalesce(p_row_count, 0), 0)
  );
end;
$$;

-- save_template_workspace / save_template_index_configuration /
-- save_template_index_mapping[_with_block_source]: templates.write
-- (prop/admin/asistente).

create or replace function public.save_template_workspace(
  p_template_id uuid,
  p_expected_updated_at timestamptz,
  p_name text,
  p_description text,
  p_status text,
  p_content_json jsonb,
  p_text_preview text,
  p_fields jsonb
)
returns table (template_id uuid, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_template_id uuid;
  v_current_updated_at timestamptz;
  v_result_updated_at timestamptz;
  v_template_changed integer := 0;
  v_fields_changed integer := 0;
  v_affected integer := 0;
  v_field jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_template_id is null then
    select workspace_id into v_workspace_id
      from public.workspace_members
     where user_id = v_user_id and status = 'active'
     limit 1;
  else
    select workspace_id into v_workspace_id from public.templates where id = p_template_id;
  end if;

  if v_workspace_id is null
    or not public.is_workspace_member(v_workspace_id, array['propietario', 'administrador', 'asistente']) then
    raise exception using errcode = '42501', message = 'workspace_membership_required';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 or length(btrim(p_name)) > 200 then
    raise exception using errcode = '22023', message = 'invalid_template_name';
  end if;
  if p_description is not null and length(btrim(p_description)) > 500 then
    raise exception using errcode = '22023', message = 'invalid_template_description';
  end if;
  if p_status is null or p_status not in ('draft', 'active', 'archived') then
    raise exception using errcode = '22023', message = 'invalid_template_status';
  end if;
  if p_content_json is null
    or jsonb_typeof(p_content_json) <> 'object'
    or octet_length(p_content_json::text) > 1000000 then
    raise exception using errcode = '22023', message = 'invalid_template_content';
  end if;
  if p_text_preview is not null and length(p_text_preview) > 300 then
    raise exception using errcode = '22023', message = 'invalid_template_preview';
  end if;
  if p_fields is null
    or jsonb_typeof(p_fields) <> 'array'
    or jsonb_array_length(p_fields) > 200 then
    raise exception using errcode = '22023', message = 'invalid_template_fields';
  end if;

  for v_field in select value from jsonb_array_elements(p_fields)
  loop
    if jsonb_typeof(v_field) <> 'object'
      or coalesce(v_field->>'field_key', '') !~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'
      or length(v_field->>'field_key') > 120
      or length(btrim(coalesce(v_field->>'label', ''))) = 0
      or length(btrim(v_field->>'label')) > 200
      or jsonb_typeof(v_field->'required') <> 'boolean'
      or coalesce(v_field->>'autofill_source', 'none') not in (
        'none', 'client_full_name', 'client_identification', 'client_address'
      )
      or coalesce(v_field->>'output_transform', 'none') not in (
        'none', 'digits_to_words', 'number_to_words'
      ) then
      raise exception using errcode = '22023', message = 'invalid_template_field';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_fields) as item(value)
    group by item.value->>'field_key'
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'duplicate_template_field';
  end if;

  if p_template_id is null then
    insert into public.templates (
      owner_id,
      workspace_id,
      name,
      description,
      status,
      content_json,
      text_preview
    ) values (
      v_user_id,
      v_workspace_id,
      btrim(p_name),
      nullif(btrim(coalesce(p_description, '')), ''),
      p_status,
      p_content_json,
      p_text_preview
    )
    returning templates.id, templates.updated_at
      into v_template_id, v_result_updated_at;
  else
    select templates.updated_at
      into v_current_updated_at
      from public.templates
      where templates.id = p_template_id
        and templates.workspace_id = v_workspace_id
      for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'template_not_found';
    end if;
    if p_expected_updated_at is null
      or v_current_updated_at <> p_expected_updated_at then
      raise exception using errcode = '40001', message = 'template_conflict';
    end if;

    v_template_id := p_template_id;
    update public.templates
      set name = btrim(p_name),
          description = nullif(btrim(coalesce(p_description, '')), ''),
          status = p_status,
          content_json = p_content_json,
          text_preview = p_text_preview
      where templates.id = v_template_id
        and templates.workspace_id = v_workspace_id
        and (
          templates.name,
          templates.description,
          templates.status,
          templates.content_json,
          templates.text_preview
        ) is distinct from (
          btrim(p_name),
          nullif(btrim(coalesce(p_description, '')), ''),
          p_status,
          p_content_json,
          p_text_preview
        )
      returning templates.updated_at into v_result_updated_at;
    get diagnostics v_template_changed = row_count;
  end if;

  delete from public.template_fields
    where template_fields.template_id = v_template_id
      and template_fields.workspace_id = v_workspace_id
      and not exists (
        select 1
        from jsonb_array_elements(p_fields) as desired(value)
        where desired.value->>'field_key' = template_fields.field_key
      );
  get diagnostics v_affected = row_count;
  v_fields_changed := v_fields_changed + v_affected;

  update public.template_fields
    set label = btrim(desired.value->>'label'),
        required = (desired.value->>'required')::boolean,
        sort_order = desired.ordinality - 1,
        field_type = 'text',
        autofill_source = coalesce(desired.value->>'autofill_source', 'none'),
        output_transform = coalesce(desired.value->>'output_transform', 'none')
    from jsonb_array_elements(p_fields) with ordinality as desired(value, ordinality)
    where template_fields.template_id = v_template_id
      and template_fields.workspace_id = v_workspace_id
      and template_fields.field_key = desired.value->>'field_key'
      and (
        template_fields.label,
        template_fields.required,
        template_fields.sort_order,
        template_fields.field_type,
        template_fields.autofill_source,
        template_fields.output_transform
      ) is distinct from (
        btrim(desired.value->>'label'),
        (desired.value->>'required')::boolean,
        (desired.ordinality - 1)::integer,
        'text',
        coalesce(desired.value->>'autofill_source', 'none'),
        coalesce(desired.value->>'output_transform', 'none')
      );
  get diagnostics v_affected = row_count;
  v_fields_changed := v_fields_changed + v_affected;

  insert into public.template_fields (
    owner_id,
    workspace_id,
    template_id,
    field_key,
    label,
    field_type,
    required,
    source,
    sort_order,
    autofill_source,
    output_transform
  )
  select
    v_user_id,
    v_workspace_id,
    v_template_id,
    desired.value->>'field_key',
    btrim(desired.value->>'label'),
    'text',
    (desired.value->>'required')::boolean,
    'manual',
    desired.ordinality - 1,
    coalesce(desired.value->>'autofill_source', 'none'),
    coalesce(desired.value->>'output_transform', 'none')
  from jsonb_array_elements(p_fields) with ordinality as desired(value, ordinality)
  where not exists (
    select 1
    from public.template_fields existing
    where existing.template_id = v_template_id
      and existing.workspace_id = v_workspace_id
      and existing.field_key = desired.value->>'field_key'
  );
  get diagnostics v_affected = row_count;
  v_fields_changed := v_fields_changed + v_affected;

  if p_template_id is not null and v_template_changed = 0 and v_fields_changed > 0 then
    update public.templates
      set updated_at = clock_timestamp()
      where templates.id = v_template_id
        and templates.workspace_id = v_workspace_id
      returning templates.updated_at into v_result_updated_at;
  elsif p_template_id is not null and v_template_changed = 0 then
    v_result_updated_at := v_current_updated_at;
  end if;

  return query select v_template_id, v_result_updated_at;
end;
$$;

create or replace function public.save_template_index_configuration(
  p_template_id uuid,
  p_party_separator text,
  p_fixed_suffix text,
  p_allow_empty boolean,
  p_fields jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_configuration_id uuid;
  v_field jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select workspace_id into v_workspace_id from public.templates where id = p_template_id;
  if v_workspace_id is null
    or not public.is_workspace_member(v_workspace_id, array['propietario', 'administrador', 'asistente']) then
    raise exception using errcode = 'P0002', message = 'template_not_found';
  end if;
  if p_party_separator is null
    or char_length(btrim(p_party_separator)) not between 1 and 30 then
    raise exception using errcode = '22023', message = 'invalid_party_separator';
  end if;
  if p_fixed_suffix is not null
    and char_length(btrim(p_fixed_suffix)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'invalid_fixed_suffix';
  end if;
  if p_fields is null
    or jsonb_typeof(p_fields) <> 'array'
    or jsonb_array_length(p_fields) > 50 then
    raise exception using errcode = '22023', message = 'invalid_index_fields';
  end if;
  if jsonb_array_length(p_fields) = 0 and not coalesce(p_allow_empty, false) then
    raise exception using errcode = '22023', message = 'empty_index_fields_not_confirmed';
  end if;

  for v_field in select value from jsonb_array_elements(p_fields)
  loop
    if jsonb_typeof(v_field) <> 'object'
      or coalesce(v_field->>'template_field_id', '') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      or coalesce(v_field->>'sort_order', '') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'invalid_index_field';
    end if;
    if not exists (
      select 1 from public.template_fields f
      where f.id = (v_field->>'template_field_id')::uuid
        and f.template_id = p_template_id
        and f.workspace_id = v_workspace_id
    ) then
      raise exception using errcode = '23503', message = 'template_field_not_found';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_fields) item(value)
    group by item.value->>'template_field_id'
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'duplicate_index_field';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_fields) item(value)
    group by (item.value->>'sort_order')::integer
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'duplicate_index_order';
  end if;

  insert into public.template_index_configurations (
    owner_id, workspace_id, template_id, party_separator, fixed_suffix, allow_empty, is_complete
  ) values (
    v_user_id,
    v_workspace_id,
    p_template_id,
    p_party_separator,
    nullif(btrim(coalesce(p_fixed_suffix, '')), ''),
    coalesce(p_allow_empty, false),
    true
  )
  on conflict (workspace_id, template_id) do update
    set party_separator = excluded.party_separator,
        fixed_suffix = excluded.fixed_suffix,
        allow_empty = excluded.allow_empty,
        is_complete = true
  returning id into v_configuration_id;

  delete from public.template_index_configuration_fields f
  where f.configuration_id = v_configuration_id;

  insert into public.template_index_configuration_fields (
    configuration_id, owner_id, workspace_id, template_id, template_field_id, sort_order
  )
  select
    v_configuration_id,
    v_user_id,
    v_workspace_id,
    p_template_id,
    (item.value->>'template_field_id')::uuid,
    (item.value->>'sort_order')::integer
  from jsonb_array_elements(p_fields) item(value);

  return v_configuration_id;
end;
$$;

create or replace function public.save_template_index_mapping(
  p_template_id uuid,
  p_simple_fields jsonb,
  p_party_separator text,
  p_fixed_suffix text,
  p_allow_empty boolean,
  p_party_fields jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_configuration_id uuid;
  v_field jsonb;
  v_instrument_number_field_id uuid;
  v_authorized_date_field_id uuid;
  v_authorized_time_field_id uuid;
  v_protocol_book_field_id uuid;
  v_initial_folio_field_id uuid;
  v_final_folio_field_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select workspace_id into v_workspace_id from public.templates where id = p_template_id;
  if v_workspace_id is null
    or not public.is_workspace_member(v_workspace_id, array['propietario', 'administrador', 'asistente']) then
    raise exception using errcode = 'P0002', message = 'template_not_found';
  end if;
  if p_simple_fields is null or jsonb_typeof(p_simple_fields) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_simple_index_fields';
  end if;
  if exists (
    select 1
    from jsonb_each(p_simple_fields) entry
    where entry.key not in (
      'instrument_number', 'authorized_date', 'authorized_time',
      'protocol_book', 'initial_folio', 'final_folio'
    )
      or (
        entry.value <> 'null'::jsonb
        and (
          jsonb_typeof(entry.value) <> 'string'
          or (entry.value #>> '{}') !~
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        )
      )
  ) then
    raise exception using errcode = '22023', message = 'invalid_simple_index_field';
  end if;
  if exists (
    select 1
    from jsonb_each(p_simple_fields) entry
    where entry.value <> 'null'::jsonb
    group by entry.value #>> '{}'
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'duplicate_simple_index_field';
  end if;

  v_instrument_number_field_id := (p_simple_fields->>'instrument_number')::uuid;
  v_authorized_date_field_id := (p_simple_fields->>'authorized_date')::uuid;
  v_authorized_time_field_id := (p_simple_fields->>'authorized_time')::uuid;
  v_protocol_book_field_id := (p_simple_fields->>'protocol_book')::uuid;
  v_initial_folio_field_id := (p_simple_fields->>'initial_folio')::uuid;
  v_final_folio_field_id := (p_simple_fields->>'final_folio')::uuid;

  if exists (
    select 1
    from unnest(array[
      v_instrument_number_field_id,
      v_authorized_date_field_id,
      v_authorized_time_field_id,
      v_protocol_book_field_id,
      v_initial_folio_field_id,
      v_final_folio_field_id
    ]) field_id
    where field_id is not null
      and not exists (
        select 1 from public.template_fields f
        where f.id = field_id
          and f.template_id = p_template_id
          and f.workspace_id = v_workspace_id
      )
  ) then
    raise exception using errcode = '23503', message = 'template_field_not_found';
  end if;
  if p_party_separator is null
    or char_length(btrim(p_party_separator)) not between 1 and 30 then
    raise exception using errcode = '22023', message = 'invalid_party_separator';
  end if;
  if p_fixed_suffix is not null
    and char_length(btrim(p_fixed_suffix)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'invalid_fixed_suffix';
  end if;
  if p_party_fields is null
    or jsonb_typeof(p_party_fields) <> 'array'
    or jsonb_array_length(p_party_fields) > 50 then
    raise exception using errcode = '22023', message = 'invalid_index_fields';
  end if;
  if jsonb_array_length(p_party_fields) = 0
    and not coalesce(p_allow_empty, false) then
    raise exception using errcode = '22023', message = 'empty_index_fields_not_confirmed';
  end if;

  for v_field in select value from jsonb_array_elements(p_party_fields)
  loop
    if jsonb_typeof(v_field) <> 'object'
      or coalesce(v_field->>'template_field_id', '') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      or coalesce(v_field->>'sort_order', '') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'invalid_index_field';
    end if;
    if not exists (
      select 1 from public.template_fields f
      where f.id = (v_field->>'template_field_id')::uuid
        and f.template_id = p_template_id
        and f.workspace_id = v_workspace_id
    ) then
      raise exception using errcode = '23503', message = 'template_field_not_found';
    end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(p_party_fields) item(value)
    group by item.value->>'template_field_id' having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'duplicate_index_field';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_party_fields) item(value)
    group by (item.value->>'sort_order')::integer having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'duplicate_index_order';
  end if;

  insert into public.template_index_configurations (
    owner_id,
    workspace_id,
    template_id,
    instrument_number_field_id,
    authorized_date_field_id,
    authorized_time_field_id,
    protocol_book_field_id,
    initial_folio_field_id,
    final_folio_field_id,
    party_separator,
    fixed_suffix,
    allow_empty,
    is_complete,
    invalid_mappings
  ) values (
    v_user_id,
    v_workspace_id,
    p_template_id,
    v_instrument_number_field_id,
    v_authorized_date_field_id,
    v_authorized_time_field_id,
    v_protocol_book_field_id,
    v_initial_folio_field_id,
    v_final_folio_field_id,
    p_party_separator,
    nullif(btrim(coalesce(p_fixed_suffix, '')), ''),
    coalesce(p_allow_empty, false),
    true,
    '{}'
  )
  on conflict (workspace_id, template_id) do update set
    instrument_number_field_id = excluded.instrument_number_field_id,
    authorized_date_field_id = excluded.authorized_date_field_id,
    authorized_time_field_id = excluded.authorized_time_field_id,
    protocol_book_field_id = excluded.protocol_book_field_id,
    initial_folio_field_id = excluded.initial_folio_field_id,
    final_folio_field_id = excluded.final_folio_field_id,
    party_separator = excluded.party_separator,
    fixed_suffix = excluded.fixed_suffix,
    allow_empty = excluded.allow_empty,
    is_complete = true,
    invalid_mappings = '{}'
  returning id into v_configuration_id;

  delete from public.template_index_configuration_fields f
  where f.configuration_id = v_configuration_id;

  insert into public.template_index_configuration_fields (
    configuration_id, owner_id, workspace_id, template_id, template_field_id, sort_order
  )
  select
    v_configuration_id,
    v_user_id,
    v_workspace_id,
    p_template_id,
    (item.value->>'template_field_id')::uuid,
    (item.value->>'sort_order')::integer
  from jsonb_array_elements(p_party_fields) item(value);

  return v_configuration_id;
end;
$$;

create or replace function public.save_template_index_mapping_with_block_source(
  p_template_id uuid,
  p_simple_fields jsonb,
  p_authorized_time_option_block_id text,
  p_party_separator text,
  p_fixed_suffix text,
  p_allow_empty boolean,
  p_party_fields jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_configuration_id uuid;
  v_block_id text := nullif(btrim(coalesce(p_authorized_time_option_block_id, '')), '');
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select workspace_id into v_workspace_id from public.templates where id = p_template_id;
  if v_workspace_id is null
    or not public.is_workspace_member(v_workspace_id, array['propietario', 'administrador', 'asistente']) then
    raise exception using errcode = 'P0002', message = 'template_not_found';
  end if;
  if v_block_id is not null and char_length(v_block_id) > 120 then
    raise exception using errcode = '22023', message = 'invalid_option_block';
  end if;
  if v_block_id is not null and p_simple_fields->>'authorized_time' is not null then
    raise exception using errcode = '22023', message = 'duplicate_time_source';
  end if;
  if v_block_id is not null and not exists (
    select 1
    from public.templates t
    cross join lateral jsonb_array_elements(
      coalesce(t.content_json->'doc'->'content', '[]'::jsonb)
    ) paragraph
    cross join lateral jsonb_array_elements(
      coalesce(paragraph->'content', '[]'::jsonb)
    ) node
    where t.id = p_template_id
      and t.workspace_id = v_workspace_id
      and node->>'type' = 'optionBlock'
      and node->'attrs'->>'blockId' = v_block_id
      and node->'attrs'->'structuredOutput'->>'type' = 'time'
  ) then
    raise exception using errcode = '23503', message = 'option_block_not_found';
  end if;

  update public.template_index_configurations
     set authorized_time_option_block_id = null
   where workspace_id = v_workspace_id
     and template_id = p_template_id;

  v_configuration_id := public.save_template_index_mapping(
    p_template_id,
    p_simple_fields,
    p_party_separator,
    p_fixed_suffix,
    p_allow_empty,
    p_party_fields
  );

  update public.template_index_configurations
     set authorized_time_option_block_id = v_block_id
   where id = v_configuration_id
     and workspace_id = v_workspace_id;

  return v_configuration_id;
end;
$$;

-- ==================================================== RPCs: gestión de equipo

-- Jerarquía aplicada uniformemente en las 5 RPCs de abajo:
--   * el rol `propietario` es inmutable — nadie puede cambiarlo, suspenderlo
--     ni removerlo (ni siquiera otro administrador).
--   * `administrador` puede gestionar `asistente`/`solo_lectura`, pero NO a
--     otro `administrador` ni al `propietario` (evita que un admin remueva a
--     un par o se autopromueva).
--   * `propietario` puede gestionar cualquier no-propietario.
create or replace function public.assert_can_manage_target_member(
  p_caller_role text,
  p_target_role text
) returns void
language plpgsql
immutable
as $$
begin
  if p_target_role = 'propietario' then
    raise exception 'the propietario role cannot be managed' using errcode = '42501';
  end if;
  if p_caller_role = 'administrador' and p_target_role = 'administrador' then
    raise exception 'administrador cannot manage another administrador' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_can_manage_target_member(text, text) from public, anon, authenticated;

-- invite_workspace_member: crea la membresía 'invited' para un usuario que
-- YA existe en auth.users (el Server Action de Node debe haberlo creado
-- primero vía supabase.auth.admin.inviteUserByEmail — la Admin API no es
-- invocable desde SQL). Rechaza duplicados (ya es miembro de este Workspace
-- en cualquier estado) y valida rol.
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

  insert into public.workspace_members (workspace_id, user_id, role, status, invited_by)
  values (v_workspace_id, p_user_id, p_role, 'invited', v_uid)
  returning id into v_member_id;

  insert into public.workspace_activity (workspace_id, actor_user_id, target_user_id, event_type, metadata)
  values (v_workspace_id, v_uid, p_user_id, 'member_invited', jsonb_build_object('role', p_role));

  return v_member_id;
end;
$$;

revoke all on function public.invite_workspace_member(uuid, text) from public, anon, authenticated;
grant execute on function public.invite_workspace_member(uuid, text) to authenticated;

-- accept_workspace_invitation: se ejecuta como el propio usuario invitado,
-- ya autenticado (tras seguir el enlace del correo y fijar su contraseña).
-- Activa su membresía y elimina el Workspace personal que el bootstrap de
-- la Iteración 4 le creó automáticamente al existir su fila en auth.users —
-- así cada usuario invitado termina perteneciendo a exactamente un
-- Workspace real, sin necesitar un selector de "Workspace actual" en la UI.
create or replace function public.accept_workspace_invitation(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
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

  insert into public.workspace_activity (workspace_id, actor_user_id, target_user_id, event_type, metadata)
  values (p_workspace_id, v_uid, v_uid, 'member_invitation_accepted', '{}'::jsonb);

  if p_workspace_id <> v_uid then
    delete from public.workspace_members where workspace_id = v_uid and user_id = v_uid;
  end if;
end;
$$;

revoke all on function public.accept_workspace_invitation(uuid) from public, anon, authenticated;
grant execute on function public.accept_workspace_invitation(uuid) to authenticated;

-- change_workspace_member_role
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

  insert into public.workspace_activity (workspace_id, actor_user_id, target_user_id, event_type, metadata)
  values (p_workspace_id, v_uid, p_user_id, 'member_role_changed',
    jsonb_build_object('previousRole', v_target_role, 'newRole', p_role));
end;
$$;

revoke all on function public.change_workspace_member_role(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.change_workspace_member_role(uuid, uuid, text) to authenticated;

-- suspend_workspace_member / reactivate_workspace_member
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

  insert into public.workspace_activity (workspace_id, actor_user_id, target_user_id, event_type, metadata)
  values (p_workspace_id, v_uid, p_user_id, 'member_suspended', '{}'::jsonb);
end;
$$;

revoke all on function public.suspend_workspace_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.suspend_workspace_member(uuid, uuid) to authenticated;

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

  insert into public.workspace_activity (workspace_id, actor_user_id, target_user_id, event_type, metadata)
  values (p_workspace_id, v_uid, p_user_id, 'member_reactivated', '{}'::jsonb);
end;
$$;

revoke all on function public.reactivate_workspace_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reactivate_workspace_member(uuid, uuid) to authenticated;

-- remove_workspace_member: elimina la membresía (no borra auditoría — las
-- filas de *_activity referencian actor_user_id sin cascada desde
-- workspace_members).
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

  insert into public.workspace_activity (workspace_id, actor_user_id, target_user_id, event_type, metadata)
  values (p_workspace_id, v_uid, p_user_id, 'member_removed', jsonb_build_object('previousRole', v_target_role));

  delete from public.workspace_members
   where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$;

revoke all on function public.remove_workspace_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;

-- ==================================================== views: workspace_id

-- Ambas vistas se apoyaban en `owner_id` tanto para exponer la columna como
-- para los JOIN internos — correcto solo mientras owner_id y workspace_id
-- coincidían (Iteración 4). Un asistente que crea una Escritura vinculada a
-- un Cliente que el propietario ya tenía (owner_id distinto, mismo
-- workspace_id) haría que estos JOIN perdieran la fila enlazada. Se
-- reescriben para unir por workspace_id (el alcance real) y se agrega
-- workspace_id a la lista de columnas — al final, porque `create or
-- replace view` no permite reordenar columnas existentes.

create or replace view public.receivable_entries
with (security_invoker = on)
as
select
  r.id,
  r.owner_id,
  r.client_id,
  r.document_id,
  r.concept,
  r.currency,
  r.amount_total,
  r.issued_at,
  r.due_at,
  r.created_at,
  r.updated_at,
  r.client_name_snapshot as client_name,
  d.title as document_title,
  coalesce(pay.paid, 0)::numeric(14, 2) as paid_amount,
  greatest(r.amount_total - coalesce(pay.paid, 0), 0)::numeric(14, 2) as balance_due,
  case
    when coalesce(pay.paid, 0) >= r.amount_total then 'paid'
    when r.due_at is not null
      and r.due_at < (now() at time zone 'America/Costa_Rica')::date
      and r.amount_total > coalesce(pay.paid, 0) then 'overdue'
    when coalesce(pay.paid, 0) > 0 then 'partial'
    else 'pending'
  end as status,
  r.workspace_id
from public.receivables r
left join public.documents d on d.id = r.document_id and d.workspace_id = r.workspace_id
left join (
  select receivable_id, sum(amount) as paid
  from public.receivable_payments
  where status = 'active'
  group by receivable_id
) pay on pay.receivable_id = r.id;

comment on view public.receivable_entries is
  'Cuentas por cobrar con saldo y estado derivados (paid > overdue > partial > pending), sumando pagos activos. El nombre del cliente viene siempre del snapshot (registrado o libre). Enlaces (Escritura) unidos por workspace_id, no owner_id, para que sean visibles sin importar qué miembro del equipo creó cada fila. security_invoker respeta RLS.';

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
  coalesce(nullif(btrim(m.act_name_override), ''), m.act_name_snapshot) as act_name,
  m.generated_parties,
  m.parties_override,
  coalesce(nullif(btrim(m.parties_override), ''), m.generated_parties) as parties,
  m.version,
  extract(year from (m.authorized_at at time zone 'America/Costa_Rica'))::integer as period_year,
  extract(month from (m.authorized_at at time zone 'America/Costa_Rica'))::integer as period_month,
  case
    when extract(day from (m.authorized_at at time zone 'America/Costa_Rica')) between 1 and 15 then 'FIRST_HALF'
    when m.authorized_at is not null then 'SECOND_HALF'
    else null
  end as period_half,
  (m.document_id is not null) as has_metadata,
  (
    m.instrument_number is not null
    and m.authorized_at is not null
    and coalesce(btrim(m.protocol_book), '') <> ''
    and coalesce(btrim(m.initial_folio), '') <> ''
    and coalesce(btrim(m.final_folio), '') <> ''
    and coalesce(btrim(coalesce(m.act_name_override, m.act_name_snapshot)), '') <> ''
    and coalesce(btrim(coalesce(m.parties_override, m.generated_parties)), '') <> ''
  ) as is_complete,
  d.workspace_id
from public.documents d
left join public.document_notarial_metadata m
  on m.document_id = d.id and m.workspace_id = d.workspace_id
left join public.clients c
  on c.id = d.client_id and c.workspace_id = d.workspace_id
where d.status = 'final';

comment on view public.notarial_index_entries is
  'Workspace-scoped finalized escrituras with structured notarial metadata, snapshots, overrides, fortnight and derived completeness. Enlaces unidos por workspace_id, no owner_id, para que sean visibles sin importar qué miembro del equipo creó cada fila.';
