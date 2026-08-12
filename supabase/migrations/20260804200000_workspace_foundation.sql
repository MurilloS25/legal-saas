-- Fundación de Workspaces y membresías (Iteración 4).
--
-- Diseño completo en docs/WORKSPACE_MULTIUSER_ARCHITECTURE.md (Iteración 3,
-- solo diagnóstico). Esta migración implementa únicamente la "Fase A"
-- (aditiva) + el corte de RLS a membresía, con un solo rol funcional
-- (`propietario`) — sin invitaciones, sin permisos personalizados, sin
-- `notary_profiles` todavía (eso llega en una iteración posterior, cuando la
-- identidad profesional deba separarse de quién ejecuta la acción).
--
-- Decisión clave que simplifica todo lo demás: el `workspaces.id` de cada
-- Workspace "bootstrap" (uno por cada usuario existente, y uno automático
-- para cada usuario futuro) es EXACTAMENTE el mismo uuid que `auth.users.id`
-- del propietario. Esto significa que, mientras solo exista el rol
-- `propietario` (esta iteración), `workspace_id` es una función determinista
-- de `owner_id` — se modela como columna GENERATED ALWAYS AS (owner_id)
-- STORED, así que:
--   * Ningún Server Action, RPC ni trigger existente necesita cambiar para
--     poblarla — se calcula sola en cada INSERT.
--   * Es estructuralmente imposible manipularla desde INSERT/UPDATE
--     (Postgres rechaza cualquier valor explícito en una columna generada).
--   * El backfill de filas existentes ocurre automáticamente al agregar la
--     columna (no hace falta un UPDATE separado).
-- Cuando una iteración futura agregue asistentes reales, `workspace_id` deja
-- de poder ser generada desde `owner_id` (un asistente no es dueño de un
-- Workspace) — ese es el momento de convertirla en columna independiente
-- (`alter table ... alter column workspace_id drop expression`), migración
-- explícita y separada, no parte de esta.
--
-- Qué SÍ cambia de comportamiento real en esta iteración: RLS deja de
-- confiar únicamente en `owner_id = auth.uid()` y pasa a exigir membresía
-- ACTIVA (`workspace_members.status = 'active'`) — la primera vez que
-- "suspender el acceso de un usuario" es algo que el sistema puede hacer sin
-- tocar Supabase Auth. Las funciones SECURITY DEFINER que llaman los propios
-- Server Actions (y que por definición evitan RLS) reciben el mismo chequeo
-- explícito, porque de otro modo serían la puerta trasera que RLS ya no deja
-- abierta en las tablas.

-- ============================================================ workspaces

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_name_not_blank check (btrim(name) <> '')
);

comment on table public.workspaces is
  'Oficina notarial. En esta iteración, cada Workspace tiene exactamente un miembro (el propietario) y su id coincide con el auth.users.id de ese propietario — ver comentario de cabecera de la migración.';

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

-- ======================================================= workspace_members

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'propietario'
    check (role in ('propietario', 'administrador', 'asistente', 'solo_lectura')),
  status text not null default 'active'
    check (status in ('invited', 'active', 'revoked')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_members_workspace_user_key unique (workspace_id, user_id)
);

comment on table public.workspace_members is
  'Membresía de un usuario en un Workspace. Solo el rol propietario se usa funcionalmente en esta iteración (sin invitaciones todavía); administrador/asistente/solo_lectura ya son valores válidos para no requerir otra migración cuando se implementen.';

create trigger workspace_members_set_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

create index workspace_members_user_id_idx on public.workspace_members (user_id);
create index workspace_members_workspace_id_idx on public.workspace_members (workspace_id);
create index workspace_members_active_idx
  on public.workspace_members (workspace_id, user_id) where status = 'active';

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- ---------------------------------------------------------------- helper

-- Único punto de verdad para "¿auth.uid() es miembro activo de este
-- Workspace (opcionalmente con uno de estos roles)?". Reemplaza el patrón
-- repetido `owner_id = auth.uid()` en RLS y se reutiliza también dentro de
-- las funciones SECURITY DEFINER que antes solo miraban owner_id.
create or replace function public.is_workspace_member(
  p_workspace_id uuid,
  p_roles text[] default array['propietario', 'administrador', 'asistente', 'solo_lectura']
) returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(p_roles)
  );
