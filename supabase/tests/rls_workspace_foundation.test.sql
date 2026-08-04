-- RLS por membresía de Workspace (Iteración 4).
--
-- Cubre exactamente los casos que pide el spec: propietario, miembro
-- (activo, con rol distinto de propietario), externo, suspendido, y
-- manipulación de IDs. Usa `clients` como tabla representativa (mismo
-- patrón owner_id -> workspace_id generado que las otras 13 tablas) y
-- `register_receivable_payment` para probar que el chequeo de membresía
-- también protege una función SECURITY DEFINER, no solo RLS.

begin;

set search_path = public, extensions;

select plan(18);

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

-- ------------------------------------------------------------------ fixtures

-- Insertar en auth.users dispara bootstrap_workspace_for_new_user(): cada
-- usuario recibe automáticamente su propio workspaces + workspace_members
-- (propietario, active) con id = su propio auth.users.id.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'wf-owner@example.test', 'fake-hash',
   now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('a2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'wf-assistant@example.test', 'fake-hash',
   now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('a3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'wf-outsider@example.test', 'fake-hash',
   now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

-- Bootstrap check: cada usuario existente recibe un Workspace propio
-- automáticamente, sin intervención de la aplicación.
select is(
  (select count(*) from public.workspaces where id in (
    'a1111111-1111-1111-1111-111111111111',
    'a2222222-2222-2222-2222-222222222222',
    'a3333333-3333-3333-3333-333333333333'
  )),
  3::bigint,
  'Bootstrap: los 3 usuarios nuevos reciben su propio Workspace automáticamente'
);

select is(
  (select role from public.workspace_members
     where workspace_id = 'a1111111-1111-1111-1111-111111111111'
       and user_id = 'a1111111-1111-1111-1111-111111111111'),
  'propietario',
  'Bootstrap: el usuario recibe rol propietario de su propio Workspace'
);

-- El usuario "assistant" se agrega como miembro ACTIVO (no propietario) del
-- Workspace del owner — simula lo que una futura invitación haría, sin
-- necesitar la UI de invitaciones (fuera de alcance de esta iteración).
insert into public.workspace_members (workspace_id, user_id, role, status)
values ('a1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 'asistente', 'active');

-- Cliente de referencia, creado por el propietario.
insert into public.clients (
  id, owner_id, full_name, identification_type, identification_number,
  marital_status, nationality, occupation, exact_address
) values (
  'c1111111-0000-0000-0000-000000000001',
  'a1111111-1111-1111-1111-111111111111',
  'Fake Workspace Client',
  'cedula_fisica', '1-0000-0001', 'single', 'Costa Rican', 'Engineer', 'Fake address'
);

-- Cuenta por cobrar de referencia, para probar el chequeo de membresía
-- dentro de un RPC SECURITY DEFINER (no solo en RLS de tabla).
insert into public.receivables (
  id, owner_id, client_id, concept, currency, amount_total
) values (
  'd1111111-0000-0000-0000-000000000001',
  'a1111111-1111-1111-1111-111111111111',
  'c1111111-0000-0000-0000-000000000001',
  'Fake receivable', 'CRC', 100
);

-- ------------------------------------------------------------------ propietario

select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select is(
  (select count(*) from public.clients where id = 'c1111111-0000-0000-0000-000000000001'),
  1::bigint,
  'Propietario ve su propio cliente'
);

select ok(
  rls_test.statement_succeeds($$
    insert into public.clients (
      id, owner_id, full_name, identification_type, identification_number,
      marital_status, nationality, occupation, exact_address
    ) values (
      'c1111111-0000-0000-0000-000000000002',
      'a1111111-1111-1111-1111-111111111111',
      'Fake Client By Owner', 'cedula_fisica', '1-0000-0002',
      'single', 'Costa Rican', 'Engineer', 'Fake address'
    )
  $$),
  'Propietario puede insertar un cliente en su Workspace'
);

select ok(
  rls_test.statement_succeeds($$
    select public.register_receivable_payment(
      'd1111111-0000-0000-0000-000000000001', 40, current_date, 'cash', null
    )
  $$),
  'Propietario puede registrar un pago (RPC SECURITY DEFINER) en su Workspace'
);

reset role;

-- ------------------------------------------------------------------ manipulación de IDs

select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select ok(
  rls_test.statement_fails($$
    insert into public.clients (
      id, owner_id, workspace_id, full_name, identification_type, identification_number,
      marital_status, nationality, occupation, exact_address
    ) values (
      'c1111111-0000-0000-0000-000000000099',
      'a1111111-1111-1111-1111-111111111111',
      'a3333333-3333-3333-3333-333333333333',
      'Forged Workspace Client', 'cedula_fisica', '1-0000-0099',
      'single', 'Costa Rican', 'Engineer', 'Fake address'
    )
  $$),
  'workspace_id no se puede fijar explícitamente (columna generada) — manipulación de IDs rechazada'
);

reset role;

-- ------------------------------------------------------------------ miembro (activo, no propietario)

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is(
  (select count(*) from public.clients where id = 'c1111111-0000-0000-0000-000000000001'),
  1::bigint,
  'Miembro activo (asistente) ve los clientes del Workspace del que es miembro'
);

-- El insert en sí "succeeds" (el asistente SIEMPRE puede insertar con su
-- propio owner_id) — pero como workspace_id se genera desde owner_id en
-- esta iteración, la fila resultante cae en el Workspace PROPIO del
-- asistente, nunca en el Workspace ajeno del que es miembro. Escribir
-- "dentro" de un Workspace ajeno como no-propietario requiere que
-- workspace_id deje de ser una columna generada (iteración futura, cuando
-- existan invitaciones reales) — se documenta aquí como limitación conocida
-- de esta iteración, no como un hallazgo a corregir ahora.
select ok(
  rls_test.statement_succeeds($$
    insert into public.clients (
      id, owner_id, full_name, identification_type, identification_number,
      marital_status, nationality, occupation, exact_address
    ) values (
      'c1111111-0000-0000-0000-000000000003',
      'a2222222-2222-2222-2222-222222222222',
      'Fake Client By Assistant', 'cedula_fisica', '1-0000-0003',
      'single', 'Costa Rican', 'Engineer', 'Fake address'
    )
  $$),
  'Miembro puede insertar con su propio owner_id (no se bloquea a nivel de Workspace ajeno)'
);

select is(
  (select workspace_id from public.clients where id = 'c1111111-0000-0000-0000-000000000003'),
  'a2222222-2222-2222-2222-222222222222'::uuid,
  'Limitación conocida: la fila del miembro cae en su propio Workspace, no en el Workspace ajeno del que es miembro (se resuelve cuando workspace_id deje de ser generada)'
);

reset role;

-- ------------------------------------------------------------------ externo

select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);
set local role authenticated;

select is(
  (select count(*) from public.clients where id = 'c1111111-0000-0000-0000-000000000001'),
  0::bigint,
  'Usuario externo (sin membresía) no ve clientes de un Workspace ajeno'
);

-- Nota: un DELETE que la RLS filtra a 0 filas NO lanza una excepción en
-- Postgres (a diferencia de un INSERT/UPDATE rechazado por WITH CHECK) —
-- se verifica con statement_row_count = 0, mismo patrón que
-- rls_initial_schema.test.sql, no con statement_fails.
select is(
  rls_test.statement_row_count($$
    delete from public.clients where id = 'c1111111-0000-0000-0000-000000000001'
  $$),
  0::bigint,
  'Usuario externo no puede eliminar un cliente de un Workspace ajeno'
);

reset role;

-- ------------------------------------------------------------------ suspendido

update public.workspace_members
   set status = 'revoked'
 where workspace_id = 'a1111111-1111-1111-1111-111111111111'
   and user_id = 'a1111111-1111-1111-1111-111111111111';

select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select is(
  (select count(*) from public.clients where id = 'c1111111-0000-0000-0000-000000000001'),
  0::bigint,
  'Propietario con membresía suspendida pierde acceso de lectura a su propio Workspace'
);

select ok(
  rls_test.statement_fails($$
    insert into public.clients (
      id, owner_id, full_name, identification_type, identification_number,
      marital_status, nationality, occupation, exact_address
    ) values (
      'c1111111-0000-0000-0000-000000000004',
      'a1111111-1111-1111-1111-111111111111',
      'Fake Client While Suspended', 'cedula_fisica', '1-0000-0004',
      'single', 'Costa Rican', 'Engineer', 'Fake address'
    )
  $$),
  'Propietario con membresía suspendida no puede insertar, aunque owner_id siga siendo el suyo'
);

select ok(
  rls_test.statement_fails($$
    select public.register_receivable_payment(
      'd1111111-0000-0000-0000-000000000001', 10, current_date, 'cash', null
    )
  $$),
  'RPC SECURITY DEFINER (register_receivable_payment) rechaza a un propietario con membresía suspendida'
);

reset role;

-- El miembro asistente (no suspendido) sigue viendo el Workspace: la
-- suspensión es por membresía individual, no apaga el Workspace entero.
select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is(
  (select count(*) from public.clients where id = 'c1111111-0000-0000-0000-000000000001'),
  1::bigint,
  'Suspender al propietario no afecta el acceso de otro miembro activo del mismo Workspace'
);

reset role;

-- Restaurar al propietario para que el resto de la suite (si corre en el
-- mismo run) no quede en un estado inesperado.
update public.workspace_members
   set status = 'active'
 where workspace_id = 'a1111111-1111-1111-1111-111111111111'
   and user_id = 'a1111111-1111-1111-1111-111111111111';

-- ------------------------------------------------------------------ anónimo

select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select is(
  (select count(*) from public.clients where id = 'c1111111-0000-0000-0000-000000000001'),
  0::bigint,
  'Usuario anónimo no ve clientes de ningún Workspace'
);

select is(
  rls_test.statement_row_count($$
    delete from public.clients where id = 'c1111111-0000-0000-0000-000000000001'
  $$),
  0::bigint,
  'Usuario anónimo no puede eliminar clientes'
);

reset role;

-- ------------------------------------------------------------------ limpieza de Workspace huérfano

-- Eliminar al último miembro de un Workspace elimina el Workspace huérfano
-- (cleanup_orphaned_workspace). Se usa un cuarto usuario dedicado para no
-- interferir con las aserciones anteriores.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'a4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'wf-orphan@example.test', 'fake-hash',
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

delete from public.workspace_members
 where workspace_id = 'a4444444-4444-4444-4444-444444444444'
   and user_id = 'a4444444-4444-4444-4444-444444444444';

select is(
  (select count(*) from public.workspaces where id = 'a4444444-4444-4444-4444-444444444444'),
  0::bigint,
  'Eliminar el último miembro de un Workspace elimina el Workspace huérfano'
);

select * from finish();

rollback;
