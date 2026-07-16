begin;

set search_path = public, extensions;

select plan(25);

create schema rls_act_test;
grant usage on schema rls_act_test to public;

create function rls_act_test.statement_fails(statement text)
returns boolean
language plpgsql
as $$
begin
  execute statement;
  raise notice 'statement unexpectedly succeeded: %', statement;
  return false;
exception when others then
  return true;
end;
$$;

create function rls_act_test.statement_row_count(statement text)
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  execute statement;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

create function rls_act_test.statement_does_not_mutate(statement text)
returns boolean
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  execute statement;
  get diagnostics affected_rows = row_count;
  return affected_rows = 0;
exception when others then
  return true;
end;
$$;

-- Último event_type registrado para un documento.
create function rls_act_test.latest_event(doc uuid)
returns text
language sql
as $$
  select event_type from public.document_activity
   where document_id = doc
   order by created_at desc, id desc
   limit 1;
$$;

create function rls_act_test.event_count(doc uuid)
returns bigint
language sql
as $$
  select count(*) from public.document_activity where document_id = doc;
$$;

-- seed
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('61111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls-act-a@example.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('62222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls-act-b@example.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.templates (id, owner_id, name, status, content_json)
values ('61111111-0000-0000-0000-000000000001', '61111111-1111-1111-1111-111111111111', 'Tpl A', 'draft', '{}'::jsonb);

insert into public.clients (id, owner_id, full_name, identification_type, identification_number, marital_status, nationality, occupation, exact_address)
values
  ('61111111-c000-0000-0000-000000000001', '61111111-1111-1111-1111-111111111111', 'Cliente Uno', 'cedula_fisica', '0-0000-0001', 'single', 'CR', 'Tester', 'Addr'),
  ('61111111-c000-0000-0000-000000000002', '61111111-1111-1111-1111-111111111111', 'Cliente Dos', 'cedula_fisica', '0-0000-0002', 'single', 'CR', 'Tester', 'Addr');

-- Documento del usuario B (para probar el RPC ajeno).
insert into public.templates (id, owner_id, name, status, content_json)
values ('62222222-0000-0000-0000-000000000001', '62222222-2222-2222-2222-222222222222', 'Tpl B', 'draft', '{}'::jsonb);
insert into public.documents (id, owner_id, template_id, title, field_values, rendered_content)
values ('62222222-d000-0000-0000-000000000001', '62222222-2222-2222-2222-222222222222', '62222222-0000-0000-0000-000000000001', 'Doc B', '{}'::jsonb, '');

-- ------------------------------------------------------------------ user A
select set_config('request.jwt.claim.sub', '61111111-1111-1111-1111-111111111111', true);
set local role authenticated;

insert into public.documents (id, owner_id, template_id, title, field_values, rendered_content)
values ('61111111-d000-0000-0000-000000000001', '61111111-1111-1111-1111-111111111111', '61111111-0000-0000-0000-000000000001', 'Doc A', '{}'::jsonb, '');

select is(
  rls_act_test.event_count('61111111-d000-0000-0000-000000000001'),
  1::bigint,
  'Creating a document records exactly one activity event'
);

select is(
  (select event_type from public.document_activity where document_id = '61111111-d000-0000-0000-000000000001'),
  'document_created',
  'The creation event type is document_created'
);

select is(
  (select actor_user_id from public.document_activity where document_id = '61111111-d000-0000-0000-000000000001'),
  '61111111-1111-1111-1111-111111111111'::uuid,
  'The actor is derived from the authenticated session'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.record_document_activity()',
    'EXECUTE'
  ),
  false,
  'The trigger function is not directly executable by authenticated users'
);

update public.documents set status = 'ready' where id = '61111111-d000-0000-0000-000000000001';
select is(
  rls_act_test.latest_event('61111111-d000-0000-0000-000000000001'),
  'document_status_changed',
  'Changing status draft->ready records document_status_changed'
);
select is(
  (select metadata ->> 'newStatus' from public.document_activity
    where document_id = '61111111-d000-0000-0000-000000000001'
    order by created_at desc, id desc limit 1),
  'ready',
  'The status event stores newStatus in metadata'
);

update public.documents set status = 'final' where id = '61111111-d000-0000-0000-000000000001';
select is(
  rls_act_test.latest_event('61111111-d000-0000-0000-000000000001'),
  'document_finalized',
  'Changing status to final records document_finalized'
);

update public.documents set status = 'draft' where id = '61111111-d000-0000-0000-000000000001';
select is(
  rls_act_test.latest_event('61111111-d000-0000-0000-000000000001'),
  'document_reopened',
  'Reopening from final to draft records document_reopened'
);

