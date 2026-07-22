-- Allow the authorization time to come from a structured Option Block.
-- The block definition itself remains in templates.content_json; this table
-- stores only the stable block id selected by the owner.

alter table public.template_index_configurations
  add column authorized_time_option_block_id text,
  add constraint template_index_config_time_source_exclusive_check
    check (
      authorized_time_field_id is null
      or authorized_time_option_block_id is null
    ),
  add constraint template_index_config_time_block_id_check
    check (
      authorized_time_option_block_id is null
      or char_length(authorized_time_option_block_id) between 1 and 120
    );

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

  -- Clear the previous block source inside the same transaction before the
  -- legacy mapping RPC updates a possible variable source.
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

revoke all on function public.save_template_index_mapping_with_block_source(
  uuid, jsonb, text, text, text, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.save_template_index_mapping_with_block_source(
  uuid, jsonb, text, text, text, boolean, jsonb
) to authenticated;

comment on column public.template_index_configurations.authorized_time_option_block_id is
  'Stable id of an owner template Option Block with structured time output; mutually exclusive with authorized_time_field_id.';
