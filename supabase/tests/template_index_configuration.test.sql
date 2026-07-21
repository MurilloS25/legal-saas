begin;

set search_path = public, extensions;

select plan(25);

create schema template_index_test;
grant usage on schema template_index_test to public;

create function template_index_test.statement_succeeds(statement text)
returns boolean language plpgsql as $$
begin execute statement; return true;
exception when others then
  raise notice 'failed: % (%)', sqlerrm, sqlstate; return false; end; $$;

create function template_index_test.statement_fails(statement text)
returns boolean language plpgsql as $$
begin execute statement; return false;
exception when others then return true; end; $$;

create function template_index_test.statement_row_count(statement text)
returns bigint language plpgsql as $$
declare n bigint; begin execute statement; get diagnostics n = row_count; return n; end; $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('91111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','index-map-a@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('92222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','index-map-b@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

insert into public.templates (id, owner_id, name, status, content_json) values
  ('91111111-0000-0000-0000-000000000001','91111111-1111-1111-1111-111111111111','Venta A','draft','{}'::jsonb),
  ('91111111-0000-0000-0000-000000000002','91111111-1111-1111-1111-111111111111','Poder A','draft','{}'::jsonb),
  ('92222222-0000-0000-0000-000000000001','92222222-2222-2222-2222-222222222222','Venta B','draft','{}'::jsonb);

insert into public.template_fields
  (id, owner_id, template_id, field_key, label, field_type, sort_order)
values
  ('91111111-f000-0000-0000-000000000001','91111111-1111-1111-1111-111111111111','91111111-0000-0000-0000-000000000001','seller.name','Vendedor','text',0),
  ('91111111-f000-0000-0000-000000000002','91111111-1111-1111-1111-111111111111','91111111-0000-0000-0000-000000000001','buyer.name','Comprador','text',1),
  ('91111111-f000-0000-0000-000000000003','91111111-1111-1111-1111-111111111111','91111111-0000-0000-0000-000000000002','principal.name','Poderdante','text',0),
  ('92222222-f000-0000-0000-000000000001','92222222-2222-2222-2222-222222222222','92222222-0000-0000-0000-000000000001','seller.name','Vendedor','text',0);

select ok(has_function_privilege(
  'authenticated',
  'public.save_template_index_configuration(uuid,text,text,boolean,jsonb)',
  'EXECUTE'
), 'Authenticated may execute the transactional save function');
select ok(not has_function_privilege(
  'anon',
  'public.save_template_index_configuration(uuid,text,text,boolean,jsonb)',
  'EXECUTE'
), 'Anonymous may not execute the transactional save function');

select set_config('request.jwt.claim.sub','91111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select ok(template_index_test.statement_succeeds($$
  select public.save_template_index_configuration(
    '91111111-0000-0000-0000-000000000001',
    ' Y ',
    'EN CALIDAD PERSONAL',
    false,
    '[{"template_field_id":"91111111-f000-0000-0000-000000000001","sort_order":0},{"template_field_id":"91111111-f000-0000-0000-000000000002","sort_order":1}]'::jsonb
  )
$$), 'Owner saves a configuration for an owned template');
select is((select count(*) from public.template_index_configurations),
  1::bigint, 'One configuration is created');
select is((select count(*) from public.template_index_configuration_fields),
  2::bigint, 'Selected fields are stored');
select is((select array_agg(template_field_id order by sort_order)
  from public.template_index_configuration_fields),
  array[
    '91111111-f000-0000-0000-000000000001'::uuid,
    '91111111-f000-0000-0000-000000000002'::uuid
  ], 'Selected field order is deterministic');
select is((select party_separator from public.template_index_configurations),
  ' Y ', 'Configured separator is preserved');
select is((select fixed_suffix from public.template_index_configurations),
  'EN CALIDAD PERSONAL', 'Fixed suffix is stored');

