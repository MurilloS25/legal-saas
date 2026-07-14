begin;

set search_path = public, extensions;

select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a1111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-rec-sum-a@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('a2222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-rec-sum-b@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

insert into public.clients (id, owner_id, full_name, identification_type,
  identification_number, marital_status, nationality, occupation, exact_address)
values
  ('a1111111-c000-0000-0000-000000000001','a1111111-1111-1111-1111-111111111111','Cliente A','cedula_fisica','1-1','soltero','CR','x','y'),
  ('a2222222-c000-0000-0000-000000000001','a2222222-2222-2222-2222-222222222222','Cliente B','cedula_fisica','2-2','casado','CR','x','y');

select set_config('request.jwt.claim.sub','a1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

insert into public.receivables (id, owner_id, client_id, concept, currency, amount_total, issued_at)
values
  ('a1111111-a000-0000-0000-000000000001','a1111111-1111-1111-1111-111111111111','a1111111-c000-0000-0000-000000000001','Honorarios CRC','CRC',100000.00,'2026-07-13'),
  ('a1111111-a000-0000-0000-000000000002','a1111111-1111-1111-1111-111111111111','a1111111-c000-0000-0000-000000000001','Honorarios USD','USD',500.00,'2026-07-13');

select public.register_receivable_payment(
  'a1111111-a000-0000-0000-000000000001',
  40000,
  '2026-07-13',
  'cash',
  null
);

select ok(
  'security_invoker=on' = any(coalesce(
    (select reloptions from pg_class
      where oid = 'public.receivable_entries'::regclass),
    array[]::text[]
  )),
  'receivable_entries uses security_invoker=on'
);

select ok(has_function_privilege(
  'authenticated',
  'public.receivables_summary(text, text, uuid, uuid, text, text, date, date, date, date)',
  'EXECUTE'
), 'Authenticated users can execute receivables_summary');

select ok(not has_function_privilege(
  'anon',
  'public.receivables_summary(text, text, uuid, uuid, text, text, date, date, date, date)',
  'EXECUTE'
), 'Anonymous users cannot execute receivables_summary');

select is((select count(*) from public.receivables_summary()),
  2::bigint, 'Summary returns one row per currency');

select is((select total from public.receivables_summary(p_currency := 'CRC')),
  100000.00::numeric, 'CRC total is kept separate');

select is((select paid from public.receivables_summary(p_currency := 'CRC')),
  40000.00::numeric, 'CRC paid amount sums active payments');

select is((select balance from public.receivables_summary(p_currency := 'CRC')),
  60000.00::numeric, 'CRC balance is total minus active payments');

select is((select total from public.receivables_summary(p_currency := 'USD')),
  500.00::numeric, 'USD total is kept separate');

select is((select count(*) from public.receivables_summary(p_search := 'CRC')),
  1::bigint, 'Search filter is applied to summary');

reset role;
select set_config('request.jwt.claim.sub','a2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is(coalesce((select sum(count) from public.receivables_summary()), 0),
  0::numeric, 'User B summary cannot see User A receivables');

reset role;
select set_config('request.jwt.claim.sub','', true);
set local role anon;

select ok(not has_function_privilege(
  'anon',
  'public.receivables_summary(text, text, uuid, uuid, text, text, date, date, date, date)',
  'EXECUTE'
), 'Anon remains unable to execute receivables_summary as anon role');

reset role;
select * from finish();
rollback;
