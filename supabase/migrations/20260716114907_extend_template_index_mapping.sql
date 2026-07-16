-- Extend the existing owner + template configuration with optional mappings
-- for the simple notarial-index fields. Existing Parties rules and document
-- snapshots remain untouched.

alter table public.template_index_configurations
  add column instrument_number_field_id uuid,
  add column authorized_date_field_id uuid,
  add column authorized_time_field_id uuid,
  add column protocol_book_field_id uuid,
  add column initial_folio_field_id uuid,
  add column final_folio_field_id uuid,
  add column invalid_mappings text[] not null default '{}',
  add constraint template_index_config_invalid_mappings_check
    check (
      invalid_mappings <@ array[
        'instrument_number',
        'authorized_date',
        'authorized_time',
        'protocol_book',
        'initial_folio',
        'final_folio',
        'parties'
      ]::text[]
    ),
  add constraint template_index_config_instrument_field_fk
    foreign key (instrument_number_field_id, owner_id, template_id)
    references public.template_fields(id, owner_id, template_id)
    on delete set null (instrument_number_field_id),
  add constraint template_index_config_date_field_fk
    foreign key (authorized_date_field_id, owner_id, template_id)
    references public.template_fields(id, owner_id, template_id)
    on delete set null (authorized_date_field_id),
  add constraint template_index_config_time_field_fk
    foreign key (authorized_time_field_id, owner_id, template_id)
    references public.template_fields(id, owner_id, template_id)
    on delete set null (authorized_time_field_id),
  add constraint template_index_config_protocol_field_fk
    foreign key (protocol_book_field_id, owner_id, template_id)
    references public.template_fields(id, owner_id, template_id)
    on delete set null (protocol_book_field_id),
  add constraint template_index_config_initial_folio_field_fk
    foreign key (initial_folio_field_id, owner_id, template_id)
    references public.template_fields(id, owner_id, template_id)
    on delete set null (initial_folio_field_id),
  add constraint template_index_config_final_folio_field_fk
    foreign key (final_folio_field_id, owner_id, template_id)
    references public.template_fields(id, owner_id, template_id)
    on delete set null (final_folio_field_id);

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

revoke all on function public.save_template_index_mapping(
  uuid, jsonb, text, text, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.save_template_index_mapping(
  uuid, jsonb, text, text, boolean, jsonb
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
   where c.owner_id = old.owner_id
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

comment on column public.template_index_configurations.invalid_mappings is
  'Index destinations whose selected template field was removed; cleared only by an explicit configuration save.';