$$;

revoke all on function public.is_workspace_member(uuid, text[]) from public, anon;
grant execute on function public.is_workspace_member(uuid, text[]) to authenticated;

-- workspaces/workspace_members RLS: cualquier miembro activo puede leer su
-- propio Workspace y la lista de sus propios compañeros; solo el propietario
-- puede administrar la membresía (gestión completa de miembros queda para la
-- iteración de invitaciones — aquí solo se protege la tabla).
create policy "workspaces_select_member"
on public.workspaces for select to authenticated
using (public.is_workspace_member(id));

create policy "workspace_members_select_same_workspace"
on public.workspace_members for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "workspace_members_manage_owner"
on public.workspace_members for all to authenticated
using (public.is_workspace_member(workspace_id, array['propietario']))
with check (public.is_workspace_member(workspace_id, array['propietario']));

-- ============================================================== bootstrap

-- Un Workspace propio por cada usuario ya existente (tenga o no datos
-- todavía), para que "cada usuario existente recibe un Workspace propio" se
-- cumpla sin excepciones — no solo quienes ya crearon algo.
insert into public.workspaces (id, name)
select
  u.id,
  coalesce(nullif(btrim(lp.full_name), ''), split_part(u.email, '@', 1), 'Mi oficina')
from auth.users u
left join public.lawyer_profiles lp on lp.owner_id = u.id;

insert into public.workspace_members (workspace_id, user_id, role, status)
select id, id, 'propietario', 'active' from public.workspaces;

-- Usuarios futuros: el mismo bootstrap, automático, para que ningún usuario
-- nuevo quede sin Workspace antes de que exista un flujo de invitación real
-- (Iteración 5/6). Patrón estándar de Supabase (trigger en auth.users).
create or replace function public.bootstrap_workspace_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.workspaces (id, name)
  values (new.id, coalesce(nullif(btrim(split_part(new.email, '@', 1)), ''), 'Mi oficina'));

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (new.id, new.id, 'propietario', 'active');

  return new;
end;
$$;

revoke all on function public.bootstrap_workspace_for_new_user() from public, anon, authenticated;

create trigger auth_users_bootstrap_workspace
after insert on auth.users
for each row execute function public.bootstrap_workspace_for_new_user();

-- Limpieza: si el último miembro de un Workspace se elimina (hoy, siempre el
-- propietario — auth.users on delete cascade ya borra su workspace_members),
-- el Workspace huérfano también se elimina. Los datos de negocio ya se
-- eliminan por su propio owner_id...on delete cascade existente; esto solo
-- evita dejar la fila de workspaces huérfana para siempre.
create or replace function public.cleanup_orphaned_workspace()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.workspace_members where workspace_id = old.workspace_id
  ) then
    delete from public.workspaces where id = old.workspace_id;
  end if;
  return old;
end;
$$;

revoke all on function public.cleanup_orphaned_workspace() from public, anon, authenticated;

create trigger workspace_members_cleanup_orphaned_workspace
after delete on public.workspace_members
for each row execute function public.cleanup_orphaned_workspace();

-- ==================================================== workspace_id columns

-- 14 tablas de negocio activas (se excluyen document_metadata/notarial_records:
-- andamiaje sin uso real, ver docs/WORKSPACE_MULTIUSER_ARCHITECTURE.md §1.1).
-- Mismo patrón en cada una: columna generada + FK + índice + NOT NULL.

alter table public.lawyer_profiles add column workspace_id uuid generated always as (owner_id) stored;
alter table public.lawyer_profiles add constraint lawyer_profiles_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.lawyer_profiles alter column workspace_id set not null;
create index lawyer_profiles_workspace_id_idx on public.lawyer_profiles (workspace_id);

alter table public.document_settings add column workspace_id uuid generated always as (owner_id) stored;
alter table public.document_settings add constraint document_settings_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.document_settings alter column workspace_id set not null;
create index document_settings_workspace_id_idx on public.document_settings (workspace_id);

