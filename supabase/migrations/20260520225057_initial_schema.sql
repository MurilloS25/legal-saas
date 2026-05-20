create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.lawyer_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  professional_code text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lawyer_profiles_owner_id_key unique (owner_id),
  constraint lawyer_profiles_id_owner_id_key unique (id, owner_id)
);

create table public.document_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  font_family text not null,
  font_size numeric(4, 1) not null,
  margin_top_cm numeric(5, 2) not null,
  margin_bottom_cm numeric(5, 2) not null,
  margin_left_cm numeric(5, 2) not null,
  margin_right_cm numeric(5, 2) not null,
  line_spacing numeric(4, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_settings_owner_id_key unique (owner_id),
  constraint document_settings_id_owner_id_key unique (id, owner_id),
  constraint document_settings_font_size_positive check (font_size > 0),
  constraint document_settings_margins_non_negative check (
    margin_top_cm >= 0
    and margin_bottom_cm >= 0
    and margin_left_cm >= 0
    and margin_right_cm >= 0
  ),
  constraint document_settings_line_spacing_positive check (line_spacing > 0)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  identification_type text not null,
  identification_number text not null,
  marital_status text not null,
  nationality text not null,
  occupation text not null,
  exact_address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_identification_type_check check (identification_type in ('cedula_fisica')),
  constraint clients_id_owner_id_key unique (id, owner_id)
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category text,
  status text not null default 'draft',
  content_json jsonb not null default '{}'::jsonb,
  text_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint templates_status_check check (status in ('draft', 'active', 'archived')),
  constraint templates_id_owner_id_key unique (id, owner_id)
);

create table public.template_fields (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null,
  field_key text not null,
  label text not null,
  field_type text not null,
  required boolean not null default false,
  role_key text,
  source text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_fields_template_owner_fk
    foreign key (template_id, owner_id)
    references public.templates(id, owner_id)
    on delete cascade,
  constraint template_fields_field_type_check check (
    field_type in ('text', 'number', 'date', 'time', 'money', 'client', 'select', 'boolean', 'textarea')
  ),
  constraint template_fields_source_check check (source is null or source in ('manual', 'client')),
  constraint template_fields_id_owner_id_key unique (id, owner_id)
);

create unique index template_fields_template_field_key_no_role_key_idx
  on public.template_fields (template_id, field_key)
  where role_key is null;

create unique index template_fields_template_role_field_key_idx
  on public.template_fields (template_id, role_key, field_key)
  where role_key is not null;

create table public.document_metadata (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null,
  client_id uuid,
  title text not null,
  document_type text not null,
  created_for_index boolean not null default false,
  created_for_receivable boolean not null default false,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_metadata_template_owner_fk
    foreign key (template_id, owner_id)
    references public.templates(id, owner_id),
  constraint document_metadata_client_owner_fk
    foreign key (client_id, owner_id)
    references public.clients(id, owner_id),
  constraint document_metadata_document_type_check check (document_type in ('escritura', 'nota', 'otro')),
  constraint document_metadata_saved_purpose_check check (created_for_index or created_for_receivable),
  constraint document_metadata_id_owner_id_key unique (id, owner_id)
);

create table public.notarial_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  document_metadata_id uuid not null,
  volume text not null,
  initial_folio text not null,
  final_folio text not null,
  deed_number text not null,
  deed_date date not null,
  deed_time time not null,
  act_or_contract text not null,
  parties text not null,
  period_half text not null,
  period_month smallint not null,
  period_year integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notarial_records_document_metadata_owner_fk
    foreign key (document_metadata_id, owner_id)
    references public.document_metadata(id, owner_id)
    on delete cascade,
  constraint notarial_records_period_half_check check (period_half in ('first', 'second')),
  constraint notarial_records_period_month_check check (period_month between 1 and 12),
  constraint notarial_records_period_year_check check (period_year between 1900 and 2200),
  constraint notarial_records_id_owner_id_key unique (id, owner_id)
);

create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  document_metadata_id uuid,
  description text not null,
  amount numeric(14, 2) not null,
  currency text not null,
  status text not null default 'pending',
  due_date date,
  paid_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receivables_client_owner_fk
    foreign key (client_id, owner_id)
    references public.clients(id, owner_id),
  constraint receivables_document_metadata_owner_fk
    foreign key (document_metadata_id, owner_id)
    references public.document_metadata(id, owner_id),
  constraint receivables_status_check check (status in ('pending', 'partial', 'paid', 'cancelled')),
  constraint receivables_amount_non_negative check (amount >= 0),
  constraint receivables_id_owner_id_key unique (id, owner_id)
);

create trigger lawyer_profiles_set_updated_at
before update on public.lawyer_profiles
for each row execute function public.set_updated_at();

create trigger document_settings_set_updated_at
before update on public.document_settings
for each row execute function public.set_updated_at();

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger templates_set_updated_at
before update on public.templates
for each row execute function public.set_updated_at();

create trigger template_fields_set_updated_at
before update on public.template_fields
for each row execute function public.set_updated_at();

create trigger document_metadata_set_updated_at
before update on public.document_metadata
for each row execute function public.set_updated_at();

create trigger notarial_records_set_updated_at
before update on public.notarial_records
for each row execute function public.set_updated_at();

create trigger receivables_set_updated_at
before update on public.receivables
for each row execute function public.set_updated_at();