update public.documents set client_id = '61111111-c000-0000-0000-000000000001' where id = '61111111-d000-0000-0000-000000000001';
select is(
  (select event_type || '|' || (metadata ->> 'newClientName')
     from public.document_activity where document_id = '61111111-d000-0000-0000-000000000001'
     order by created_at desc, id desc limit 1),
  'document_client_assigned|Cliente Uno',
  'Assigning a client records document_client_assigned with the client name'
);

update public.documents set client_id = '61111111-c000-0000-0000-000000000002' where id = '61111111-d000-0000-0000-000000000001';
select is(
  rls_act_test.latest_event('61111111-d000-0000-0000-000000000001'),
  'document_client_changed',
  'Changing the client records document_client_changed'
);

update public.documents set client_id = null where id = '61111111-d000-0000-0000-000000000001';
select is(
  rls_act_test.latest_event('61111111-d000-0000-0000-000000000001'),
  'document_client_removed',
  'Removing the client records document_client_removed'
);

update public.documents set title = 'Doc A editado' where id = '61111111-d000-0000-0000-000000000001';
select is(
  rls_act_test.latest_event('61111111-d000-0000-0000-000000000001'),
  'document_title_changed',
  'Changing the title records document_title_changed'
);

update public.documents set field_values = '{"a":"b"}'::jsonb, rendered_content = 'x' where id = '61111111-d000-0000-0000-000000000001';
select is(
  rls_act_test.latest_event('61111111-d000-0000-0000-000000000001'),
  'document_content_updated',
  'Changing content records document_content_updated'
);

-- Tras: created, status x3, client x3, title, content = 9 eventos.
select is(
  rls_act_test.event_count('61111111-d000-0000-0000-000000000001'),
  9::bigint,
  'Nine activity events were recorded for the sequence of real changes'
);

-- Guardado sin cambios: no genera evento nuevo (sigue en 9).
update public.documents
  set title = 'Doc A editado',
      field_values = '{"a":"b"}'::jsonb,
      rendered_content = 'x'
  where id = '61111111-d000-0000-0000-000000000001';
select is(
  rls_act_test.event_count('61111111-d000-0000-0000-000000000001'),
  9::bigint,
  'A no-op save records no new activity'
);

-- Atomicidad: una operación inválida no deja actividad.
select ok(
  rls_act_test.statement_fails($$
    update public.documents set status = 'bogus' where id = '61111111-d000-0000-0000-000000000001'
  $$),
  'An invalid status update fails'
);
select is(
  rls_act_test.latest_event('61111111-d000-0000-0000-000000000001'),
  'document_content_updated',
  'The failed operation recorded no activity (still the previous event)'
);

-- RPC de Word.
select public.log_document_word_generated('61111111-d000-0000-0000-000000000001');
select is(
  rls_act_test.latest_event('61111111-d000-0000-0000-000000000001'),
  'document_word_generated',
  'The word-generated RPC records document_word_generated'
);

-- RPC sobre documento ajeno: no registra nada.
select public.log_document_word_generated('62222222-d000-0000-0000-000000000001');
select is(
  rls_act_test.event_count('62222222-d000-0000-0000-000000000001'),
  0::bigint,
  'The word-generated RPC does nothing for a foreign document'
);

-- INSERT arbitrario directo: bloqueado.
select ok(
  rls_act_test.statement_fails($$
    insert into public.document_activity (document_id, owner_id, actor_user_id, event_type)
    values ('61111111-d000-0000-0000-000000000001', '61111111-1111-1111-1111-111111111111',
            '61111111-1111-1111-1111-111111111111', 'forged')
  $$),
  'Direct arbitrary INSERT into document_activity is blocked'
);

select ok(
  rls_act_test.statement_does_not_mutate($$
    update public.document_activity
       set event_type = 'forged'
     where document_id = '61111111-d000-0000-0000-000000000001'
  $$),
  'Direct UPDATE into document_activity cannot mutate rows'
);

select ok(
  rls_act_test.statement_does_not_mutate($$
    delete from public.document_activity
     where document_id = '61111111-d000-0000-0000-000000000001'
  $$),
  'Direct DELETE from document_activity cannot mutate rows'
);

-- ------------------------------------------------------------------ user B
reset role;
select set_config('request.jwt.claim.sub', '62222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is(
  (select count(*) from public.document_activity where document_id = '61111111-d000-0000-0000-000000000001'),
  0::bigint,
  'User B cannot see User A activity'
);

-- ------------------------------------------------------------------ anonymous
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select is(
  (select count(*) from public.document_activity where document_id = '61111111-d000-0000-0000-000000000001'),
  0::bigint,
  'Anonymous users cannot read document activity'
);

select is(
  has_function_privilege(
    'anon',
    'public.log_document_word_generated(uuid)',
    'EXECUTE'
  ),
  false,
  'Anonymous users cannot execute the word-generated RPC'
);

reset role;

select * from finish();

rollback;