alter table public.clients add column workspace_id uuid generated always as (owner_id) stored;
alter table public.clients add constraint clients_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.clients alter column workspace_id set not null;
create index clients_workspace_id_idx on public.clients (workspace_id);

alter table public.templates add column workspace_id uuid generated always as (owner_id) stored;
alter table public.templates add constraint templates_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.templates alter column workspace_id set not null;
create index templates_workspace_id_idx on public.templates (workspace_id);

alter table public.template_fields add column workspace_id uuid generated always as (owner_id) stored;
alter table public.template_fields add constraint template_fields_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.template_fields alter column workspace_id set not null;
create index template_fields_workspace_id_idx on public.template_fields (workspace_id);

alter table public.template_index_configurations add column workspace_id uuid generated always as (owner_id) stored;
alter table public.template_index_configurations add constraint template_index_configurations_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.template_index_configurations alter column workspace_id set not null;
create index template_index_configurations_workspace_id_idx on public.template_index_configurations (workspace_id);

alter table public.template_index_configuration_fields add column workspace_id uuid generated always as (owner_id) stored;
alter table public.template_index_configuration_fields add constraint template_index_configuration_fields_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.template_index_configuration_fields alter column workspace_id set not null;
create index template_index_configuration_fields_workspace_id_idx on public.template_index_configuration_fields (workspace_id);

alter table public.documents add column workspace_id uuid generated always as (owner_id) stored;
alter table public.documents add constraint documents_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.documents alter column workspace_id set not null;
create index documents_workspace_id_idx on public.documents (workspace_id);

alter table public.document_activity add column workspace_id uuid generated always as (owner_id) stored;
alter table public.document_activity add constraint document_activity_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.document_activity alter column workspace_id set not null;
create index document_activity_workspace_id_idx on public.document_activity (workspace_id);

alter table public.document_notarial_metadata add column workspace_id uuid generated always as (owner_id) stored;
alter table public.document_notarial_metadata add constraint document_notarial_metadata_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.document_notarial_metadata alter column workspace_id set not null;
create index document_notarial_metadata_workspace_id_idx on public.document_notarial_metadata (workspace_id);

alter table public.notarial_index_exports add column workspace_id uuid generated always as (owner_id) stored;
alter table public.notarial_index_exports add constraint notarial_index_exports_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.notarial_index_exports alter column workspace_id set not null;
create index notarial_index_exports_workspace_id_idx on public.notarial_index_exports (workspace_id);

alter table public.receivables add column workspace_id uuid generated always as (owner_id) stored;
alter table public.receivables add constraint receivables_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.receivables alter column workspace_id set not null;
create index receivables_workspace_id_idx on public.receivables (workspace_id);

alter table public.receivable_activity add column workspace_id uuid generated always as (owner_id) stored;
alter table public.receivable_activity add constraint receivable_activity_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.receivable_activity alter column workspace_id set not null;
create index receivable_activity_workspace_id_idx on public.receivable_activity (workspace_id);

alter table public.receivable_payments add column workspace_id uuid generated always as (owner_id) stored;
alter table public.receivable_payments add constraint receivable_payments_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.receivable_payments alter column workspace_id set not null;
create index receivable_payments_workspace_id_idx on public.receivable_payments (workspace_id);

-- ============================================================ RLS cutover