create index lawyer_profiles_owner_id_idx on public.lawyer_profiles (owner_id);
create index document_settings_owner_id_idx on public.document_settings (owner_id);
create index clients_owner_id_idx on public.clients (owner_id);
create index templates_owner_id_idx on public.templates (owner_id);
create index templates_status_idx on public.templates (status);
create index template_fields_owner_id_idx on public.template_fields (owner_id);
create index template_fields_template_id_idx on public.template_fields (template_id);
create index document_metadata_owner_id_idx on public.document_metadata (owner_id);
create index document_metadata_template_id_idx on public.document_metadata (template_id);
create index document_metadata_client_id_idx on public.document_metadata (client_id);
create index notarial_records_owner_id_idx on public.notarial_records (owner_id);
create index notarial_records_document_metadata_id_idx on public.notarial_records (document_metadata_id);
create index notarial_records_period_idx on public.notarial_records (period_year, period_month, period_half);
create index receivables_owner_id_idx on public.receivables (owner_id);
create index receivables_client_id_idx on public.receivables (client_id);
create index receivables_document_metadata_id_idx on public.receivables (document_metadata_id);
create index receivables_status_idx on public.receivables (status);

alter table public.lawyer_profiles enable row level security;
alter table public.document_settings enable row level security;
alter table public.clients enable row level security;
alter table public.templates enable row level security;
alter table public.template_fields enable row level security;
alter table public.document_metadata enable row level security;
alter table public.notarial_records enable row level security;
alter table public.receivables enable row level security;

create policy "lawyer_profiles_select_own"
on public.lawyer_profiles
for select
to authenticated
using (owner_id = auth.uid());

create policy "lawyer_profiles_insert_own"
on public.lawyer_profiles
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "lawyer_profiles_update_own"
on public.lawyer_profiles
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "lawyer_profiles_delete_own"
on public.lawyer_profiles
for delete
to authenticated
using (owner_id = auth.uid());

create policy "document_settings_select_own"
on public.document_settings
for select
to authenticated
using (owner_id = auth.uid());

create policy "document_settings_insert_own"
on public.document_settings
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "document_settings_update_own"
on public.document_settings
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "document_settings_delete_own"
on public.document_settings
for delete
to authenticated
using (owner_id = auth.uid());

create policy "clients_select_own"
on public.clients
for select
to authenticated
using (owner_id = auth.uid());

create policy "clients_insert_own"
on public.clients
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "clients_update_own"
on public.clients
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "clients_delete_own"
on public.clients
for delete
to authenticated
using (owner_id = auth.uid());

create policy "templates_select_own"
on public.templates
for select
to authenticated
using (owner_id = auth.uid());

create policy "templates_insert_own"
on public.templates
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "templates_update_own"
on public.templates
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "templates_delete_own"
on public.templates
for delete
to authenticated
using (owner_id = auth.uid());

create policy "template_fields_select_own"
on public.template_fields
for select
to authenticated
using (owner_id = auth.uid());

create policy "template_fields_insert_own"
on public.template_fields
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.templates
    where templates.id = template_fields.template_id
      and templates.owner_id = auth.uid()
  )
);

create policy "template_fields_update_own"
on public.template_fields
for update
to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.templates
    where templates.id = template_fields.template_id
      and templates.owner_id = auth.uid()
  )
);

create policy "template_fields_delete_own"
on public.template_fields
for delete
to authenticated
using (owner_id = auth.uid());

create policy "document_metadata_select_own"
on public.document_metadata
for select
to authenticated
using (owner_id = auth.uid());

create policy "document_metadata_insert_own"
on public.document_metadata
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.templates
    where templates.id = document_metadata.template_id
      and templates.owner_id = auth.uid()
  )
  and (
    client_id is null
    or exists (
      select 1
      from public.clients
      where clients.id = document_metadata.client_id
        and clients.owner_id = auth.uid()
    )
  )
);

create policy "document_metadata_update_own"
on public.document_metadata
for update
to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.templates
    where templates.id = document_metadata.template_id
      and templates.owner_id = auth.uid()
  )
  and (
    client_id is null
    or exists (
      select 1
      from public.clients
      where clients.id = document_metadata.client_id
        and clients.owner_id = auth.uid()
    )
  )
);

create policy "document_metadata_delete_own"
on public.document_metadata
for delete
to authenticated
using (owner_id = auth.uid());

create policy "notarial_records_select_own"
on public.notarial_records
for select
to authenticated
using (owner_id = auth.uid());

create policy "notarial_records_insert_own"
on public.notarial_records
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.document_metadata
    where document_metadata.id = notarial_records.document_metadata_id
      and document_metadata.owner_id = auth.uid()
  )
);

create policy "notarial_records_update_own"
on public.notarial_records
for update
to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.document_metadata
    where document_metadata.id = notarial_records.document_metadata_id
      and document_metadata.owner_id = auth.uid()
  )
);

create policy "notarial_records_delete_own"
on public.notarial_records
for delete
to authenticated
using (owner_id = auth.uid());

create policy "receivables_select_own"
on public.receivables
for select
to authenticated
using (owner_id = auth.uid());

create policy "receivables_insert_own"
on public.receivables
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.clients
    where clients.id = receivables.client_id
      and clients.owner_id = auth.uid()
  )
  and (
    document_metadata_id is null
    or exists (
      select 1
      from public.document_metadata
      where document_metadata.id = receivables.document_metadata_id
        and document_metadata.owner_id = auth.uid()
    )
  )
);

create policy "receivables_update_own"
on public.receivables
for update
to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.clients
    where clients.id = receivables.client_id
      and clients.owner_id = auth.uid()
  )
  and (
    document_metadata_id is null
    or exists (
      select 1
      from public.document_metadata
      where document_metadata.id = receivables.document_metadata_id
        and document_metadata.owner_id = auth.uid()
    )
  )
);

create policy "receivables_delete_own"
on public.receivables
for delete
to authenticated
using (owner_id = auth.uid());
