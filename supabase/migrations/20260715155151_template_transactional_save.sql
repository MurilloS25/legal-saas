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
      or jsonb_typeof(v_field->'required') <> 'boolean' then
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
        field_type = 'text'
    from jsonb_array_elements(p_fields) with ordinality as desired(value, ordinality)
    where template_fields.template_id = v_template_id
      and template_fields.owner_id = v_user_id
      and template_fields.field_key = desired.value->>'field_key'
      and (
        template_fields.label,
        template_fields.required,
        template_fields.sort_order,
        template_fields.field_type
      ) is distinct from (
        btrim(desired.value->>'label'),
        (desired.value->>'required')::boolean,
        (desired.ordinality - 1)::integer,
        'text'
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
    sort_order
  )
  select
    v_user_id,
    v_template_id,
    desired.value->>'field_key',
    btrim(desired.value->>'label'),
    'text',
    (desired.value->>'required')::boolean,
    'manual',
    desired.ordinality - 1
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

revoke all on function public.save_template_workspace(
  uuid, timestamptz, text, text, text, jsonb, text, jsonb
) from public, anon, authenticated;

grant execute on function public.save_template_workspace(
  uuid, timestamptz, text, text, text, jsonb, text, jsonb
) to authenticated;
