begin;

set search_path = public, extensions;

select plan(25);

create schema rls_rec_test;
grant usage on schema rls_rec_test to public;

create function rls_rec_test.statement_succeeds(statement text)
returns boolean language plpgsql as $$
begin execute statement; return true;
exception when others then
  raise notice 'failed: % (%)', sqlerrm, sqlstate; return false; end; $$;

create function rls_rec_test.statement_fails(statement text)
returns boolean language plpgsql as $$
begin execute statement; return false;
exception when others then return true; end; $$;

create function rls_rec_test.statement_row_count(statement text)
returns bigint language plpgsql as $$
declare n bigint; begin execute statement; get diagnostics n = row_count; return n; end; $$;

create function rls_rec_test.event_count(rec uuid, etype text)
returns bigint language sql as $$
  select count(*) from public.receivable_activity
   where receivable_id = rec and event_type = etype; $$;

create function rls_rec_test.total_events(rec uuid)
returns bigint language sql as $$
  select count(*) from public.receivable_activity where receivable_id = rec; $$;

-- seed users
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('81111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-rec-a@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('82222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-rec-b@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

insert into public.clients (id, owner_id, full_name, identification_type,
  identification_number, marital_status, nationality, occupation, exact_address)
values
  ('81111111-c000-0000-0000-000000000001','81111111-1111-1111-1111-111111111111','Cliente A','cedula_fisica','1-1111-1111','soltero','Costarricense','Abogado','San José'),
  ('82222222-c000-0000-0000-000000000001','82222222-2222-2222-2222-222222222222','Cliente B','cedula_fisica','2-2222-2222','casado','Costarricense','Médico','Cartago');

insert into public.templates (id, owner_id, name, status, content_json) values
  ('81111111-0000-0000-0000-000000000001','81111111-1111-1111-1111-111111111111','Tpl A','draft','{}'::jsonb),
  ('82222222-0000-0000-0000-000000000001','82222222-2222-2222-2222-222222222222','Tpl B','draft','{}'::jsonb);

insert into public.documents (id, owner_id, template_id, client_id, title, field_values, rendered_content) values
  ('81111111-d000-0000-0000-000000000001','81111111-1111-1111-1111-111111111111','81111111-0000-0000-0000-000000000001','81111111-c000-0000-0000-000000000001','Doc A','{}'::jsonb,''),
  ('82222222-d000-0000-0000-000000000001','82222222-2222-2222-2222-222222222222','82222222-0000-0000-0000-000000000001','82222222-c000-0000-0000-000000000001','Doc B','{}'::jsonb,'');

-- ------------------------------------------------------------------ user A
select set_config('request.jwt.claim.sub','81111111-1111-1111-1111-111111111111', true);
set local role authenticated;

-- Cuenta sin escritura.
select ok(rls_rec_test.statement_succeeds($$
  insert into public.receivables (id, owner_id, client_id, concept, currency, amount_total, issued_at)
  values ('81111111-a000-0000-0000-000000000001','81111111-1111-1111-1111-111111111111','81111111-c000-0000-0000-000000000001','Honorarios','CRC',150000.00,'2026-07-13')
$$), 'User A can create a receivable without a document');

select is(rls_rec_test.event_count('81111111-a000-0000-0000-000000000001','receivable_created'),
  1::bigint, 'Creating a receivable records receivable_created');

-- Dos cuentas para la MISMA escritura (sin UNIQUE).
select ok(rls_rec_test.statement_succeeds($$
  insert into public.receivables (id, owner_id, client_id, document_id, concept, currency, amount_total, issued_at)
  values ('81111111-a000-0000-0000-000000000002','81111111-1111-1111-1111-111111111111','81111111-c000-0000-0000-000000000001','81111111-d000-0000-0000-000000000001','Adelanto','CRC',50000.00,'2026-07-13')
$$), 'User A can create a receivable linked to a document');

select ok(rls_rec_test.statement_succeeds($$
  insert into public.receivables (id, owner_id, client_id, document_id, concept, currency, amount_total, issued_at)
  values ('81111111-a000-0000-0000-000000000003','81111111-1111-1111-1111-111111111111','81111111-c000-0000-0000-000000000001','81111111-d000-0000-0000-000000000001','Saldo','CRC',75000.00,'2026-07-13')
$$), 'Multiple receivables can point to the same document');

-- Monto <= 0 rechazado.
select ok(rls_rec_test.statement_fails($$
  insert into public.receivables (owner_id, client_id, concept, currency, amount_total, issued_at)
  values ('81111111-1111-1111-1111-111111111111','81111111-c000-0000-0000-000000000001','Cero','CRC',0,'2026-07-13')
$$), 'Amount must be greater than zero');

-- Moneda inválida rechazada.
select ok(rls_rec_test.statement_fails($$
  insert into public.receivables (owner_id, client_id, concept, currency, amount_total, issued_at)
  values ('81111111-1111-1111-1111-111111111111','81111111-c000-0000-0000-000000000001','Euros','EUR',100,'2026-07-13')
$$), 'Currency must be CRC or USD');

-- Concepto en blanco rechazado.
select ok(rls_rec_test.statement_fails($$
  insert into public.receivables (owner_id, client_id, concept, currency, amount_total, issued_at)
  values ('81111111-1111-1111-1111-111111111111','81111111-c000-0000-0000-000000000001','   ','CRC',100,'2026-07-13')
$$), 'Concept cannot be blank');

-- Vencimiento anterior a emisión rechazado.
select ok(rls_rec_test.statement_fails($$
  insert into public.receivables (owner_id, client_id, concept, currency, amount_total, issued_at, due_at)
  values ('81111111-1111-1111-1111-111111111111','81111111-c000-0000-0000-000000000001','Fechas','CRC',100,'2026-07-13','2026-07-01')
$$), 'Due date cannot precede the issue date');

-- Cliente obligatorio (NOT NULL).
select ok(rls_rec_test.statement_fails($$
  insert into public.receivables (owner_id, client_id, concept, currency, amount_total, issued_at)
  values ('81111111-1111-1111-1111-111111111111', null,'Sin cliente','CRC',100,'2026-07-13')
$$), 'Client is mandatory');

-- Cliente ajeno rechazado por FK compuesta.
select ok(rls_rec_test.statement_fails($$
  insert into public.receivables (owner_id, client_id, concept, currency, amount_total, issued_at)
  values ('81111111-1111-1111-1111-111111111111','82222222-c000-0000-0000-000000000001','Ajeno','CRC',100,'2026-07-13')
$$), 'Cannot link a receivable to a foreign client');

-- Escritura ajena rechazada por FK compuesta.
select ok(rls_rec_test.statement_fails($$
  insert into public.receivables (owner_id, client_id, document_id, concept, currency, amount_total, issued_at)
  values ('81111111-1111-1111-1111-111111111111','81111111-c000-0000-0000-000000000001','82222222-d000-0000-0000-000000000001','Ajena','CRC',100,'2026-07-13')
$$), 'Cannot link a receivable to a foreign document');

-- owner_id falsificado rechazado.
select ok(rls_rec_test.statement_fails($$
  insert into public.receivables (owner_id, client_id, concept, currency, amount_total, issued_at)
  values ('82222222-2222-2222-2222-222222222222','81111111-c000-0000-0000-000000000001','Forge','CRC',100,'2026-07-13')
$$), 'Cannot forge owner_id on a receivable');

-- Vista deriva estado y saldo.
select is((select status from public.receivable_entries where id = '81111111-a000-0000-0000-000000000001'),
  'pending', 'A receivable with no due date and no payments is pending');
select is((select balance_due from public.receivable_entries where id = '81111111-a000-0000-0000-000000000001'),
  150000.00::numeric, 'Balance equals the total when nothing is paid');

-- Cambio de monto registra evento con metadata.
update public.receivables set amount_total = 160000.00 where id = '81111111-a000-0000-0000-000000000001';
select is(rls_rec_test.event_count('81111111-a000-0000-0000-000000000001','receivable_amount_changed'),
  1::bigint, 'Changing the amount records receivable_amount_changed');

-- Desvincular escritura registra evento.
update public.receivables set document_id = null where id = '81111111-a000-0000-0000-000000000002';
select is(rls_rec_test.event_count('81111111-a000-0000-0000-000000000002','receivable_document_unlinked'),
  1::bigint, 'Unlinking a document records receivable_document_unlinked');

-- No-op: update sin cambios reales no agrega evento.
select is(rls_rec_test.total_events('81111111-a000-0000-0000-000000000003'),
  1::bigint, 'A freshly created receivable has exactly one event');
update public.receivables set concept = 'Saldo' where id = '81111111-a000-0000-0000-000000000003';
select is(rls_rec_test.total_events('81111111-a000-0000-0000-000000000003'),
  1::bigint, 'A no-op update records no new activity');

-- Actividad es de solo lectura para el usuario.
select ok(rls_rec_test.statement_fails($$
  insert into public.receivable_activity (receivable_id, owner_id, actor_user_id, event_type)
  values ('81111111-a000-0000-0000-000000000001','81111111-1111-1111-1111-111111111111','81111111-1111-1111-1111-111111111111','forged')
$$), 'Users cannot insert receivable activity directly');

select ok(not has_function_privilege(
  'authenticated',
  'public.record_receivable_activity()',
  'EXECUTE'
), 'Authenticated users cannot execute the internal activity trigger function');

-- ------------------------------------------------------------------ user B
reset role;
select set_config('request.jwt.claim.sub','82222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is((select count(*) from public.receivables
  where owner_id = '81111111-1111-1111-1111-111111111111'),
  0::bigint, 'User B cannot see User A receivables');

select is((select count(*) from public.receivable_entries
  where owner_id = '81111111-1111-1111-1111-111111111111'),
  0::bigint, 'User B cannot see User A receivable entries via the view');

select is(rls_rec_test.statement_row_count($$
  update public.receivables set amount_total = 1 where id = '81111111-a000-0000-0000-000000000001'
$$), 0::bigint, 'User B cannot update User A receivables');

select is((select count(*) from public.receivable_activity
  where owner_id = '81111111-1111-1111-1111-111111111111'),
  0::bigint, 'User B cannot read User A receivable activity');

-- ------------------------------------------------------------------ anon
reset role;
select set_config('request.jwt.claim.sub','', true);
set local role anon;
select is((select count(*) from public.receivables),
  0::bigint, 'Anonymous users cannot read receivables');

reset role;
select * from finish();
rollback;
