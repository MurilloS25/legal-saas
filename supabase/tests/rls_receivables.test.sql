begin;

set search_path = public, extensions;

select plan(36);

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

select ok(rls_rec_test.statement_fails($$
  insert into public.receivables (owner_id, client_id, concept, currency, amount_total, issued_at)
  values ('81111111-1111-1111-1111-111111111111','81111111-c000-0000-0000-000000000001', repeat('x', 201),'CRC',100,'2026-07-13')
$$), 'Concept cannot exceed the MVP length limit');

select ok(rls_rec_test.statement_fails($$
  insert into public.receivables (owner_id, client_id, concept, currency, amount_total, issued_at, notes)
  values ('81111111-1111-1111-1111-111111111111','81111111-c000-0000-0000-000000000001','Notas','CRC',100,'2026-07-13', repeat('x', 2001))
$$), 'Notes cannot exceed the MVP length limit');

select ok(rls_rec_test.statement_fails($$
  insert into public.receivables (owner_id, client_id, concept, currency, amount_total, issued_at)
  values ('81111111-1111-1111-1111-111111111111','81111111-c000-0000-0000-000000000001','Monto enorme','CRC',10000000000,'2026-07-13')
$$), 'Amount cannot exceed the MVP maximum');

-- Vencimiento anterior a emisión rechazado.
select ok(rls_rec_test.statement_fails($$
  insert into public.receivables (owner_id, client_id, concept, currency, amount_total, issued_at, due_at)
  values ('81111111-1111-1111-1111-111111111111','81111111-c000-0000-0000-000000000001','Fechas','CRC',100,'2026-07-13','2026-07-01')
$$), 'Due date cannot precede the issue date');

-- Nombre libre: client_id nulo con un nombre visible es válido.
select ok(rls_rec_test.statement_succeeds($$
  insert into public.receivables
    (id, owner_id, client_id, client_name_snapshot, concept, currency, amount_total, issued_at)
  values ('81111111-a000-0000-0000-000000000004','81111111-1111-1111-1111-111111111111',
    null, 'Nombre Libre S.A.', 'Sin cliente registrado', 'CRC', 90000.00, '2026-07-13')
$$), 'A receivable can be created with a free-text client name and no client_id');

select is((select client_name from public.receivable_entries
  where id = '81111111-a000-0000-0000-000000000004'),
  'Nombre Libre S.A.', 'The free-text name is the effective visible name');

-- El nombre visible sigue siendo obligatorio: sin Cliente y sin nombre libre
-- se rechaza (NOT NULL / CHECK de no-vacío).
select ok(rls_rec_test.statement_fails($$
  insert into public.receivables (owner_id, client_id, concept, currency, amount_total, issued_at)
  values ('81111111-1111-1111-1111-111111111111', null,'Sin cliente ni nombre','CRC',100,'2026-07-13')
$$), 'A receivable needs a visible name: no client and no free-text name is rejected');

select ok(rls_rec_test.statement_fails($$
  insert into public.receivables (owner_id, client_id, client_name_snapshot, concept, currency, amount_total, issued_at)
  values ('81111111-1111-1111-1111-111111111111', null, '   ', 'Nombre en blanco','CRC',100,'2026-07-13')
$$), 'A blank free-text name is rejected');

-- Cliente registrado: el snapshot enviado por el cliente se ignora — el
-- trigger siempre lo sincroniza desde el nombre vigente de clients.
select ok(rls_rec_test.statement_succeeds($$
  insert into public.receivables
    (id, owner_id, client_id, client_name_snapshot, concept, currency, amount_total, issued_at)
  values ('81111111-a000-0000-0000-000000000005','81111111-1111-1111-1111-111111111111',
    '81111111-c000-0000-0000-000000000001', 'Nombre Falsificado', 'Con cliente', 'CRC', 1000.00, '2026-07-13')
$$), 'Creating a receivable with a registered client succeeds regardless of the submitted snapshot text');

select is((select client_name from public.receivable_entries
  where id = '81111111-a000-0000-0000-000000000005'),
  'Cliente A', 'The snapshot always reflects the live client name, never the submitted text');

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

-- Cambiar el nombre libre (client_id sigue nulo) registra receivable_client_changed.
update public.receivables set client_name_snapshot = 'Nombre Libre Actualizado'
  where id = '81111111-a000-0000-0000-000000000004';
select is(rls_rec_test.event_count('81111111-a000-0000-0000-000000000004','receivable_client_changed'),
  1::bigint, 'Changing the free-text name records receivable_client_changed');

-- Cliente renombrado: el snapshot ya escrito NO cambia retroactivamente.
update public.clients set full_name = 'Cliente A Renombrado'
  where id = '81111111-c000-0000-0000-000000000001';
select is((select client_name from public.receivable_entries
  where id = '81111111-a000-0000-0000-000000000005'),
  'Cliente A', 'Renaming the Client does not retroactively change an already-written snapshot');

-- Pero la próxima escritura sobre esa cuenta sí toma el nombre vigente.
update public.receivables set concept = 'Con cliente (editado)'
  where id = '81111111-a000-0000-0000-000000000005';
select is((select client_name from public.receivable_entries
  where id = '81111111-a000-0000-0000-000000000005'),
  'Cliente A Renombrado', 'The next write on that receivable re-syncs the snapshot from the current client name');

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
