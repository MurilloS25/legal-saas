begin;

set search_path = public, extensions;

select plan(27);

create schema rls_rp_test;
grant usage on schema rls_rp_test to public;

create function rls_rp_test.statement_succeeds(statement text)
returns boolean language plpgsql as $$
begin execute statement; return true;
exception when others then
  raise notice 'failed: % (%)', sqlerrm, sqlstate; return false; end; $$;

create function rls_rp_test.statement_fails(statement text)
returns boolean language plpgsql as $$
begin execute statement; return false;
exception when others then return true; end; $$;

create function rls_rp_test.event_count(rec uuid, etype text)
returns bigint language sql as $$
  select count(*) from public.receivable_activity
   where receivable_id = rec and event_type = etype; $$;

create function rls_rp_test.entry_status(rec uuid)
returns text language sql as $$
  select status from public.receivable_entries where id = rec; $$;

create function rls_rp_test.entry_paid(rec uuid)
returns numeric language sql as $$
  select paid_amount from public.receivable_entries where id = rec; $$;

create function rls_rp_test.entry_balance(rec uuid)
returns numeric language sql as $$
  select balance_due from public.receivable_entries where id = rec; $$;

-- seed
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('91111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-rp-a@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('92222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-rp-b@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

insert into public.clients (id, owner_id, full_name, identification_type,
  identification_number, marital_status, nationality, occupation, exact_address)
values
  ('91111111-c000-0000-0000-000000000001','91111111-1111-1111-1111-111111111111','Cliente A','cedula_fisica','1-1','soltero','CR','x','y'),
  ('92222222-c000-0000-0000-000000000001','92222222-2222-2222-2222-222222222222','Cliente B','cedula_fisica','2-2','casado','CR','x','y');

insert into public.receivables (id, owner_id, client_id, concept, currency, amount_total, issued_at)
values
  ('91111111-a000-0000-0000-000000000001','91111111-1111-1111-1111-111111111111','91111111-c000-0000-0000-000000000001','Honorarios','CRC',100000.00,'2026-07-13'),
  ('92222222-a000-0000-0000-000000000001','92222222-2222-2222-2222-222222222222','92222222-c000-0000-0000-000000000001','Ajena','CRC',100000.00,'2026-07-13');

-- ------------------------------------------------------------------ user A
select set_config('request.jwt.claim.sub','91111111-1111-1111-1111-111111111111', true);
set local role authenticated;

-- Primer pago parcial.
select ok(rls_rp_test.statement_succeeds($$
  select public.register_receivable_payment('91111111-a000-0000-0000-000000000001', 40000, null, 'cash', 'rec 1')
$$), 'User A can register a partial payment');
select is(rls_rp_test.entry_paid('91111111-a000-0000-0000-000000000001'), 40000.00::numeric, 'Paid amount reflects the active payment');
select is(rls_rp_test.entry_balance('91111111-a000-0000-0000-000000000001'), 60000.00::numeric, 'Balance is total minus paid');
select is(rls_rp_test.entry_status('91111111-a000-0000-0000-000000000001'), 'partial', 'Status is partial after a partial payment');
select is(rls_rp_test.event_count('91111111-a000-0000-0000-000000000001','payment_registered'), 1::bigint, 'A payment_registered event is recorded');

-- Sobrepago rechazado.
select ok(rls_rp_test.statement_fails($$
  select public.register_receivable_payment('91111111-a000-0000-0000-000000000001', 70000, null, 'sinpe', null)
$$), 'A payment exceeding the balance is rejected');
select is(rls_rp_test.entry_paid('91111111-a000-0000-0000-000000000001'), 40000.00::numeric, 'A rejected overpayment does not change the paid amount');

-- Método inválido y monto no positivo rechazados.
select ok(rls_rp_test.statement_fails($$
  select public.register_receivable_payment('91111111-a000-0000-0000-000000000001', 1000, null, 'crypto', null)
$$), 'An invalid method is rejected');
select ok(rls_rp_test.statement_fails($$
  select public.register_receivable_payment('91111111-a000-0000-0000-000000000001', 0, null, 'cash', null)
$$), 'A non-positive amount is rejected');

-- Segundo pago que salda la cuenta.
select ok(rls_rp_test.statement_succeeds($$
  select public.register_receivable_payment('91111111-a000-0000-0000-000000000001', 60000, null, 'bank_transfer', null)
$$), 'User A can pay the exact remaining balance');
select is(rls_rp_test.entry_status('91111111-a000-0000-0000-000000000001'), 'paid', 'Status is paid once the balance reaches zero');
select is(rls_rp_test.entry_balance('91111111-a000-0000-0000-000000000001'), 0.00::numeric, 'Balance is zero when fully paid');
select is(rls_rp_test.event_count('91111111-a000-0000-0000-000000000001','receivable_paid'), 1::bigint, 'A receivable_paid event is recorded when settled');

-- El pago hereda la moneda de la cuenta.
select is((select currency from public.receivable_payments
  where receivable_id = '91111111-a000-0000-0000-000000000001' order by created_at limit 1),
  'CRC', 'Payment currency is inherited from the receivable');

-- Anular el primer pago reabre la cuenta.
select ok(rls_rp_test.statement_succeeds($$
  select public.void_receivable_payment(
    (select id from public.receivable_payments
      where receivable_id = '91111111-a000-0000-0000-000000000001' and amount = 40000 and status = 'active'),
    'error de digitación')
$$), 'User A can void a payment with a reason');
select is(rls_rp_test.entry_status('91111111-a000-0000-0000-000000000001'), 'partial', 'Voiding a payment reopens a settled receivable');
select is(rls_rp_test.entry_paid('91111111-a000-0000-0000-000000000001'), 60000.00::numeric, 'Voided payments no longer count toward paid');
select is(rls_rp_test.event_count('91111111-a000-0000-0000-000000000001','payment_voided'), 1::bigint, 'A payment_voided event is recorded');
select is(rls_rp_test.event_count('91111111-a000-0000-0000-000000000001','receivable_reopened_after_void'), 1::bigint, 'A receivable_reopened_after_void event is recorded');

-- Anular sin motivo y doble anulación rechazados.
select ok(rls_rp_test.statement_fails($$
  select public.void_receivable_payment(
    (select id from public.receivable_payments
      where receivable_id = '91111111-a000-0000-0000-000000000001' and amount = 60000 and status = 'active'),
    '   ')
$$), 'Voiding without a reason is rejected');
select ok(rls_rp_test.statement_fails($$
  select public.void_receivable_payment(
    (select id from public.receivable_payments
      where receivable_id = '91111111-a000-0000-0000-000000000001' and amount = 40000 and status = 'voided'),
    'otra vez')
$$), 'Voiding an already-voided payment is rejected');

-- No puede pagar una cuenta ajena.
select ok(rls_rp_test.statement_fails($$
  select public.register_receivable_payment('92222222-a000-0000-0000-000000000001', 1000, null, 'cash', null)
$$), 'User A cannot register a payment on a foreign receivable');

-- Escritura directa a la tabla bloqueada.
select ok(rls_rp_test.statement_fails($$
  insert into public.receivable_payments (receivable_id, owner_id, amount, currency, method)
  values ('91111111-a000-0000-0000-000000000001','91111111-1111-1111-1111-111111111111',1,'CRC','cash')
$$), 'Direct inserts into receivable_payments are blocked');

-- ------------------------------------------------------------------ user B
reset role;
select set_config('request.jwt.claim.sub','92222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is((select count(*) from public.receivable_payments
  where receivable_id = '91111111-a000-0000-0000-000000000001'),
  0::bigint, 'User B cannot see User A payments');

select ok(rls_rp_test.statement_fails($$
  select public.void_receivable_payment(
    (select id from public.receivable_payments
      where receivable_id = '91111111-a000-0000-0000-000000000001' limit 1),
    'hack')
$$), 'User B cannot void a payment they cannot see');

-- ------------------------------------------------------------------ anon
reset role;
select set_config('request.jwt.claim.sub','', true);
set local role anon;
select is((select count(*) from public.receivable_payments), 0::bigint,
  'Anonymous users cannot read payments');
select ok(not has_function_privilege('anon',
  'public.register_receivable_payment(uuid, numeric, date, text, text)', 'EXECUTE'),
  'Anonymous users cannot execute the register RPC');

reset role;
select * from finish();
rollback;
