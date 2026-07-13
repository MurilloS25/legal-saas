begin;

set search_path = public, extensions;

select plan(15);

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

create function rls_dnm_test.latest_event(doc uuid)
returns text language sql as $$
  select event_type from public.document_activity
   where document_id = doc order by created_at desc, id desc limit 1; $$;

create function rls_dnm_test.event_count(doc uuid, etype text)
returns bigint language sql as $$
  select count(*) from public.document_activity
   where document_id = doc and event_type = etype; $$;

-- seed
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
  ('72222222-d000-0000-0000-000000000001','72222222-2222-2222-2222-222222222222','72222222-0000-0000-0000-000000000001','Doc B','{}'::jsonb,'');

-- ------------------------------------------------------------------ user A
select set_config('request.jwt.claim.sub','71111111-1111-1111-1111-111111111111', true);
set local role authenticated;

-- Crea metadata incompleta.
select ok(rls_dnm_test.statement_succeeds($$
  insert into public.document_notarial_metadata (owner_id, document_id, act_type)
  values ('71111111-1111-1111-1111-111111111111','71111111-d000-0000-0000-000000000001','Compraventa')
$$), 'User A can create notarial metadata for their own document');

select is(rls_dnm_test.latest_event('71111111-d000-0000-0000-000000000001'),
  'notarial_metadata_created', 'Creating metadata records notarial_metadata_created');

select is(rls_dnm_test.event_count('71111111-d000-0000-0000-000000000001','notarial_metadata_completed'),
  0::bigint, 'Incomplete metadata does not record a completed event');

-- 1:1: segunda inserción falla.
select ok(rls_dnm_test.statement_fails($$
  insert into public.document_notarial_metadata (owner_id, document_id, act_type)
  values ('71111111-1111-1111-1111-111111111111','71111111-d000-0000-0000-000000000001','Otro')
$$), 'A document can have at most one notarial metadata row');

-- Completar dispara notarial_metadata_completed.
update public.document_notarial_metadata
  set instrument_number = '123', authorized_at = now()
  where document_id = '71111111-d000-0000-0000-000000000001';
select is(rls_dnm_test.event_count('71111111-d000-0000-0000-000000000001','notarial_metadata_completed'),
  1::bigint, 'Reaching completeness records notarial_metadata_completed');
select is(rls_dnm_test.event_count('71111111-d000-0000-0000-000000000001','notarial_metadata_updated'),
  1::bigint, 'An update records notarial_metadata_updated');

-- Volver a incompleto dispara marked_incomplete.
update public.document_notarial_metadata set instrument_number = null
  where document_id = '71111111-d000-0000-0000-000000000001';
select is(rls_dnm_test.event_count('71111111-d000-0000-0000-000000000001','notarial_metadata_marked_incomplete'),
  1::bigint, 'Losing completeness records notarial_metadata_marked_incomplete');

-- No-op: sin cambios reales, sin evento nuevo (instrument_number ya es null).
select is(rls_dnm_test.statement_row_count($$
  update public.document_notarial_metadata set instrument_number = null
   where document_id = '71111111-d000-0000-0000-000000000001'
$$), 1::bigint, 'A no-op update still touches the row');
-- Hubo dos updates reales antes (completar y perder completitud); el no-op
-- no agrega un tercero.
select is(rls_dnm_test.event_count('71111111-d000-0000-0000-000000000001','notarial_metadata_updated'),
  2::bigint, 'A no-op update records no additional updated event');

-- Bloqueo cuando la escritura está final.
update public.documents set status = 'ready' where id = '71111111-d000-0000-0000-000000000001';
update public.documents set status = 'final' where id = '71111111-d000-0000-0000-000000000001';
select ok(rls_dnm_test.statement_fails($$
  update public.document_notarial_metadata set act_type = 'Bloqueado'
   where document_id = '71111111-d000-0000-0000-000000000001'
$$), 'Notarial metadata cannot be edited while the document is final');

-- No puede crear metadata para documento ajeno.
select ok(rls_dnm_test.statement_fails($$
  insert into public.document_notarial_metadata (owner_id, document_id, act_type)
  values ('71111111-1111-1111-1111-111111111111','72222222-d000-0000-0000-000000000001','X')
$$), 'User A cannot create metadata for a foreign document');

-- No puede falsificar owner_id.
select ok(rls_dnm_test.statement_fails($$
  insert into public.document_notarial_metadata (owner_id, document_id, act_type)
  values ('72222222-2222-2222-2222-222222222222','71111111-d000-0000-0000-000000000001','X')
$$), 'User A cannot forge owner_id on notarial metadata');

-- ------------------------------------------------------------------ user B
reset role;
select set_config('request.jwt.claim.sub','72222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is((select count(*) from public.document_notarial_metadata
  where document_id = '71111111-d000-0000-0000-000000000001'),
  0::bigint, 'User B cannot see User A notarial metadata');

select is(rls_dnm_test.statement_row_count($$
  update public.document_notarial_metadata set act_type = 'Hack'
   where document_id = '71111111-d000-0000-0000-000000000001'
$$), 0::bigint, 'User B cannot update User A notarial metadata');

-- ------------------------------------------------------------------ anon
reset role;
select set_config('request.jwt.claim.sub','', true);
set local role anon;
select is((select count(*) from public.document_notarial_metadata),
  0::bigint, 'Anonymous users cannot read notarial metadata');

reset role;
select * from finish();
rollback;
