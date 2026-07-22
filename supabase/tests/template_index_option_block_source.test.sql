begin;

set search_path = public, extensions;
select plan(9);

create schema template_block_source_test;
grant usage on schema template_block_source_test to public;

create function template_block_source_test.statement_succeeds(statement text)
returns boolean language plpgsql as $$
begin execute statement; return true;
exception when others then return false; end; $$;

create function template_block_source_test.statement_fails(statement text)
returns boolean language plpgsql as $$
begin execute statement; return false;
exception when others then return true; end; $$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('b1111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','block-a@example.test','x',now(),'{}','{}',now(),now()),
  ('b2222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','block-b@example.test','x',now(),'{}','{}',now(),now());

insert into public.templates (id, owner_id, name, status, content_json) values
  (
    'b1111111-0000-0000-0000-000000000001',
    'b1111111-1111-1111-1111-111111111111',
    'Hora A',
    'draft',
    $json${
      "doc": {
        "type": "doc",
        "content": [{
          "type": "paragraph",
          "content": [{
            "type": "optionBlock",
            "attrs": {
              "blockId": "hora-block",
              "name": "Hora",
              "defaultVariantId": "en_punto",
              "variants": [{
                "id": "en_punto",
                "label": "Hora en punto",
                "content": [{
                  "type": "templateVariable",
                  "attrs": { "key": "hora" }
                }]
              }],
              "structuredOutput": {
                "type": "time",
                "variants": [{
                  "variantId": "en_punto",
                  "hourFieldKey": "hora",
                  "minuteFieldKey": null
                }]
              }
            }
          }]
        }]
      }
    }$json$::jsonb
  ),
  ('b2222222-0000-0000-0000-000000000001','b2222222-2222-2222-2222-222222222222','Hora B','draft','{}');

insert into public.template_fields
  (id, owner_id, template_id, field_key, label, field_type, sort_order)
values
  ('b1111111-f000-0000-0000-000000000001','b1111111-1111-1111-1111-111111111111','b1111111-0000-0000-0000-000000000001','hora','Hora','text',0);

select ok(has_function_privilege(
  'authenticated',
  'public.save_template_index_mapping_with_block_source(uuid,jsonb,text,text,text,boolean,jsonb)',
  'EXECUTE'
), 'Authenticated may save a block source');
select ok(not has_function_privilege(
  'anon',
  'public.save_template_index_mapping_with_block_source(uuid,jsonb,text,text,text,boolean,jsonb)',
  'EXECUTE'
), 'Anonymous may not save a block source');

select set_config('request.jwt.claim.sub','b1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select ok(template_block_source_test.statement_succeeds($$
  select public.save_template_index_mapping_with_block_source(
    'b1111111-0000-0000-0000-000000000001',
    '{"instrument_number":null,"authorized_date":null,"authorized_time":null,"protocol_book":null,"initial_folio":null,"final_folio":null}',
    'hora-block', ' Y ', null, true, '[]'
  )
$$), 'Owner saves a structured Hora block source');
select is(
  (select authorized_time_option_block_id from public.template_index_configurations),
  'hora-block',
  'The stable block id is stored'
);
select ok(template_block_source_test.statement_fails($$
  select public.save_template_index_mapping_with_block_source(
    'b1111111-0000-0000-0000-000000000001', '{}',
    'missing-block', ' Y ', null, true, '[]'
  )
$$), 'A missing block is rejected');
select ok(template_block_source_test.statement_fails($$
  select public.save_template_index_mapping_with_block_source(
    'b2222222-0000-0000-0000-000000000001', '{}',
    'hora-block', ' Y ', null, true, '[]'
  )
$$), 'Another owner template cannot be configured');
select ok(template_block_source_test.statement_fails($$
  select public.save_template_index_mapping_with_block_source(
    'b1111111-0000-0000-0000-000000000001',
    '{"authorized_time":"b1111111-f000-0000-0000-000000000001"}',
    'hora-block', ' Y ', null, true, '[]'
  )
$$), 'Variable and block time sources are mutually exclusive');
select ok(template_block_source_test.statement_succeeds($$
  select public.save_template_index_mapping_with_block_source(
    'b1111111-0000-0000-0000-000000000001',
    '{"authorized_time":"b1111111-f000-0000-0000-000000000001"}',
    null, ' Y ', null, true, '[]'
  )
$$), 'A block source can be replaced by a variable source');
select is(
  (select authorized_time_option_block_id from public.template_index_configurations),
  null::text,
  'Switching source clears the previous block id'
);

reset role;
select * from finish();
rollback;
