-- Escrituras persistidas como borradores.
--
-- Decisiones:
-- * `field_values` (jsonb) guarda el mapa plano field_key -> texto escrito
--   por el usuario. Se llama field_values (no "values") para evitar la
--   palabra reservada de SQL.
-- * `rendered_content` guarda el snapshot textual del documento tal como se
--   preparó, para conservar el borrador aunque el machote cambie después.
-- * El FK hacia templates NO tiene cascada: eliminar un machote con
--   escrituras asociadas queda bloqueado (no hay borrado destructivo).
-- * `status` solo admite 'draft' por ahora; estados futuros se agregarán
--   con una migración que extienda el check.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null,
  title text not null,
  status text not null default 'draft',
  field_values jsonb not null default '{}'::jsonb,
  rendered_content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_template_owner_fk
    foreign key (template_id, owner_id)
    references public.templates(id, owner_id),
  constraint documents_status_check check (status in ('draft')),
  constraint documents_title_not_blank check (btrim(title) <> ''),
  constraint documents_field_values_is_object check (
    jsonb_typeof(field_values) = 'object'
  ),
  constraint documents_id_owner_id_key unique (id, owner_id)
);

create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create index documents_owner_id_idx on public.documents (owner_id);
create index documents_template_id_idx on public.documents (template_id);
create index documents_owner_updated_at_idx
  on public.documents (owner_id, updated_at desc);

alter table public.documents enable row level security;

create policy "documents_select_own"
on public.documents
for select
to authenticated
using (owner_id = auth.uid());

create policy "documents_insert_own"
on public.documents
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.templates
    where templates.id = documents.template_id
      and templates.owner_id = auth.uid()
  )
);

create policy "documents_update_own"
on public.documents
for update
to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.templates
    where templates.id = documents.template_id
      and templates.owner_id = auth.uid()
  )
);

create policy "documents_delete_own"
on public.documents
for delete
to authenticated
using (owner_id = auth.uid());