-- Cada tabla: se sustituye SOLO la condición externa (antes `owner_id =
-- auth.uid()`, ahora `is_workspace_member(workspace_id, ...)`). Los `exists`
-- anidados que validan relaciones padre/hijo (p. ej. "el template al que
-- apunta este template_field es mío") se dejan intactos con su forma
-- `owner_id = auth.uid()` original: siguen siendo correctos porque
-- workspace_id es una función determinista de owner_id en esta iteración, y
-- tocarlos no aporta nada hoy — quedan documentados aquí como el punto que
-- una iteración futura (asistentes reales) sí tendrá que revisar.

-- ---- lawyer_profiles

drop policy "lawyer_profiles_select_own" on public.lawyer_profiles;
drop policy "lawyer_profiles_insert_own" on public.lawyer_profiles;
drop policy "lawyer_profiles_update_own" on public.lawyer_profiles;
drop policy "lawyer_profiles_delete_own" on public.lawyer_profiles;

create policy "lawyer_profiles_select_workspace"
on public.lawyer_profiles for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "lawyer_profiles_insert_workspace"
on public.lawyer_profiles for insert to authenticated
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario']));

create policy "lawyer_profiles_update_workspace"
on public.lawyer_profiles for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario']));

create policy "lawyer_profiles_delete_workspace"
on public.lawyer_profiles for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario']));

-- ---- document_settings

drop policy "document_settings_select_own" on public.document_settings;
drop policy "document_settings_insert_own" on public.document_settings;
drop policy "document_settings_update_own" on public.document_settings;
drop policy "document_settings_delete_own" on public.document_settings;

create policy "document_settings_select_workspace"
on public.document_settings for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "document_settings_insert_workspace"
on public.document_settings for insert to authenticated
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario']));

create policy "document_settings_update_workspace"
on public.document_settings for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario']));

create policy "document_settings_delete_workspace"
on public.document_settings for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario']));

-- ---- clients

drop policy "clients_select_own" on public.clients;
drop policy "clients_insert_own" on public.clients;
drop policy "clients_update_own" on public.clients;
drop policy "clients_delete_own" on public.clients;

create policy "clients_select_workspace"
on public.clients for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "clients_insert_workspace"
on public.clients for insert to authenticated
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario']));

create policy "clients_update_workspace"
on public.clients for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario']));

create policy "clients_delete_workspace"
on public.clients for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario']));

-- ---- templates

drop policy "templates_select_own" on public.templates;
drop policy "templates_insert_own" on public.templates;
drop policy "templates_update_own" on public.templates;
drop policy "templates_delete_own" on public.templates;

create policy "templates_select_workspace"
on public.templates for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "templates_insert_workspace"
on public.templates for insert to authenticated
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario']));

create policy "templates_update_workspace"
on public.templates for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario']));

create policy "templates_delete_workspace"
on public.templates for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario']));

-- ---- template_fields

drop policy "template_fields_select_own" on public.template_fields;
drop policy "template_fields_insert_own" on public.template_fields;
drop policy "template_fields_update_own" on public.template_fields;
drop policy "template_fields_delete_own" on public.template_fields;

create policy "template_fields_select_workspace"
on public.template_fields for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "template_fields_insert_workspace"
on public.template_fields for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario'])
  and exists (
    select 1 from public.templates
    where templates.id = template_fields.template_id
      and templates.owner_id = auth.uid()
  )
);

create policy "template_fields_update_workspace"
on public.template_fields for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario'])
  and exists (
    select 1 from public.templates
    where templates.id = template_fields.template_id
      and templates.owner_id = auth.uid()
  )
);

create policy "template_fields_delete_workspace"
on public.template_fields for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario']));

-- ---- template_index_configurations

drop policy "template_index_config_select_own" on public.template_index_configurations;
drop policy "template_index_config_insert_own" on public.template_index_configurations;
drop policy "template_index_config_update_own" on public.template_index_configurations;
drop policy "template_index_config_delete_own" on public.template_index_configurations;

create policy "template_index_config_select_workspace"
on public.template_index_configurations for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "template_index_config_insert_workspace"
on public.template_index_configurations for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario'])
  and exists (
    select 1 from public.templates t
    where t.id = template_id and t.owner_id = auth.uid()
  )
);

create policy "template_index_config_update_workspace"
on public.template_index_configurations for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario'])
  and exists (
    select 1 from public.templates t
    where t.id = template_id and t.owner_id = auth.uid()
  )
);

create policy "template_index_config_delete_workspace"
on public.template_index_configurations for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario']));

-- ---- template_index_configuration_fields

drop policy "template_index_fields_select_own" on public.template_index_configuration_fields;
drop policy "template_index_fields_insert_own" on public.template_index_configuration_fields;
drop policy "template_index_fields_update_own" on public.template_index_configuration_fields;
drop policy "template_index_fields_delete_own" on public.template_index_configuration_fields;

