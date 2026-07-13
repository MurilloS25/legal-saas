begin;

set search_path = public, extensions;

select plan(10);

create schema rls_docclient_test;
grant usage on schema rls_docclient_test to public;

create function rls_docclient_test.statement_succeeds(statement text)
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

create function rls_docclient_test.statement_fails(statement text)
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

-- ------------------------------------------------------------------ seed

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '41111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'rls-docclient-a@example.test', 'fake-local-password-hash', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '42222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'rls-docclient-b@example.test', 'fake-local-password-hash', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.templates (id, owner_id, name, status, content_json)
values
  ('41111111-0000-0000-0000-000000000001', '41111111-1111-1111-1111-111111111111', 'Tpl A', 'draft', '{}'::jsonb),
  ('42222222-0000-0000-0000-000000000001', '42222222-2222-2222-2222-222222222222', 'Tpl B', 'draft', '{}'::jsonb);

insert into public.clients (
  id, owner_id, full_name, identification_type, identification_number,
  marital_status, nationality, occupation, exact_address
)
values
  ('41111111-c000-0000-0000-000000000001', '41111111-1111-1111-1111-111111111111',
   'Cliente A', 'cedula_fisica', '0-0000-0001', 'single', 'CR', 'Tester', 'Fake address A'),
  ('42222222-c000-0000-0000-000000000001', '42222222-2222-2222-2222-222222222222',
   'Cliente B', 'cedula_fisica', '0-0000-0002', 'single', 'CR', 'Tester', 'Fake address B');

-- ------------------------------------------------------------------ user A
select set_config('request.jwt.claim.sub', '41111111-1111-1111-1111-111111111111', true);
set local role authenticated;

-- Documento con cliente propio.
select ok(
  rls_docclient_test.statement_succeeds($$
    insert into public.documents (id, owner_id, template_id, client_id, title, field_values, rendered_content)
    values ('41111111-d000-0000-0000-000000000001', '41111111-1111-1111-1111-111111111111',
            '41111111-0000-0000-0000-000000000001', '41111111-c000-0000-0000-000000000001',
            'Doc con cliente A', '{}'::jsonb, '')
  $$),
  'User A can create a document associated with their own client'
);

select is(
  (select client_id from public.documents where id = '41111111-d000-0000-0000-000000000001'),
  '41111111-c000-0000-0000-000000000001'::uuid,
  'The document stores the associated client_id'
);

-- Documento sin cliente (opcional).
select ok(
  rls_docclient_test.statement_succeeds($$
    insert into public.documents (id, owner_id, template_id, title, field_values, rendered_content)
    values ('41111111-d000-0000-0000-000000000002', '41111111-1111-1111-1111-111111111111',
            '41111111-0000-0000-0000-000000000001', 'Doc sin cliente', '{}'::jsonb, '')
  $$),
  'User A can create a document without a client (client_id is optional)'
);

select is(
  (select client_id from public.documents where id = '41111111-d000-0000-0000-000000000002'),
  null,
  'A document without a client has client_id NULL'
);

-- No puede asociar un cliente ajeno.
select ok(
  rls_docclient_test.statement_fails($$
    insert into public.documents (id, owner_id, template_id, client_id, title, field_values, rendered_content)
    values ('41111111-d000-0000-0000-000000000003', '41111111-1111-1111-1111-111111111111',
            '41111111-0000-0000-0000-000000000001', '42222222-c000-0000-0000-000000000001',
            'Doc con cliente ajeno', '{}'::jsonb, '')
  $$),
  'User A cannot create a document associated with User B client'
);

-- No puede actualizar para asociar un cliente ajeno.
select ok(
  rls_docclient_test.statement_fails($$
    update public.documents
    set client_id = '42222222-c000-0000-0000-000000000001'
    where id = '41111111-d000-0000-0000-000000000002'
  $$),
  'User A cannot update a document to a foreign client'
);

-- Puede quitar la asociación (client_id -> NULL).
select ok(
  rls_docclient_test.statement_succeeds($$
    update public.documents set client_id = null
    where id = '41111111-d000-0000-0000-000000000001'
  $$),
  'User A can remove the client association'
);

-- ON DELETE SET NULL: reasociar y borrar el cliente deja la escritura.
update public.documents set client_id = '41111111-c000-0000-0000-000000000001'
where id = '41111111-d000-0000-0000-000000000001';

delete from public.clients where id = '41111111-c000-0000-0000-000000000001';

select is(
  (select count(*) from public.documents where id = '41111111-d000-0000-0000-000000000001'),
  1::bigint,
  'Deleting the client keeps the document (no destructive cascade)'
);

select is(
  (select client_id from public.documents where id = '41111111-d000-0000-0000-000000000001'),
  null,
  'ON DELETE SET NULL clears client_id when the client is deleted'
);

select is(
  (select owner_id from public.documents where id = '41111111-d000-0000-0000-000000000001'),
  '41111111-1111-1111-1111-111111111111'::uuid,
  'owner_id is preserved when the client is deleted (column-list SET NULL)'
);

reset role;

select * from finish();

rollback;
