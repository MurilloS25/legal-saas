begin;

set search_path = public, extensions;

select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('c1e50000-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','clients-idsearch@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

insert into public.clients (id, owner_id, full_name, identification_type,
    identification_number, marital_status, nationality, occupation, exact_address)
values
  ('c1e50000-c000-0000-0000-000000000001','c1e50000-1111-1111-1111-111111111111',
   'Física sin guiones','cedula_fisica','208390123','Soltero/a','costarricense','Abogado','Heredia'),
  ('c1e50000-c000-0000-0000-000000000002','c1e50000-1111-1111-1111-111111111111',
   'Física con guiones y espacios','cedula_fisica',' 1-0234 0567 ','Soltero/a','costarricense','Abogado','Heredia');

insert into public.clients (id, owner_id, full_name, identification_type,
    identification_number, exact_address)
values
  ('c1e50000-c000-0000-0000-000000000003','c1e50000-1111-1111-1111-111111111111',
   'Sociedad','cedula_juridica','3-101-123456','San José');

select has_column('public', 'clients', 'identification_search',
  'clients has the identification_search column');

select is(
  (select is_generated from information_schema.columns
    where table_schema = 'public' and table_name = 'clients'
      and column_name = 'identification_search'),
  'ALWAYS',
  'identification_search is a generated column (cannot drift)'
);

select is(
  (select identification_search from public.clients where id = 'c1e50000-c000-0000-0000-000000000001'),
  '208390123',
  'a physical id without separators is unchanged'
);

select is(
  (select identification_search from public.clients where id = 'c1e50000-c000-0000-0000-000000000002'),
  '102340567',
  'hyphens and spaces are removed from a physical id'
);

select is(
  (select identification_search from public.clients where id = 'c1e50000-c000-0000-0000-000000000003'),
  '3101123456',
  'the hyphens of a cédula jurídica are removed for search'
);

select is(
  (select identification_number from public.clients where id = 'c1e50000-c000-0000-0000-000000000003'),
  '3-101-123456',
  'the original identification is preserved exactly as entered'
);

update public.clients
   set identification_number = '4-000-999999'
 where id = 'c1e50000-c000-0000-0000-000000000003';

select is(
  (select identification_search from public.clients where id = 'c1e50000-c000-0000-0000-000000000003'),
  '4000999999',
  'the search value is recomputed on UPDATE'
);

select is(
  (select count(*)::int from public.clients
    where owner_id = 'c1e50000-1111-1111-1111-111111111111'
      and identification_search like '%3%1%0%1%'),
  0,
  'no client matches a wildcard-between-digits pattern that does not really contain the digits'
);

select is(
  (select count(*)::int from public.clients
    where owner_id = 'c1e50000-1111-1111-1111-111111111111'
      and identification_search ilike '%' || '10234' || '%'),
  1,
  'a partial normalized number finds the client'
);

select throws_ok(
  $$insert into public.clients (owner_id, full_name, identification_type,
      identification_number, identification_search, marital_status, nationality, occupation, exact_address)
    values ('c1e50000-1111-1111-1111-111111111111','Manual','cedula_fisica','1','x','Soltero/a','cr','a','b')$$,
  '428C9', null,
  'identification_search cannot be written directly'
);

select * from finish();

rollback;