select ok(template_index_test.statement_fails($$
  select public.save_template_index_configuration(
    '91111111-0000-0000-0000-000000000001',' Y ',null,false,
    '[{"template_field_id":"91111111-f000-0000-0000-000000000001","sort_order":0},{"template_field_id":"91111111-f000-0000-0000-000000000001","sort_order":1}]'::jsonb
  )
$$), 'Duplicate selected fields are rejected');
select ok(template_index_test.statement_fails($$
  select public.save_template_index_configuration(
    '91111111-0000-0000-0000-000000000001',' Y ',null,false,
    '[{"template_field_id":"91111111-f000-0000-0000-000000000001","sort_order":0},{"template_field_id":"91111111-f000-0000-0000-000000000002","sort_order":0}]'::jsonb
  )
$$), 'Duplicate sort order is rejected');
select ok(template_index_test.statement_fails($$
  select public.save_template_index_configuration(
    '91111111-0000-0000-0000-000000000001',' Y ',null,false,'[]'::jsonb
  )
$$), 'Empty selection requires explicit acceptance');
select ok(template_index_test.statement_fails($$
  select public.save_template_index_configuration(
    '92222222-0000-0000-0000-000000000001',' Y ',null,false,'[]'::jsonb
  )
$$), 'Owner cannot configure a foreign template');
select ok(template_index_test.statement_fails($$
  select public.save_template_index_configuration(
    '91111111-0000-0000-0000-000000000001',' Y ',null,false,
    '[{"template_field_id":"91111111-f000-0000-0000-000000000003","sort_order":0}]'::jsonb
  )
$$), 'A selected field must belong to the configured template');

select ok(template_index_test.statement_succeeds($$
  select public.save_template_index_configuration(
    '91111111-0000-0000-0000-000000000001',' / ',null,false,
    '[{"template_field_id":"91111111-f000-0000-0000-000000000001","sort_order":0}]'::jsonb
  )
$$), 'Saving again updates the reusable configuration');
select is((select count(*) from public.template_index_configurations),
  1::bigint, 'Updating does not create a second configuration');
select is((select count(*) from public.template_index_configuration_fields),
  1::bigint, 'Updating reconciles selected fields atomically');

select ok(template_index_test.statement_succeeds($$
  delete from public.template_fields
   where id = '91111111-f000-0000-0000-000000000001'
$$), 'Owner can remove a selected template field');
select is((select count(*) from public.template_index_configurations),
  1::bigint, 'Deleting a field preserves the configuration');
select ok((select not is_complete from public.template_index_configurations),
  'Deleting a selected field marks the configuration incomplete');

reset role;
select set_config('request.jwt.claim.sub','92222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select is((select count(*) from public.template_index_configurations),
  0::bigint, 'Another owner cannot read configurations');
select is(template_index_test.statement_row_count($$
  update public.template_index_configurations set party_separator = ', '
   where owner_id = '91111111-1111-1111-1111-111111111111'
$$), 0::bigint, 'Another owner cannot update configurations');
select ok(template_index_test.statement_succeeds($$
  select public.save_template_index_configuration(
    '92222222-0000-0000-0000-000000000001',' Y ',null,false,
    '[{"template_field_id":"92222222-f000-0000-0000-000000000001","sort_order":0}]'::jsonb
  )
$$), 'A second owner can save an independent configuration');
select is((select count(*) from public.template_index_configurations),
  1::bigint, 'Second owner sees only their configuration');
select ok(template_index_test.statement_fails($$
  insert into public.template_index_configuration_fields
    (configuration_id, owner_id, template_id, template_field_id, sort_order)
  select c.id, c.owner_id, c.template_id,
    '91111111-f000-0000-0000-000000000002'::uuid, 1
  from public.template_index_configurations c
$$), 'A configuration cannot reference another owner field');

reset role;
select set_config('request.jwt.claim.sub','', true);
set local role anon;
select is((select count(*) from public.template_index_configurations),
  0::bigint, 'Anonymous cannot read configurations');

reset role;
select * from finish();
rollback;