create policy "template_index_fields_select_workspace"
on public.template_index_configuration_fields for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "template_index_fields_insert_workspace"
on public.template_index_configuration_fields for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario'])
  and exists (
    select 1 from public.template_index_configurations c
    where c.id = configuration_id and c.template_id = template_id and c.owner_id = auth.uid()
  )
  and exists (
    select 1 from public.template_fields f
    where f.id = template_field_id and f.template_id = template_id and f.owner_id = auth.uid()
  )
);

create policy "template_index_fields_update_workspace"
on public.template_index_configuration_fields for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario'])
  and exists (
    select 1 from public.template_index_configurations c
    where c.id = configuration_id and c.template_id = template_id and c.owner_id = auth.uid()
  )
  and exists (
    select 1 from public.template_fields f
    where f.id = template_field_id and f.template_id = template_id and f.owner_id = auth.uid()
  )
);

create policy "template_index_fields_delete_workspace"
on public.template_index_configuration_fields for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario']));

-- ---- documents

drop policy "documents_select_own" on public.documents;
drop policy "documents_insert_own" on public.documents;
drop policy "documents_update_own" on public.documents;
drop policy "documents_delete_own" on public.documents;

create policy "documents_select_workspace"
on public.documents for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "documents_insert_workspace"
on public.documents for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario'])
  and exists (
    select 1 from public.templates
    where templates.id = documents.template_id and templates.owner_id = auth.uid()
  )
);

create policy "documents_update_workspace"
on public.documents for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario'])
  and exists (
    select 1 from public.templates
    where templates.id = documents.template_id and templates.owner_id = auth.uid()
  )
);

-- Conserva la regla de la Iteración previa: una Escritura finalizada no se
-- puede eliminar directamente (hay que reabrirla primero).
create policy "documents_delete_workspace"
on public.documents for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario']) and status <> 'final');

-- ---- document_activity (solo lectura; se escribe vía trigger/RPC definer)

drop policy "document_activity_select_own" on public.document_activity;

create policy "document_activity_select_workspace"
on public.document_activity for select to authenticated
using (public.is_workspace_member(workspace_id));

-- ---- document_notarial_metadata

drop policy "dnm_select_own" on public.document_notarial_metadata;
drop policy "dnm_insert_own" on public.document_notarial_metadata;
drop policy "dnm_update_own" on public.document_notarial_metadata;
drop policy "dnm_delete_own" on public.document_notarial_metadata;

create policy "dnm_select_workspace"
on public.document_notarial_metadata for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "dnm_insert_workspace"
on public.document_notarial_metadata for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario'])
  and exists (
    select 1 from public.documents
    where documents.id = document_notarial_metadata.document_id and documents.owner_id = auth.uid()
  )
);

create policy "dnm_update_workspace"
on public.document_notarial_metadata for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id, array['propietario']));

create policy "dnm_delete_workspace"
on public.document_notarial_metadata for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario']));

-- ---- notarial_index_exports (sin insert/update directos)

drop policy "nie_select_own" on public.notarial_index_exports;
drop policy "nie_delete_own" on public.notarial_index_exports;

create policy "nie_select_workspace"
on public.notarial_index_exports for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "nie_delete_workspace"
on public.notarial_index_exports for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario']));

-- ---- receivables

drop policy "receivables_select_own" on public.receivables;
drop policy "receivables_insert_own" on public.receivables;
drop policy "receivables_update_own" on public.receivables;
drop policy "receivables_delete_own" on public.receivables;

create policy "receivables_select_workspace"
on public.receivables for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "receivables_insert_workspace"
on public.receivables for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario'])
  and (
    client_id is null
    or exists (select 1 from public.clients where clients.id = receivables.client_id and clients.owner_id = auth.uid())
  )
  and (
    document_id is null
    or exists (select 1 from public.documents where documents.id = receivables.document_id and documents.owner_id = auth.uid())
  )
);

create policy "receivables_update_workspace"
on public.receivables for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  owner_id = auth.uid()
  and public.is_workspace_member(workspace_id, array['propietario'])
  and (
    client_id is null
    or exists (select 1 from public.clients where clients.id = receivables.client_id and clients.owner_id = auth.uid())
  )
  and (
    document_id is null
    or exists (select 1 from public.documents where documents.id = receivables.document_id and documents.owner_id = auth.uid())
  )
);

