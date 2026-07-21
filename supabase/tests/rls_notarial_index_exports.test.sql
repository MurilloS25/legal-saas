begin;

set search_path = public, extensions;

select plan(15);

create schema rls_nie_test;
grant usage on schema rls_nie_test to public;

create function rls_nie_test.statement_fails(statement text)
returns boolean language plpgsql as $$
begin execute statement; return false;
exception when others then return true; end; $$;

create function rls_nie_test.statement_row_count(statement text)
returns bigint language plpgsql as $$
declare n bigint; begin execute statement; get diagnostics n = row_count; return n; end; $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('91111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-nie-a@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('92222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-nie-b@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

-- ------------------------------------------------------------------ user A
select set_config('request.jwt.claim.sub','91111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select public.log_notarial_index_export('docx', '2026-07-01', '2026-07-15', 12);

select is((select count(*) from public.notarial_index_exports),
  1::bigint, 'The RPC records one export for the caller');

select is((select row_count from public.notarial_index_exports limit 1),
  12, 'The export row stores the row count');

select is((select owner_id from public.notarial_index_exports limit 1),
  '91111111-1111-1111-1111-111111111111'::uuid, 'The export owner is auth.uid()');

select is((select format from public.notarial_index_exports limit 1),
  'docx', 'The operational row records the only supported format');

select public.log_notarial_index_export('csv', '2026-07-01', '2026-07-15', 12);

select is((select count(*) from public.notarial_index_exports),
  1::bigint, 'The retired CSV format is rejected by the RPC');

select public.log_notarial_index_export('xlsx', '2026-07-01', '2026-07-31', 12);

select is((select count(*) from public.notarial_index_exports),
  1::bigint, 'Invalid export formats are ignored by the RPC');

select public.log_notarial_index_export('docx', null, null, -10);

select is((select row_count from public.notarial_index_exports where from_date is null limit 1),
  0, 'Negative export row counts are clamped to zero');

-- INSERT directo bloqueado.
select ok(rls_nie_test.statement_fails($$
  insert into public.notarial_index_exports (owner_id, format, row_count)
  values ('91111111-1111-1111-1111-111111111111','docx',1)
$$), 'Direct INSERT into notarial_index_exports is blocked');

select is(rls_nie_test.statement_row_count($$
  update public.notarial_index_exports set row_count = 99
$$), 0::bigint, 'Direct UPDATE into notarial_index_exports changes no rows');

select is(rls_nie_test.statement_row_count($$
  delete from public.notarial_index_exports where from_date is null
$$), 1::bigint, 'User A can delete their own operational export history row');

select is((select count(*) from public.notarial_index_exports),
  1::bigint, 'Deleting one own export keeps other own export rows intact');

-- ------------------------------------------------------------------ user B
reset role;
select set_config('request.jwt.claim.sub','92222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is((select count(*) from public.notarial_index_exports),
  0::bigint, 'User B cannot see User A exports');

select is(rls_nie_test.statement_row_count($$
  delete from public.notarial_index_exports
$$), 0::bigint, 'User B cannot delete User A exports');

-- ------------------------------------------------------------------ anon
reset role;
select set_config('request.jwt.claim.sub','', true);
set local role anon;
select is((select count(*) from public.notarial_index_exports),
  0::bigint, 'Anonymous users cannot read exports');

select ok(not has_function_privilege(
  'anon',
  'public.log_notarial_index_export(text, date, date, integer)',
  'EXECUTE'
), 'Anonymous users cannot execute the export logging RPC');

reset role;
select * from finish();
rollback;
