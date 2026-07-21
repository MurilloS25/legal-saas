begin;

set search_path = public, extensions;

select plan(26);

create schema rls_dnm_test;
grant usage on schema rls_dnm_test to public;

create function rls_dnm_test.statement_succeeds(statement text)
returns boolean language plpgsql as $$
begin execute statement; return true;
exception when others then
  raise notice 'failed: % (%)', sqlerrm, sqlstate; return false; end; $$;

create function rls_dnm_test.statement_fails(statement text)
returns boolean language plpgsql as $$
begin execute statement; return false;
exception when others then return true; end; $$;

create function rls_dnm_test.statement_row_count(statement text)
returns bigint language plpgsql as $$
declare n bigint; begin execute statement; get diagnostics n = row_count; return n; end; $$;

create function rls_dnm_test.event_count(doc uuid, etype text)
returns bigint language sql as $$
  select count(*) from public.document_activity
   where document_id = doc and event_type = etype; $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('71111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-dnm-a@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('72222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-dnm-b@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

insert into public.templates (id, owner_id, name, status, content_json) values
  ('71111111-0000-0000-0000-000000000001','71111111-1111-1111-1111-111111111111','Tpl A','draft','{}'::jsonb),
  ('72222222-0000-0000-0000-000000000001','72222222-2222-2222-2222-222222222222','Tpl B','draft','{}'::jsonb);

insert into public.documents (id, owner_id, template_id, title, field_values, rendered_content) values
  ('71111111-d000-0000-0000-000000000001','71111111-1111-1111-1111-111111111111','71111111-0000-0000-0000-000000000001','Doc A','{}'::jsonb,''),
  ('71111111-d000-0000-0000-000000000002','71111111-1111-1111-1111-111111111111','71111111-0000-0000-0000-000000000001','Doc A 2','{}'::jsonb,''),
  ('71111111-d000-0000-0000-000000000003','71111111-1111-1111-1111-111111111111','71111111-0000-0000-0000-000000000001','Doc A 3','{}'::jsonb,''),
  ('72222222-d000-0000-0000-000000000001','72222222-2222-2222-2222-222222222222','72222222-0000-0000-0000-000000000001','Doc B','{}'::jsonb,'');

select set_config('request.jwt.claim.sub','71111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select ok(rls_dnm_test.statement_succeeds($$
  insert into public.document_notarial_metadata
    (owner_id, document_id, act_name_snapshot)
  values
    ('71111111-1111-1111-1111-111111111111','71111111-d000-0000-0000-000000000001','Compraventa')
$$), 'Owner can create metadata for an owned document');

select is(rls_dnm_test.event_count('71111111-d000-0000-0000-000000000001','notarial_metadata_created'),
  1::bigint, 'Insert records the created activity');
select is(rls_dnm_test.event_count('71111111-d000-0000-0000-000000000001','notarial_metadata_completed'),
  0::bigint, 'Incomplete insert does not record completion');

select ok(rls_dnm_test.statement_fails($$
  insert into public.document_notarial_metadata (owner_id, document_id)
  values ('71111111-1111-1111-1111-111111111111','71111111-d000-0000-0000-000000000001')
$$), 'A document has at most one metadata row');

select ok(rls_dnm_test.statement_succeeds($$
  update public.document_notarial_metadata
     set instrument_number = 123,
         authorized_at = '2026-07-15T12:00:00Z',
         protocol_book = '08', initial_folio = '23F', final_folio = '23V',
         generated_parties = 'ANA Y BETO'
   where document_id = '71111111-d000-0000-0000-000000000001'
$$), 'Owner can complete structured metadata');
select is(rls_dnm_test.event_count('71111111-d000-0000-0000-000000000001','notarial_metadata_completed'),
  1::bigint, 'Reaching completeness records completion');
select is(rls_dnm_test.event_count('71111111-d000-0000-0000-000000000001','notarial_metadata_updated'),
  1::bigint, 'A real update records updated activity');
select is((select version from public.document_notarial_metadata
  where document_id = '71111111-d000-0000-0000-000000000001'),
  2, 'A real update advances the optimistic concurrency version');

select ok(rls_dnm_test.statement_succeeds($$
  update public.document_notarial_metadata set final_folio = null
   where document_id = '71111111-d000-0000-0000-000000000001'
$$), 'Metadata may return to incomplete while being reviewed');
select is(rls_dnm_test.event_count('71111111-d000-0000-0000-000000000001','notarial_metadata_marked_incomplete'),
  1::bigint, 'Losing completeness records marked_incomplete');