create policy "receivables_delete_workspace"
on public.receivables for delete to authenticated
using (public.is_workspace_member(workspace_id, array['propietario']));

-- ---- receivable_activity (solo lectura)

drop policy "ra_select_own" on public.receivable_activity;

create policy "ra_select_workspace"
on public.receivable_activity for select to authenticated
using (public.is_workspace_member(workspace_id));

-- ---- receivable_payments (solo lectura; escritura solo vía RPC definer)

drop policy "rp_select_own" on public.receivable_payments;

create policy "rp_select_workspace"
on public.receivable_payments for select to authenticated
using (public.is_workspace_member(workspace_id));

-- ==================================================== RPCs: SECURITY DEFINER

-- Estas funciones evitan RLS por definición (por eso son SECURITY DEFINER),
-- así que RLS-por-membresía en las tablas NO las protege automáticamente —
-- son la puerta trasera que un usuario con membresía suspendida podría
-- seguir usando si no se revisan aquí también. Se agrega el mismo chequeo
-- `is_workspace_member` en cada una, apenas se conoce auth.uid(), antes de
-- cualquier lectura/escritura. Como workspace_id = owner_id en esta
-- iteración, el chequeo es siempre `is_workspace_member(auth.uid(), ...)`.
--
-- Los triggers que SOLO se disparan como efecto secundario de una mutación
-- ya autorizada por la RLS de arriba (record_document_activity,
-- record_receivable_activity, enforce_receivable_payment_consistency,
-- sync_receivable_client_name_snapshot, mark_template_index_configuration_incomplete,
-- enforce_notarial_metadata_editable, record_notarial_metadata_activity) NO
-- se tocan: heredan la protección de la tabla que los dispara y ya tienen
-- (donde aplica) su propio chequeo de owner_id independiente.

