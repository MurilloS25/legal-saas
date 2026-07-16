begin;

set search_path = public, extensions;
select plan(16);

create schema template_mapping_test;
grant usage on schema template_mapping_test to public;

create function template_mapping_test.statement_succeeds(statement text)
returns boolean language plpgsql as $$
begin execute statement; return true;
exception when others then
  raise notice 'failed: % (%)', sqlerrm, sqlstate; return false; end; $$;

create function template_mapping_test.statement_fails(statement text)
returns boolean language plpgsql as $$
begin execute statement; return false;
exception when others then return true; end; $$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a1111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mapping-a@example.test','x',now(),'{}','{}',now(),now()),
  ('a2222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mapping-b@example.test','x',now(),'{}','{}',now(),now());

insert into public.templates (id, owner_id, name, status, content_json) values
  ('a1111111-0000-0000-0000-000000000001','a1111111-1111-1111-1111-111111111111','Venta A','draft','{}'),
  ('a2222222-0000-0000-0000-000000000001','a2222222-2222-2222-2222-222222222222','Venta B','draft','{}');

insert into public.template_fields
  (id, owner_id, template_id, field_key, label, field_type, sort_order)
values
  ('a1111111-f000-0000-0000-000000000001','a1111111-1111-1111-1111-111111111111','a1111111-0000-0000-0000-000000000001','instrument','Número','text',0),
  ('a1111111-f000-0000-0000-000000000002','a1111111-1111-1111-1111-111111111111','a1111111-0000-0000-0000-000000000001','date','Fecha','text',1),
  ('a1111111-f000-0000-0000-000000000003','a1111111-1111-1111-1111-111111111111','a1111111-0000-0000-0000-000000000001','seller','Vendedor','text',2),
  ('a2222222-f000-0000-0000-000000000001','a2222222-2222-2222-2222-222222222222','a2222222-0000-0000-0000-000000000001','foreign','Ajeno','text',0);

select ok(has_function_privilege(
  'authenticated',
  'public.save_template_index_mapping(uuid,jsonb,text,text,boolean,jsonb)',
  'EXECUTE'
), 'Authenticated may save the extended mapping');
select ok(not has_function_privilege(
  'anon',
  'public.save_template_index_mapping(uuid,jsonb,text,text,boolean,jsonb)',
  'EXECUTE'
), 'Anonymous may not save the extended mapping');

select set_config('request.jwt.claim.sub','a1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select ok(template_mapping_test.statement_succeeds($$
  select public.save_template_index_mapping(
    'a1111111-0000-0000-0000-000000000001',
    '{"instrument_number":"a1111111-f000-0000-0000-000000000001","authorized_date":"a1111111-f000-0000-0000-000000000002","authorized_time":null,"protocol_book":null,"initial_folio":null,"final_folio":null}',
    ' Y ', null, false,
    '[{"template_field_id":"a1111111-f000-0000-0000-000000000003","sort_order":0}]'
  )
$$), 'Owner saves simple and Parties mappings together');
select is((select instrument_number_field_id from public.template_index_configurations),
  'a1111111-f000-0000-0000-000000000001'::uuid, 'Instrument mapping is stored');
select is((select authorized_date_field_id from public.template_index_configurations),
  'a1111111-f000-0000-0000-000000000002'::uuid, 'Date mapping is stored');
select is((select authorized_time_field_id from public.template_index_configurations),
  null::uuid, 'Partial simple mapping is allowed');
select is((select count(*) from public.template_index_configuration_fields),
  1::bigint, 'Existing ordered Parties model is reused');
select is((select invalid_mappings from public.template_index_configurations),
  '{}'::text[], 'A successful save clears invalid mapping warnings');

select ok(template_mapping_test.statement_fails($$
  select public.save_template_index_mapping(
    'a1111111-0000-0000-0000-000000000001',
    '{"instrument_number":"a1111111-f000-0000-0000-000000000001","authorized_date":"a1111111-f000-0000-0000-000000000001"}',
    ' Y ', null, true, '[]'
  )
$$), 'A simple field cannot be assigned to two destinations');
select ok(template_mapping_test.statement_fails($$
  select public.save_template_index_mapping(
    'a1111111-0000-0000-0000-000000000001',
    '{"protocol_book":"a2222222-f000-0000-0000-000000000001"}',
    ' Y ', null, true, '[]'
  )
$$), 'A simple mapping cannot reference another owner field');
select ok(template_mapping_test.statement_fails($$
  select public.save_template_index_mapping(
    'a2222222-0000-0000-0000-000000000001', '{}',
    ' Y ', null, true, '[]'
  )
$$), 'Owner cannot configure another owner template');

select ok(template_mapping_test.statement_succeeds($$
  delete from public.template_fields
  where id = 'a1111111-f000-0000-0000-000000000001'
$$), 'An owner may still remove a mapped template field');
select is((select instrument_number_field_id from public.template_index_configurations),
  null::uuid, 'Deleted simple field reference is cleared safely');
select ok((select not is_complete from public.template_index_configurations),
  'Deleting a mapped field marks the configuration incomplete');
select ok((select 'instrument_number' = any(invalid_mappings)
  from public.template_index_configurations),
  'The invalid destination is retained for a precise warning');

reset role;
select set_config('request.jwt.claim.sub','a2222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select is((select count(*) from public.template_index_configurations),
  0::bigint, 'RLS hides configurations from another owner');

reset role;
select * from finish();
rollback;
