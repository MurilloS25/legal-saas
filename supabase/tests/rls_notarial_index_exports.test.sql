begin;

set search_path = public, extensions;

select plan(6);

create schema rls_nie_test;
grant usage on schema rls_nie_test to public;

create function rls_nie_test.statement_fails(statement text)
returns boolean language plpgsql as $$
begin execute statement; return false;
exception when others then return true; end; $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('91111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-nie-a@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('92222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-nie-b@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

-- ------------------------------------------------------------------ user A
select set_config('request.jwt.claim.sub','91111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select public.log_notarial_index_export('csv', '2026-07-01', '2026-07-31', 12);

select is((select count(*) from public.notarial_index_exports),
  1::bigint, 'The RPC records one export for the caller');

select is((select row_count from public.notarial_index_exports limit 1),
  12, 'The export row stores the row count');

select is((select owner_id from public.notarial_index_exports limit 1),
  '91111111-1111-1111-1111-111111111111'::uuid, 'The export owner is auth.uid()');

-- INSERT directo bloqueado.
select ok(rls_nie_test.statement_fails($$
  insert into public.notarial_index_exports (owner_id, format, row_count)
  values ('91111111-1111-1111-1111-111111111111','csv',1)
$$), 'Direct INSERT into notarial_index_exports is blocked');

-- ------------------------------------------------------------------ user B
reset role;
select set_config('request.jwt.claim.sub','92222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is((select count(*) from public.notarial_index_exports),
  0::bigint, 'User B cannot see User A exports');

-- ------------------------------------------------------------------ anon
reset role;
select set_config('request.jwt.claim.sub','', true);
set local role anon;
select is((select count(*) from public.notarial_index_exports),
  0::bigint, 'Anonymous users cannot read exports');

reset role;
select * from finish();
rollback;