create or replace function public.log_document_word_generated(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if not public.is_workspace_member(auth.uid(), array['propietario']) then
    return;
  end if;

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
begin
  if auth.uid() is null then
    return;
  end if;
  if not public.is_workspace_member(auth.uid(), array['propietario']) then
    return;
  end if;
  if p_format is null or p_format not in ('docx') then
    return;
  end if;

  insert into public.notarial_index_exports
    (owner_id, format, from_date, to_date, row_count)
  values (
    auth.uid(), p_format, p_from, p_to, greatest(coalesce(p_row_count, 0), 0)
  );
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
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_workspace_member(v_uid, array['propietario']) then
    raise exception 'workspace membership required' using errcode = '28000';
  end if;

  select * into v_rec
    from public.receivables
   where id = p_receivable_id and owner_id = v_uid
   for update;

  if not found then
    raise exception 'receivable not found' using errcode = 'P0002';
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
    (receivable_id, owner_id, amount, currency, paid_at, method, reference)
  values (
    p_receivable_id, v_uid, v_amount, v_rec.currency,
    coalesce(p_paid_at, (now() at time zone 'America/Costa_Rica')::date),
    p_method, nullif(btrim(p_reference), '')
  )
  returning id into v_payment_id;

  insert into public.receivable_activity
    (receivable_id, owner_id, actor_user_id, event_type, metadata)
  values (p_receivable_id, v_uid, v_uid, 'payment_registered',
    jsonb_build_object('amount', v_amount, 'payment_id', v_payment_id));

  if v_paid + v_amount >= v_rec.amount_total then
    insert into public.receivable_activity
      (receivable_id, owner_id, actor_user_id, event_type, metadata)
    values (p_receivable_id, v_uid, v_uid, 'receivable_paid', '{}'::jsonb);
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
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_workspace_member(v_uid, array['propietario']) then
    raise exception 'workspace membership required' using errcode = '28000';
  end if;
  if v_reason is null then
    raise exception 'void reason is required' using errcode = '22023';
  end if;

  select * into v_payment
    from public.receivable_payments
   where id = p_payment_id and owner_id = v_uid;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;

  select * into v_rec
    from public.receivables
   where id = v_payment.receivable_id and owner_id = v_uid
   for update;

  select * into v_payment
    from public.receivable_payments
   where id = p_payment_id and owner_id = v_uid
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
    (receivable_id, owner_id, actor_user_id, event_type, metadata)
  values (v_rec.id, v_uid, v_uid, 'payment_voided',
    jsonb_build_object('amount', v_payment.amount, 'payment_id', p_payment_id));

  select coalesce(sum(amount), 0) into v_paid_after
    from public.receivable_payments
   where receivable_id = v_rec.id and status = 'active';

  if v_was_paid and v_paid_after < v_rec.amount_total then
    insert into public.receivable_activity
      (receivable_id, owner_id, actor_user_id, event_type, metadata)
    values (v_rec.id, v_uid, v_uid, 'receivable_reopened_after_void', '{}'::jsonb);
  end if;
end;
$$;

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
  if not public.is_workspace_member(v_user_id, array['propietario']) then
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
      name,
      description,
      status,
      content_json,
      text_preview
    ) values (
      v_user_id,
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
        and templates.owner_id = v_user_id
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
        and templates.owner_id = v_user_id
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
      and template_fields.owner_id = v_user_id
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
      and template_fields.owner_id = v_user_id
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
      and existing.owner_id = v_user_id
      and existing.field_key = desired.value->>'field_key'
  );
  get diagnostics v_affected = row_count;
  v_fields_changed := v_fields_changed + v_affected;

  if p_template_id is not null and v_template_changed = 0 and v_fields_changed > 0 then
    update public.templates
      set updated_at = clock_timestamp()
      where templates.id = v_template_id
        and templates.owner_id = v_user_id
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
  v_configuration_id uuid;
  v_field jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not public.is_workspace_member(v_user_id, array['propietario']) then
    raise exception using errcode = '42501', message = 'workspace_membership_required';
  end if;
  if not exists (
    select 1 from public.templates t
    where t.id = p_template_id and t.owner_id = v_user_id
  ) then
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
        and f.owner_id = v_user_id
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
    owner_id, template_id, party_separator, fixed_suffix, allow_empty, is_complete
  ) values (
    v_user_id,
    p_template_id,
    p_party_separator,
    nullif(btrim(coalesce(p_fixed_suffix, '')), ''),
    coalesce(p_allow_empty, false),
    true
  )
  on conflict (owner_id, template_id) do update
    set party_separator = excluded.party_separator,
        fixed_suffix = excluded.fixed_suffix,
        allow_empty = excluded.allow_empty,
        is_complete = true
  returning id into v_configuration_id;

  delete from public.template_index_configuration_fields f
  where f.configuration_id = v_configuration_id;

  insert into public.template_index_configuration_fields (
    configuration_id, owner_id, template_id, template_field_id, sort_order
  )
  select
    v_configuration_id,
    v_user_id,
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
  if not public.is_workspace_member(v_user_id, array['propietario']) then
    raise exception using errcode = '42501', message = 'workspace_membership_required';
  end if;
  if not exists (
    select 1 from public.templates t
    where t.id = p_template_id and t.owner_id = v_user_id
  ) then
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
          and f.owner_id = v_user_id
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
        and f.owner_id = v_user_id
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
  on conflict (owner_id, template_id) do update set
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
    configuration_id, owner_id, template_id, template_field_id, sort_order
  )
  select
    v_configuration_id,
    v_user_id,
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
  v_configuration_id uuid;
  v_block_id text := nullif(btrim(coalesce(p_authorized_time_option_block_id, '')), '');
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not public.is_workspace_member(v_user_id, array['propietario']) then
    raise exception using errcode = '42501', message = 'workspace_membership_required';
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
      and t.owner_id = v_user_id
      and node->>'type' = 'optionBlock'
      and node->'attrs'->>'blockId' = v_block_id
      and node->'attrs'->'structuredOutput'->>'type' = 'time'
  ) then
    raise exception using errcode = '23503', message = 'option_block_not_found';
  end if;

  update public.template_index_configurations
     set authorized_time_option_block_id = null
   where owner_id = v_user_id
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
     and owner_id = v_user_id;

  return v_configuration_id;
end;
$$;
