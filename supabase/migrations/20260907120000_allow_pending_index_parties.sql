-- Allow "Parties pending" (Partes not yet decided) as a valid, saveable
-- state of the Machote's notarial index configuration.
--
-- Before this migration, `save_template_index_mapping` rejected a save
-- whenever `p_party_fields` was empty AND `p_allow_empty` was false
-- (error `empty_index_fields_not_confirmed`): the caller was forced to
-- either pick at least one Parties variable or explicitly confirm "this
-- Machote has no Parties" (`allow_empty = true`) before it could save
-- ANYTHING in the Índice configuration — including unrelated simple
-- fields (Número de instrumento, Fecha de autorización, etc.), which have
-- never required this kind of confirmation.
--
-- The UI (`TemplateIndexConfigurationSection`) now models Parties as three
-- explicit states — Pendiente de definir / Requiere partes / No requiere
-- partes — and the "Pendiente" state needs to be persistable on its own,
-- alongside other already-saved Índice data, without forcing a premature
-- decision about Parties. No new column is introduced: the existing
-- `allow_empty` column already distinguishes "confirmed empty"
-- (`allow_empty = true`) from "not yet decided" (`allow_empty = false`,
-- `template_index_configuration_fields` empty) — "Pendiente" was always
-- representable in the data model, only the RPC's validation blocked it.
--
-- Every other validation in this function is untouched: separator/suffix
-- length, field ownership, duplicate ids/sort orders, the 50-field cap,
-- and the simple-fields checks in `save_template_index_mapping_with_block_source`
-- all still apply exactly as before. Only the specific
-- "empty AND not confirmed" rejection is removed.
--
-- Based on the workspace-aware body from 20260804210000 (the latest prior
-- redefinition of this function — `on conflict (workspace_id, template_id)`,
-- not the pre-workspace `(owner_id, template_id)` from the original
-- 20260716114907 body), so this migration does not regress the workspace
-- multi-tenancy work from iteration 4.

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
  -- Removed: the "empty AND not confirmed" rejection
  -- (`empty_index_fields_not_confirmed`) that used to live here. An empty
  -- `p_party_fields` with `p_allow_empty = false` is now a valid save —
  -- it represents "Partes pendiente de definir", not an error.

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
