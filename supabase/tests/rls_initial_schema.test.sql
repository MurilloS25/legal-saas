begin;

set search_path = public, extensions;

select plan(30);

create schema rls_test;
grant usage on schema rls_test to public;

create function rls_test.statement_succeeds(statement text)
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

create function rls_test.statement_fails(statement text)
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

create function rls_test.statement_row_count(statement text)
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
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-user-a@example.test',
    'fake-local-password-hash',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-user-b@example.test',
    'fake-local-password-hash',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.lawyer_profiles (
  id,
  owner_id,
  full_name,
  professional_code,
  email,
  phone
)
values (
  '22222222-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  'Fake Lawyer B',
  'B-000',
  'lawyer-b@example.test',
  '0000-0000'
);

insert into public.document_settings (
  id,
  owner_id,
  font_family,
  font_size,
  margin_top_cm,
  margin_bottom_cm,
  margin_left_cm,
  margin_right_cm,
  line_spacing
)
values (
  '22222222-0000-0000-0000-000000000002',
  '22222222-2222-2222-2222-222222222222',
  'Times New Roman',
  12,
  2.5,
  2.5,
  3,
  3,
  1.5
);

insert into public.clients (
  id,
  owner_id,
  full_name,
  identification_type,
  identification_number,
  marital_status,
  nationality,
  occupation,
  exact_address
)
values (
  '22222222-0000-0000-0000-000000000003',
  '22222222-2222-2222-2222-222222222222',
  'Fake Client B',
  'cedula_fisica',
  '2-0000-0000',
  'single',
  'Costa Rican',
  'Engineer',
  'Fake address B'
);

insert into public.templates (
  id,
  owner_id,
  name,
  status,
  content_json
)
values (
  '22222222-0000-0000-0000-000000000004',
  '22222222-2222-2222-2222-222222222222',
  'Fake Template B',
  'draft',
  '{}'::jsonb
);

insert into public.template_fields (
  id,
  owner_id,
  template_id,
  field_key,
  label,
  field_type,
  source,
  sort_order
)
values (
  '22222222-0000-0000-0000-000000000005',
  '22222222-2222-2222-2222-222222222222',
  '22222222-0000-0000-0000-000000000004',
  'full_name',
  'Full name',
  'text',
  'manual',
  1
);

insert into public.document_metadata (
  id,
  owner_id,
  template_id,
  client_id,
  title,
  document_type,
  created_for_index,
  generated_at
)
values (
  '22222222-0000-0000-0000-000000000006',
  '22222222-2222-2222-2222-222222222222',
  '22222222-0000-0000-0000-000000000004',
  '22222222-0000-0000-0000-000000000003',
  'Fake Metadata B',
  'escritura',
  true,
  now()
);

insert into public.notarial_records (
  id,
  owner_id,
  document_metadata_id,
  volume,
  initial_folio,
  final_folio,
  deed_number,
  deed_date,
  deed_time,
  act_or_contract,
  parties,
  period_half,
  period_month,
  period_year
)
values (
  '22222222-0000-0000-0000-000000000007',
  '22222222-2222-2222-2222-222222222222',
  '22222222-0000-0000-0000-000000000006',
  '1',
  '10',
  '11',
  '20',
  date '2026-05-20',
  time '10:00',
  'Fake contract B',
  'Fake parties B',
  'second',
  5,
  2026
);

