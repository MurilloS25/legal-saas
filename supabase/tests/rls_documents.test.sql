begin;

set search_path = public, extensions;

select plan(20);

create schema rls_doc_test;
grant usage on schema rls_doc_test to public;

create function rls_doc_test.statement_succeeds(statement text)
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

create function rls_doc_test.statement_fails(statement text)
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

create function rls_doc_test.statement_row_count(statement text)
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  execute statement;
  get diagnostics affected_rows = row_count;
  return affected_rows;
exception when others then
  raise notice 'statement failed unexpectedly: % (%)', sqlerrm, sqlstate;
  return -1;
end;
$$;

-- ------------------------------------------------------------------ seed

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '31111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-doc-user-a@example.test',
    'fake-local-password-hash',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '32222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-doc-user-b@example.test',
    'fake-local-password-hash',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.templates (id, owner_id, name, status, content_json)
values
  (
    '31111111-0000-0000-0000-000000000001',
    '31111111-1111-1111-1111-111111111111',
    'Fake Template Doc A',
    'draft',
    '{}'::jsonb
  ),
  (
    '32222222-0000-0000-0000-000000000001',
    '32222222-2222-2222-2222-222222222222',
    'Fake Template Doc B',
    'draft',
    '{}'::jsonb
  );

insert into public.documents (
  id,
  owner_id,
  template_id,
  title,
  field_values,
  rendered_content
)
values (
  '32222222-0000-0000-0000-000000000002',
  '32222222-2222-2222-2222-222222222222',
  '32222222-0000-0000-0000-000000000001',
  'Fake Document B',
  '{"buyer_1.full_name": "Fake Client B"}'::jsonb,
  'Comparece Fake Client B.'
);

-- ------------------------------------------------------------------ user A

select set_config('request.jwt.claim.sub', '31111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select ok(
  rls_doc_test.statement_succeeds($$
    insert into public.documents (
      id, owner_id, template_id, title, field_values, rendered_content
    )
    values (
      '31111111-0000-0000-0000-000000000002',
      '31111111-1111-1111-1111-111111111111',
      '31111111-0000-0000-0000-000000000001',
      'Fake Document A',
      '{"buyer_1.full_name": "Test Client One"}'::jsonb,
      'Comparece Test Client One, con cédula 0-0000-0000.'
    )
  $$),
  'User A can create a document under their own template'
);

select is(
  (select status from public.documents where id = '31111111-0000-0000-0000-000000000002'),
  'draft',
  'A new document defaults to draft status'
);

select is(
  (select field_values ->> 'buyer_1.full_name'
   from public.documents
   where id = '31111111-0000-0000-0000-000000000002'),
  'Test Client One',
  'field_values preserves the exact text written by the user'
);

select ok(
  rls_doc_test.statement_fails($$
    insert into public.documents (id, owner_id, template_id, title)
    values (
      'aaaaaaaa-3000-0000-0000-000000000001',
      '32222222-2222-2222-2222-222222222222',
      '32222222-0000-0000-0000-000000000001',
      'Cross owner document'
    )
  $$),
  'User A cannot create a document with User B owner_id'
);

select ok(
  rls_doc_test.statement_fails($$
    insert into public.documents (id, owner_id, template_id, title)
    values (
      'aaaaaaaa-3000-0000-0000-000000000002',
      '31111111-1111-1111-1111-111111111111',
      '32222222-0000-0000-0000-000000000001',
      'Cross template document'
    )
  $$),
  'User A cannot create a document under User B template'
);

select ok(
  rls_doc_test.statement_fails($$
    update public.documents
    set owner_id = '32222222-2222-2222-2222-222222222222'
    where id = '31111111-0000-0000-0000-000000000002'
  $$),
  'User A cannot update document owner_id to transfer ownership'
);

select ok(
  rls_doc_test.statement_fails($$
    insert into public.documents (id, owner_id, template_id, title, status)
    values (
      'aaaaaaaa-3000-0000-0000-000000000003',
      '31111111-1111-1111-1111-111111111111',
      '31111111-0000-0000-0000-000000000001',
      'Invalid status document',
      'signed'
    )
  $$),
  'A document cannot be created with a status other than draft'
);

select ok(
  rls_doc_test.statement_fails($$
    insert into public.documents (id, owner_id, template_id, title)
    values (
      'aaaaaaaa-3000-0000-0000-000000000004',
      '31111111-1111-1111-1111-111111111111',
      '31111111-0000-0000-0000-000000000001',
      '   '
    )
  $$),
  'A document cannot be created with a blank title'
);

select ok(
  rls_doc_test.statement_fails($$
    insert into public.documents (id, owner_id, template_id, title, field_values)
    values (
      'aaaaaaaa-3000-0000-0000-000000000005',
      '31111111-1111-1111-1111-111111111111',
      '31111111-0000-0000-0000-000000000001',
      'Array values document',
      '["not", "an", "object"]'::jsonb
    )
  $$),
  'field_values must be a JSON object, not an array'
);

select is(
  (select option_selections from public.documents where id = '31111111-0000-0000-0000-000000000002'),
  '{}'::jsonb,
  'option_selections defaults to an empty object'
);

select ok(
  rls_doc_test.statement_succeeds($$
    update public.documents
    set option_selections = '{"block-1": "variant-2"}'::jsonb
    where id = '31111111-0000-0000-0000-000000000002'
  $$),
  'User A can update option_selections on their own document'
);

select ok(
  rls_doc_test.statement_fails($$
    insert into public.documents (id, owner_id, template_id, title, option_selections)
    values (
      'aaaaaaaa-3000-0000-0000-000000000007',
      '31111111-1111-1111-1111-111111111111',
      '31111111-0000-0000-0000-000000000001',
      'Array option_selections document',
      '["not", "an", "object"]'::jsonb
    )
  $$),
  'option_selections must be a JSON object, not an array'
);

select is(
  (select count(*) from public.documents),
  1::bigint,
  'User A sees only their own documents'
);

select ok(
  rls_doc_test.statement_succeeds($$
    update public.documents
    set title = 'Fake Document A (edited)'
    where id = '31111111-0000-0000-0000-000000000002'
  $$),
  'User A can update their own document'
);

select ok(
  rls_doc_test.statement_fails($$
    delete from public.templates
    where id = '31111111-0000-0000-0000-000000000001'
  $$),
  'A template with associated documents cannot be deleted'
);

-- ------------------------------------------------------------------ user B

reset role;
select set_config('request.jwt.claim.sub', '32222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is(
  (select count(*) from public.documents),
  1::bigint,
  'User B cannot see User A documents — only sees their own'
);

select is(
  rls_doc_test.statement_row_count($$
    update public.documents
    set title = 'Hacked title'
    where id = '31111111-0000-0000-0000-000000000002'
  $$),
  0::bigint,
  'User B cannot update User A documents'
);

select is(
  rls_doc_test.statement_row_count($$
    delete from public.documents
    where id = '31111111-0000-0000-0000-000000000002'
  $$),
  0::bigint,
  'User B cannot delete User A documents'
);

-- ------------------------------------------------------------------ anonymous

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select is(
  (select count(*) from public.documents),
  0::bigint,
  'Anonymous users cannot select private document data'
);

select ok(
  rls_doc_test.statement_fails($$
    insert into public.documents (id, owner_id, template_id, title)
    values (
      'aaaaaaaa-3000-0000-0000-000000000006',
      '31111111-1111-1111-1111-111111111111',
      '31111111-0000-0000-0000-000000000001',
      'Anonymous document'
    )
  $$),
  'Anonymous users cannot insert documents'
);

reset role;

select * from finish();

rollback;
