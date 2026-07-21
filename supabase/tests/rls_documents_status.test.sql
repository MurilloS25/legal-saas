begin;

set search_path = public, extensions;

select plan(10);

create schema rls_docstatus_test;
grant usage on schema rls_docstatus_test to public;

create function rls_docstatus_test.statement_succeeds(statement text)
returns boolean
language plpgsql
as $$
begin
  execute statement;
  return true;
exception when others then
  raise notice 'statement failed unexpectedly: % (%)', sqlerrm, sqlstate;
  return false;
end;
$$;

create function rls_docstatus_test.statement_fails(statement text)
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

create function rls_docstatus_test.statement_row_count(statement text)
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

-- seed
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('51111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls-status-a@example.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('52222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls-status-b@example.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.templates (id, owner_id, name, status, content_json)
values ('51111111-0000-0000-0000-000000000001', '51111111-1111-1111-1111-111111111111', 'Tpl A', 'draft', '{}'::jsonb);

insert into public.documents (id, owner_id, template_id, title, field_values, rendered_content)
values ('51111111-d000-0000-0000-000000000001', '51111111-1111-1111-1111-111111111111',
        '51111111-0000-0000-0000-000000000001', 'Doc estado', '{}'::jsonb, '');

-- user A
select set_config('request.jwt.claim.sub', '51111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select is(
  (select status from public.documents where id = '51111111-d000-0000-0000-000000000001'),
  'draft',
  'A new document defaults to draft'
);

select ok(
  rls_docstatus_test.statement_succeeds($$
    update public.documents set status = 'ready'
    where id = '51111111-d000-0000-0000-000000000001'
  $$),
  'The status constraint allows ready'
);

select ok(
  rls_docstatus_test.statement_succeeds($$
    update public.documents set status = 'final'
    where id = '51111111-d000-0000-0000-000000000001'
  $$),
  'The status constraint allows final'
);

select ok(
  rls_docstatus_test.statement_succeeds($$
    update public.documents set status = 'draft'
    where id = '51111111-d000-0000-0000-000000000001'
  $$),
  'The status can be moved back to draft'
);

select ok(
  rls_docstatus_test.statement_fails($$
    update public.documents set status = 'signed'
    where id = '51111111-d000-0000-0000-000000000001'
  $$),
  'The status constraint rejects unknown values'
);

select ok(
  rls_docstatus_test.statement_fails($$
    insert into public.documents (id, owner_id, template_id, title, status)
    values ('aaaaaaaa-5000-0000-0000-000000000001', '51111111-1111-1111-1111-111111111111',
            '51111111-0000-0000-0000-000000000001', 'Bad status', 'archived')
  $$),
  'A document cannot be created with an out-of-set status'
);

-- A finalized document cannot be deleted (must be reopened to draft first),
-- but a draft one can — tested on their own rows so the shared document
-- above stays intact for the rest of this file.
insert into public.documents (id, owner_id, template_id, title, status, field_values, rendered_content)
values (
  '51111111-d000-0000-0000-000000000002', '51111111-1111-1111-1111-111111111111',
  '51111111-0000-0000-0000-000000000001', 'Doc finalizado', 'final', '{}'::jsonb, ''
);

-- Un delete que no matchea ninguna fila por RLS no lanza excepción: solo
-- afecta 0 filas. `statement_fails` no sirve aquí (no hay error que atrapar).
select is(
  rls_docstatus_test.statement_row_count($$
    delete from public.documents where id = '51111111-d000-0000-0000-000000000002'
  $$),
  0::bigint,
  'A finalized document cannot be deleted'
);

select ok(
  rls_docstatus_test.statement_succeeds($$
    update public.documents set status = 'draft'
    where id = '51111111-d000-0000-0000-000000000002'
  $$),
  'Reopening the document to draft succeeds'
);

select ok(
  rls_docstatus_test.statement_succeeds($$
    delete from public.documents where id = '51111111-d000-0000-0000-000000000002'
  $$),
  'The same document can be deleted once reopened to draft'
);

-- user B cannot change user A's status
reset role;
select set_config('request.jwt.claim.sub', '52222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is(
  rls_docstatus_test.statement_row_count($$
    update public.documents set status = 'final'
    where id = '51111111-d000-0000-0000-000000000001'
  $$),
  0::bigint,
  'User B cannot change the status of User A document'
);

reset role;

select * from finish();

rollback;