select ok(rls_dnm_test.statement_fails($$
  update public.document_notarial_metadata set act_name_override = repeat('x', 201)
   where document_id = '71111111-d000-0000-0000-000000000001'
$$), 'Length constraints reject oversized values');
select ok(rls_dnm_test.statement_fails($$
  update public.document_notarial_metadata set instrument_number = 0
   where document_id = '71111111-d000-0000-0000-000000000001'
$$), 'Instrument number must be positive');
select ok(rls_dnm_test.statement_fails($$
  update public.document_notarial_metadata
     set document_id = '71111111-d000-0000-0000-000000000002'
   where document_id = '71111111-d000-0000-0000-000000000001'
$$), 'Metadata cannot move to another document');
select ok(rls_dnm_test.statement_fails($$
  update public.document_notarial_metadata
     set owner_id = '72222222-2222-2222-2222-222222222222'
   where document_id = '71111111-d000-0000-0000-000000000001'
$$), 'Metadata ownership cannot be transferred');

select ok(not has_function_privilege('authenticated',
  'public.enforce_notarial_metadata_editable()', 'EXECUTE'),
  'Authenticated cannot execute the enforcement trigger function');
select ok(not has_function_privilege('authenticated',
  'public.record_notarial_metadata_activity()', 'EXECUTE'),
  'Authenticated cannot execute the activity trigger function');

update public.documents set status = 'ready'
 where id = '71111111-d000-0000-0000-000000000001';
update public.documents set status = 'final'
 where id = '71111111-d000-0000-0000-000000000001';
select ok(rls_dnm_test.statement_succeeds($$
  update public.document_notarial_metadata
     set act_name_override = 'COMPRAVENTA CORREGIDA', final_folio = '23V'
   where document_id = '71111111-d000-0000-0000-000000000001'
$$), 'Metadata remains reviewable after document finalization');
select is((select act_name_override from public.document_notarial_metadata
  where document_id = '71111111-d000-0000-0000-000000000001'),
  'COMPRAVENTA CORREGIDA', 'Manual act correction is preserved');

select ok(rls_dnm_test.statement_fails($$
  insert into public.document_notarial_metadata (owner_id, document_id)
  values ('71111111-1111-1111-1111-111111111111','72222222-d000-0000-0000-000000000001')
$$), 'Owner cannot create metadata under a foreign document');
select ok(rls_dnm_test.statement_fails($$
  insert into public.document_notarial_metadata (owner_id, document_id)
  values ('72222222-2222-2222-2222-222222222222','71111111-d000-0000-0000-000000000002')
$$), 'Owner_id cannot be forged');

select ok(rls_dnm_test.statement_fails($$
  insert into public.document_notarial_metadata
    (owner_id, document_id, instrument_number, authorized_at)
  values
    ('71111111-1111-1111-1111-111111111111','71111111-d000-0000-0000-000000000002',123,'2026-12-01T12:00:00Z')
$$), 'Instrument number is unique per owner and Costa Rica year');
select ok(rls_dnm_test.statement_succeeds($$
  insert into public.document_notarial_metadata
    (owner_id, document_id, instrument_number, authorized_at)
  values
    ('71111111-1111-1111-1111-111111111111','71111111-d000-0000-0000-000000000003',123,'2027-01-01T12:00:00Z')
$$), 'The same instrument number is allowed in a different year');

reset role;
select set_config('request.jwt.claim.sub','72222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select is((select count(*) from public.document_notarial_metadata
  where owner_id = '71111111-1111-1111-1111-111111111111'),
  0::bigint, 'Another owner cannot read metadata');
select is(rls_dnm_test.statement_row_count($$
  update public.document_notarial_metadata set notes = 'hack'
   where document_id = '71111111-d000-0000-0000-000000000001'
$$), 0::bigint, 'Another owner cannot update metadata');

reset role;
select set_config('request.jwt.claim.sub','', true);
set local role anon;
select is((select count(*) from public.document_notarial_metadata),
  0::bigint, 'Anonymous cannot read metadata');
select ok(rls_dnm_test.statement_fails($$
  insert into public.document_notarial_metadata (owner_id, document_id)
  values ('71111111-1111-1111-1111-111111111111','71111111-d000-0000-0000-000000000002')
$$), 'Anonymous cannot insert metadata');

reset role;
select * from finish();
rollback;
