-- Reusable owner + template configuration for the notarial index Parties
-- column. The generated value is snapshotted on document metadata; this model
-- stores only field selection rules, never full escritura content.

alter table public.template_fields
  add constraint template_fields_id_owner_template_key
  unique (id, owner_id, template_id);

create table public.template_index_configurations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null,
  party_separator text not null default ' Y ',
  fixed_suffix text,
  allow_empty boolean not null default false,
  is_complete boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_index_config_template_owner_fk
    foreign key (template_id, owner_id)
    references public.templates(id, owner_id)
    on delete cascade,
  constraint template_index_config_owner_template_key
    unique (owner_id, template_id),
  constraint template_index_config_id_owner_template_key
    unique (id, owner_id, template_id),
  constraint template_index_config_separator_check
    check (char_length(btrim(party_separator)) between 1 and 30),
  constraint template_index_config_suffix_check
    check (
      fixed_suffix is null
      or char_length(btrim(fixed_suffix)) between 1 and 200
    )
);

create table public.template_index_configuration_fields (
  id uuid primary key default gen_random_uuid(),
  configuration_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null,
  template_field_id uuid not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_index_fields_configuration_fk
    foreign key (configuration_id, owner_id, template_id)
    references public.template_index_configurations(id, owner_id, template_id)
    on delete cascade,
  constraint template_index_fields_template_field_fk
    foreign key (template_field_id, owner_id, template_id)
    references public.template_fields(id, owner_id, template_id)
    on delete cascade,
  constraint template_index_fields_field_key
    unique (configuration_id, template_field_id),
  constraint template_index_fields_order_key
    unique (configuration_id, sort_order),
  constraint template_index_fields_sort_order_check
    check (sort_order >= 0)
);

create index template_index_config_owner_idx
  on public.template_index_configurations (owner_id);
create index template_index_config_template_idx
  on public.template_index_configurations (template_id);
create index template_index_fields_owner_idx
  on public.template_index_configuration_fields (owner_id);
create index template_index_fields_template_idx
  on public.template_index_configuration_fields (template_id);
create index template_index_fields_field_idx
  on public.template_index_configuration_fields (template_field_id);

create trigger template_index_config_set_updated_at
before update on public.template_index_configurations
for each row execute function public.set_updated_at();

create trigger template_index_fields_set_updated_at
before update on public.template_index_configuration_fields
for each row execute function public.set_updated_at();

alter table public.template_index_configurations enable row level security;
alter table public.template_index_configuration_fields enable row level security;

create policy "template_index_config_select_own"
on public.template_index_configurations
for select to authenticated
using (owner_id = auth.uid());

create policy "template_index_config_insert_own"
on public.template_index_configurations
for insert to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.templates t
    where t.id = template_id and t.owner_id = auth.uid()
  )
);

create policy "template_index_config_update_own"
on public.template_index_configurations
for update to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.templates t
    where t.id = template_id and t.owner_id = auth.uid()
  )
);

create policy "template_index_config_delete_own"
on public.template_index_configurations
for delete to authenticated
using (owner_id = auth.uid());

create policy "template_index_fields_select_own"
on public.template_index_configuration_fields
for select to authenticated
using (owner_id = auth.uid());

create policy "template_index_fields_insert_own"
on public.template_index_configuration_fields
for insert to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.template_index_configurations c
    where c.id = configuration_id
      and c.template_id = template_id
      and c.owner_id = auth.uid()
  )
  and exists (
    select 1 from public.template_fields f
    where f.id = template_field_id
      and f.template_id = template_id
      and f.owner_id = auth.uid()
  )
);

create policy "template_index_fields_update_own"
on public.template_index_configuration_fields
for update to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.template_index_configurations c
    where c.id = configuration_id
      and c.template_id = template_id
      and c.owner_id = auth.uid()
  )
  and exists (
    select 1 from public.template_fields f
    where f.id = template_field_id
      and f.template_id = template_id
      and f.owner_id = auth.uid()
  )
);

create policy "template_index_fields_delete_own"
on public.template_index_configuration_fields
for delete to authenticated
using (owner_id = auth.uid());

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

revoke all on function public.save_template_index_configuration(
  uuid, text, text, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.save_template_index_configuration(
  uuid, text, text, boolean, jsonb
) to authenticated;

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
  if auth.uid() <> old.owner_id then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  update public.template_index_configurations c
     set is_complete = false
   where c.owner_id = old.owner_id
     and c.template_id = old.template_id
     and exists (
       select 1 from public.template_index_configuration_fields f
       where f.configuration_id = c.id
         and f.template_field_id = old.id
     );
  return old;
end;
$$;

revoke all on function public.mark_template_index_configuration_incomplete()
  from public, anon, authenticated;

create trigger template_field_mark_index_configuration_incomplete
before delete on public.template_fields
for each row execute function public.mark_template_index_configuration_incomplete();

comment on table public.template_index_configurations is
  'Owner-scoped reusable rule for generating the notarial index Parties snapshot from one template.';
comment on column public.template_index_configurations.is_complete is
  'False when a selected template field was removed; the configuration remains for explicit reconciliation.';