insert into public.receivables (
  id,
  owner_id,
  client_id,
  document_metadata_id,
  description,
  amount,
  currency,
  status
)
values (
  '22222222-0000-0000-0000-000000000008',
  '22222222-2222-2222-2222-222222222222',
  '22222222-0000-0000-0000-000000000003',
  '22222222-0000-0000-0000-000000000006',
  'Fake receivable B',
  100,
  'CRC',
  'pending'
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select ok(
  rls_test.statement_succeeds($$
    insert into public.lawyer_profiles (
      id,
      owner_id,
      full_name,
      professional_code,
      email,
      phone
    )
    values (
      '11111111-0000-0000-0000-000000000001',
      '11111111-1111-1111-1111-111111111111',
      'Fake Lawyer A',
      'A-000',
      'lawyer-a@example.test',
      '0000-0000'
    )
  $$),
  'User A can create their own lawyer profile'
);

select ok(
  rls_test.statement_succeeds($$
    insert into public.document_settings (
      id,
      owner_id,
      font_family,
      font_size,
      margin_top_cm,
      margin_bottom_cm,
      margin_left_cm,
      margin_right_cm,
      line_spacing
    )
    values (
      '11111111-0000-0000-0000-000000000002',
      '11111111-1111-1111-1111-111111111111',
      'Times New Roman',
      12,
      2.5,
      2.5,
      3,
      3,
      1.5
    )
  $$),
  'User A can create their own document settings'
);

select ok(
  rls_test.statement_succeeds($$
    insert into public.clients (
      id,
      owner_id,
      full_name,
      identification_type,
      identification_number,
      marital_status,
      nationality,
      occupation,
      exact_address
    )
    values (
      '11111111-0000-0000-0000-000000000003',
      '11111111-1111-1111-1111-111111111111',
      'Fake Client A',
      'cedula_fisica',
      '1-0000-0000',
      'single',
      'Costa Rican',
      'Lawyer',
      'Fake address A'
    )
  $$),
  'User A can create their own client'
);

insert into public.clients (
  id,
  owner_id,
  full_name,
  identification_type,
  identification_number,
  marital_status,
  nationality,
  occupation,
  exact_address
)
values (
  '11111111-0000-0000-0000-000000000009',
  '11111111-1111-1111-1111-111111111111',
  'Fake Disposable Client A',
  'cedula_fisica',
  '1-0000-0009',
  'single',
  'Costa Rican',
  'Tester',
  'Fake disposable address A'
);

select is(
  rls_test.statement_row_count($$
    delete from public.clients
    where id = '11111111-0000-0000-0000-000000000009'
  $$),
  1::bigint,
  'User A can delete their own client'
);

select ok(
  rls_test.statement_succeeds($$
    insert into public.templates (
      id,
      owner_id,
      name,
      status,
      content_json
    )
    values (
      '11111111-0000-0000-0000-000000000004',
      '11111111-1111-1111-1111-111111111111',
      'Fake Template A',
      'draft',
      '{}'::jsonb
    )
  $$),
  'User A can create their own template'
);

select ok(
  rls_test.statement_succeeds($$
    insert into public.template_fields (
      id,
      owner_id,
      template_id,
      field_key,
      label,
      field_type,
      source,
      sort_order
    )
    values (
      '11111111-0000-0000-0000-000000000005',
      '11111111-1111-1111-1111-111111111111',
      '11111111-0000-0000-0000-000000000004',
      'full_name',
      'Full name',
      'text',
      'manual',
      1
    )
  $$),
  'User A can create a child field under their own template'
);

select ok(
  rls_test.statement_succeeds($$
    insert into public.document_metadata (
      id,
      owner_id,
      template_id,
      client_id,
      title,
      document_type,
      created_for_index,
      generated_at
    )
    values (
      '11111111-0000-0000-0000-000000000006',
      '11111111-1111-1111-1111-111111111111',
      '11111111-0000-0000-0000-000000000004',
      '11111111-0000-0000-0000-000000000003',
      'Fake Metadata A',
      'escritura',
      true,
      now()
    )
  $$),
  'User A can create metadata under their own template and client'
);

select ok(
  rls_test.statement_succeeds($$
    insert into public.notarial_records (
      id,
      owner_id,
      document_metadata_id,
      volume,
      initial_folio,
      final_folio,
      deed_number,
      deed_date,
      deed_time,
      act_or_contract,
      parties,
      period_half,
      period_month,
      period_year
    )
    values (
      '11111111-0000-0000-0000-000000000007',
      '11111111-1111-1111-1111-111111111111',
      '11111111-0000-0000-0000-000000000006',
      '1',
      '1',
      '2',
      '10',
      date '2026-05-20',
      time '09:00',
      'Fake contract A',
      'Fake parties A',
      'second',
      5,
      2026
    )
  $$),
  'User A can create a notarial record under their own metadata'
);

select ok(
  rls_test.statement_succeeds($$
    insert into public.receivables (
      id,
      owner_id,
      client_id,
      document_metadata_id,
      description,
      amount,
      currency,
      status
    )
    values (
      '11111111-0000-0000-0000-000000000008',
      '11111111-1111-1111-1111-111111111111',
      '11111111-0000-0000-0000-000000000003',
      '11111111-0000-0000-0000-000000000006',
      'Fake receivable A',
      100,
      'CRC',
      'pending'
    )
  $$),
  'User A can create a receivable under their own client and metadata'
);

select is((select count(*) from public.lawyer_profiles), 1::bigint, 'User A sees only their own lawyer profile');
select is((select count(*) from public.clients), 1::bigint, 'User A sees only their own client');
select is((select count(*) from public.templates), 1::bigint, 'User A sees only their own template');

select ok(
  rls_test.statement_fails($$
    insert into public.clients (
      id,
      owner_id,
      full_name,
      identification_type,
      identification_number,
      marital_status,
      nationality,
      occupation,
      exact_address
    )
    values (
      'aaaaaaaa-0000-0000-0000-000000000001',
      '22222222-2222-2222-2222-222222222222',
      'Invalid Cross Owner Client',
      'cedula_fisica',
      '9-0000-0001',
      'single',
      'Costa Rican',
      'Tester',
      'Fake denied address'
    )
  $$),
  'User A cannot create a client with User B owner_id'
);

select ok(
  rls_test.statement_fails($$
    insert into public.template_fields (
      id,
      owner_id,
      template_id,
      field_key,
      label,
      field_type,
      source,
      sort_order
    )
    values (
      'aaaaaaaa-0000-0000-0000-000000000002',
      '11111111-1111-1111-1111-111111111111',
      '22222222-0000-0000-0000-000000000004',
      'cross_owner',
      'Cross owner',
      'text',
      'manual',
      2
    )
  $$),
  'User A cannot create a child field under User B template'
);

select ok(
  rls_test.statement_fails($$
    insert into public.receivables (
      id,
      owner_id,
      client_id,
      document_metadata_id,
      description,
      amount,
      currency,
      status
    )
    values (
      'aaaaaaaa-0000-0000-0000-000000000003',
      '11111111-1111-1111-1111-111111111111',
      '22222222-0000-0000-0000-000000000003',
      '22222222-0000-0000-0000-000000000006',
      'Invalid cross owner receivable',
      100,
      'CRC',
      'pending'
    )
  $$),
  'User A cannot create a receivable under User B client or metadata'
);

select ok(
  rls_test.statement_fails($$
    update public.clients
    set owner_id = '22222222-2222-2222-2222-222222222222'
    where id = '11111111-0000-0000-0000-000000000003'
  $$),
  'User A cannot update owner_id to transfer ownership'
);

select ok(
  rls_test.statement_fails($$
    insert into public.templates (
      id,
      owner_id,
      name,
      status,
      content_json
    )
    values (
      'aaaaaaaa-0000-0000-0000-000000000010',
      '22222222-2222-2222-2222-222222222222',
      'Invalid Cross Owner Template',
      'draft',
      '{}'::jsonb
    )
  $$),
  'User A cannot create a template with User B owner_id'
);

select ok(
  rls_test.statement_fails($$
    update public.templates
    set owner_id = '22222222-2222-2222-2222-222222222222'
    where id = '11111111-0000-0000-0000-000000000004'
  $$),
  'User A cannot update template owner_id to transfer ownership'
);

select is(
  (select count(*) from public.template_fields),
  1::bigint,
  'User A sees only their own template fields'
);

-- Switch to User B and verify they only see their own records (not User A's).
reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is(
  (select count(*) from public.clients),
  1::bigint,
  'User B cannot see User A clients — only sees their own'
);

select is(
  rls_test.statement_row_count($$
    delete from public.clients
    where id = '11111111-0000-0000-0000-000000000003'
  $$),
  0::bigint,
  'User B cannot delete User A client'
);

select is(
  (select count(*) from public.templates),
  1::bigint,
  'User B cannot see User A templates — only sees their own'
);

select is(
  rls_test.statement_row_count($$
    delete from public.templates
    where id = '11111111-0000-0000-0000-000000000004'
  $$),
  0::bigint,
  'User B cannot delete User A template'
);

select is(
  (select count(*) from public.template_fields),
  1::bigint,
  'User B cannot see User A template fields — only sees their own'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select is(
  rls_test.statement_row_count($$
    delete from public.clients
    where id = '11111111-0000-0000-0000-000000000003'
  $$),
  0::bigint,
  'Anonymous users cannot delete private client data'
);

select is((select count(*) from public.clients), 0::bigint, 'Anonymous users cannot select private client data');

select is((select count(*) from public.templates), 0::bigint, 'Anonymous users cannot select private template data');

select ok(
  rls_test.statement_fails($$
    insert into public.templates (
      id,
      owner_id,
      name,
      status,
      content_json
    )
    values (
      'aaaaaaaa-0000-0000-0000-000000000011',
      '11111111-1111-1111-1111-111111111111',
      'Anonymous Template',
      'draft',
      '{}'::jsonb
    )
  $$),
  'Anonymous users cannot insert private template data'
);

select is((select count(*) from public.template_fields), 0::bigint, 'Anonymous users cannot select private template_fields data');

select ok(
  rls_test.statement_fails($$
    insert into public.clients (
      id,
      owner_id,
      full_name,
      identification_type,
      identification_number,
      marital_status,
      nationality,
      occupation,
      exact_address
    )
    values (
      'aaaaaaaa-0000-0000-0000-000000000004',
      '11111111-1111-1111-1111-111111111111',
      'Anonymous Client',
      'cedula_fisica',
      '9-0000-0002',
      'single',
      'Costa Rican',
      'Tester',
      'Fake denied address'
    )
  $$),
  'Anonymous users cannot insert private client data'
);

reset role;

select * from finish();

rollback;
