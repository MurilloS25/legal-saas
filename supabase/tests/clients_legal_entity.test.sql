begin;

set search_path = public, extensions;

select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('c1e00000-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','clients-legal-a@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('c1e00000-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','clients-legal-b@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

select set_config('request.jwt.claim.sub', 'c1e00000-1111-1111-1111-111111111111', true);
set local role authenticated;

-- ---------------------------------------------------------------- persona física

select lives_ok(
  $$insert into public.clients (id, owner_id, full_name, identification_type,
      identification_number, marital_status, nationality, occupation, exact_address)
    values ('c1e00000-c000-0000-0000-000000000001','c1e00000-1111-1111-1111-111111111111',
      'Juan Pérez','cedula_fisica','108880777','Casado/a una vez','costarricense','Abogado','Heredia')$$,
  'persona física with all personal fields is accepted (unchanged)'
);

select throws_ok(
  $$insert into public.clients (owner_id, full_name, identification_type,
      identification_number, marital_status, nationality, occupation, exact_address)
    values ('c1e00000-1111-1111-1111-111111111111',
      'Sin estado civil','cedula_fisica','108880778',null,'costarricense','Abogado','Heredia')$$,
  '23514', null,
  'persona física still requires marital_status'
);

select throws_ok(
  $$insert into public.clients (owner_id, full_name, identification_type,
      identification_number, marital_status, nationality, occupation, exact_address)
    values ('c1e00000-1111-1111-1111-111111111111',
      'Sin ocupación','cedula_fisica','108880779','Soltero/a','costarricense',null,'Heredia')$$,
  '23514', null,
  'persona física still requires occupation'
);

-- ---------------------------------------------------------------- persona jurídica

select lives_ok(
  $$insert into public.clients (id, owner_id, full_name, identification_type,
      identification_number, exact_address)
    values ('c1e00000-c000-0000-0000-000000000002','c1e00000-1111-1111-1111-111111111111',
      'Inversiones Ejemplo S.A.','cedula_juridica','3-101-123456','San José')$$,
  'persona jurídica without personal fields is accepted'
);

select is(
  (select identification_number from public.clients
    where id = 'c1e00000-c000-0000-0000-000000000002'),
  '3-101-123456',
  'cédula jurídica keeps its hyphens in the database'
);

select lives_ok(
  $$insert into public.clients (owner_id, full_name, identification_type,
      identification_number, exact_address)
    values ('c1e00000-1111-1111-1111-111111111111',
      'Sociedad sin guiones','cedula_juridica','3101123456','San José')$$,
  'cédula jurídica written without hyphens remains valid'
);

select throws_ok(
  $$insert into public.clients (owner_id, full_name, identification_type,
      identification_number, marital_status, exact_address)
    values ('c1e00000-1111-1111-1111-111111111111',
      'Sociedad casada','cedula_juridica','3-101-000001','Casado/a','San José')$$,
  '23514', null,
  'persona jurídica cannot carry a marital status'
);

select throws_ok(
  $$insert into public.clients (owner_id, full_name, identification_type,
      identification_number, exact_address)
    values ('c1e00000-1111-1111-1111-111111111111',
      'Sociedad inválida','cedula_juridica','3-101-ABC','San José')$$,
  '23514', null,
  'cédula jurídica rejects non-digit characters'
);

select throws_ok(
  $$insert into public.clients (owner_id, full_name, identification_type,
      identification_number, marital_status, nationality, occupation, exact_address)
    values ('c1e00000-1111-1111-1111-111111111111',
      'Pasaporte','pasaporte','A123','Soltero/a','x','x','x')$$,
  '23514', null,
  'identification types other than cédula física/jurídica are still rejected'
);

-- Física -> jurídica clears the personal fields in the same update.
select lives_ok(
  $$update public.clients
       set identification_type = 'cedula_juridica',
           identification_number = '3-102-654321',
           marital_status = null, nationality = null, occupation = null
     where id = 'c1e00000-c000-0000-0000-000000000001'$$,
  'a client can be switched to persona jurídica clearing personal fields'
);

-- ---------------------------------------------------------------- RLS unchanged

select set_config('request.jwt.claim.sub', 'c1e00000-2222-2222-2222-222222222222', true);

select is(
  (select count(*) from public.clients
    where id = 'c1e00000-c000-0000-0000-000000000002'),
  0::bigint,
  'another workspace cannot read a legal-entity client'
);

-- ---------------------------------------------------------------- autofill sources

select set_config('request.jwt.claim.sub', 'c1e00000-1111-1111-1111-111111111111', true);

select lives_ok(
  $$select * from public.save_template_workspace(
    null, null, 'Machote autollenado', null, 'draft',
    '{"version":1,"document":{"type":"doc","content":[]},"text":""}'::jsonb,
    '',
    '[{"field_key":"comprador.estado_civil","label":"Estado civil","required":false,"autofill_source":"client_marital_status"},
      {"field_key":"comprador.ocupacion","label":"Ocupación","required":false,"autofill_source":"client_occupation"},
      {"field_key":"comprador.nacionalidad","label":"Nacionalidad","required":false,"autofill_source":"client_nationality"},
      {"field_key":"comprador.nombre","label":"Nombre","required":false,"autofill_source":"client_full_name"}]'::jsonb
  )$$,
  'save_template_workspace accepts the new client autofill sources'
);

select is(
  (select array_agg(autofill_source order by sort_order) from public.template_fields
    where template_id = (select id from public.templates where name = 'Machote autollenado')),
  array['client_marital_status','client_occupation','client_nationality','client_full_name'],
  'new autofill sources are persisted'
);

select throws_ok(
  $$select * from public.save_template_workspace(
    null, null, 'Machote inválido', null, 'draft',
    '{"version":1,"document":{"type":"doc","content":[]},"text":""}'::jsonb,
    '',
    '[{"field_key":"comprador.correo","label":"Correo","required":false,"autofill_source":"client_email"}]'::jsonb
  )$$,
  '22023', 'invalid_template_field',
  'unknown autofill sources are still rejected by the RPC'
);

reset role;

select throws_ok(
  $$update public.template_fields set autofill_source = 'client_email'
     where template_id = (select id from public.templates where name = 'Machote autollenado')$$,
  '23514', null,
  'template_fields CHECK still rejects unknown autofill sources'
);

select * from finish();
rollback;
