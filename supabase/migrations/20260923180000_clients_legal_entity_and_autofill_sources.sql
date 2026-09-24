-- Clientes persona jurídica (sociedades) + orígenes de autollenado faltantes.
--
-- Por qué hace falta una migración:
--
-- 1. `clients_identification_type_check` solo admitía 'cedula_fisica'; una
--    sociedad necesita 'cedula_juridica'.
-- 2. `marital_status`, `nationality` y `occupation` eran NOT NULL. Una
--    persona jurídica no tiene estado civil, ocupación ni nacionalidad
--    personal: obligarla a llenarlos inventaría datos que luego se
--    copiarían a la Escritura. Pasan a ser nulables SOLO para jurídicas;
--    el nuevo CHECK mantiene la obligatoriedad para 'cedula_fisica' y
--    exige que queden NULL en 'cedula_juridica' (nunca un dato personal
--    oculto en una sociedad).
-- 3. `template_fields.autofill_source` (CHECK + validación dentro de
--    `save_template_workspace`) no aceptaba estado civil, ocupación ni
--    nacionalidad, así que un Machote no podía mapearlos al Cliente.
--
-- Compatibilidad: ningún dato existente se reescribe. Todas las filas de
-- `clients` son 'cedula_fisica' con las tres columnas no nulas (eran NOT
-- NULL), por lo que el nuevo CHECK valida sin tocar datos. Los orígenes de
-- autollenado existentes siguen siendo válidos. RLS no cambia: las
-- políticas de `clients` y `template_fields` son por fila (membresía de
-- Workspace), no por columna.

-- ---------------------------------------------------------------- clients

alter table public.clients
  drop constraint clients_identification_type_check;

alter table public.clients
  add constraint clients_identification_type_check
  check (identification_type in ('cedula_fisica', 'cedula_juridica'));

alter table public.clients
  alter column marital_status drop not null,
  alter column nationality drop not null,
  alter column occupation drop not null;

alter table public.clients
  add constraint clients_person_fields_by_type_check check (
    (
      identification_type = 'cedula_fisica'
      and marital_status is not null
      and nationality is not null
      and occupation is not null
    )
    or (
      identification_type = 'cedula_juridica'
      and marital_status is null
      and nationality is null
      and occupation is null
    )
  );

-- La cédula jurídica conserva sus guiones tal como se ingresó
-- ("3-101-123456"); la física se sigue guardando sin separadores. Esta
-- regla la aplica `ClientSchema` en la aplicación; aquí solo se impide un
-- valor vacío o con caracteres ajenos a una cédula jurídica.
alter table public.clients
  add constraint clients_juridica_identification_format_check check (
    identification_type <> 'cedula_juridica'
    or identification_number ~ '^[0-9]+(-[0-9]+)*$'
  );

-- ------------------------------------------------------- template_fields

alter table public.template_fields
  drop constraint template_fields_autofill_source_check;

alter table public.template_fields
  add constraint template_fields_autofill_source_check check (
    autofill_source in (
      'none',
      'client_full_name',
      'client_identification',
      'client_address',
      'client_marital_status',
      'client_occupation',
      'client_nationality'
    )
  );

-- Misma definición vigente (20260804210000_workspace_roles_and_invitations)
-- con la lista de orígenes de autollenado ampliada. CREATE OR REPLACE
-- conserva los privilegios existentes de la función.
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
        'none', 'client_full_name', 'client_identification', 'client_address',
        'client_marital_status', 'client_occupation', 'client_nationality'
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
