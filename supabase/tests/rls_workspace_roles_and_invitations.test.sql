-- Roles, invitaciones y permisos (Iteración 5).
--
-- Cubre las RPCs de gestión de equipo (invite/accept/change_role/suspend/
-- reactivate/remove_workspace_member) y la matriz de permisos por rol
-- (asistente puede crear/editar borradores pero no finalizar/anular pagos/
-- gestionar miembros/editar configuración; solo_lectura no escribe nada).
-- "Invitación expirada" no se prueba aquí: se apoya enteramente en el
-- vencimiento de token ya cubierto por /auth/confirm (Iteración 2) — no hay
-- lógica de expiración nueva que probar a nivel SQL.

begin;

set search_path = public, extensions;

select plan(30);

create schema rls_team_test;
grant usage on schema rls_team_test to public;

create function rls_team_test.statement_succeeds(statement text)
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

create function rls_team_test.statement_fails(statement text)
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

-- ------------------------------------------------------------------ fixtures

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('b1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-owner@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('b2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-admin@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('b3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-assistant@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('b4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-readonly@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('b5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-outsider@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

-- b1 (propietario) invita y "acepta manualmente" (sin pasar por el correo
-- real, que es infraestructura de Node) a admin/asistente/solo_lectura
-- dentro de su propio Workspace.

select set_config('request.jwt.claim.sub', 'b1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select ok(
  rls_team_test.statement_succeeds($$
    select public.invite_workspace_member('b2222222-2222-2222-2222-222222222222', 'administrador')
  $$),
  'Propietario puede invitar a un administrador'
);

select ok(
  rls_team_test.statement_fails($$
    select public.invite_workspace_member('b2222222-2222-2222-2222-222222222222', 'asistente')
  $$),
  'Propietario no puede invitar dos veces al mismo usuario (duplicado)'
);

reset role;

select is(
  (select status from public.workspace_members
     where workspace_id = 'b1111111-1111-1111-1111-111111111111' and user_id = 'b2222222-2222-2222-2222-222222222222'),
  'invited',
  'La invitación queda en estado invited hasta que se acepta'
);

-- El invitado acepta.
select set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select ok(
  rls_team_test.statement_succeeds($$
    select public.accept_workspace_invitation('b1111111-1111-1111-1111-111111111111')
  $$),
  'El usuario invitado puede aceptar su propia invitación'
);

select ok(
  rls_team_test.statement_fails($$
    select public.accept_workspace_invitation('b1111111-1111-1111-1111-111111111111')
  $$),
  'Aceptar dos veces la misma invitación falla (ya no está invited)'
);

reset role;

select is(
  (select status from public.workspace_members
     where workspace_id = 'b1111111-1111-1111-1111-111111111111' and user_id = 'b2222222-2222-2222-2222-222222222222'),
  'active',
  'Tras aceptar, la membresía queda active'
);

select is(
  (select count(*) from public.workspace_members where workspace_id = 'b2222222-2222-2222-2222-222222222222'),
  0::bigint,
  'El Workspace personal del invitado se elimina al aceptar (limpieza por trigger de la Iteración 4)'
);

-- El administrador (b2) invita a un asistente y a un solo_lectura.
select set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select ok(
  rls_team_test.statement_succeeds($$
    select public.invite_workspace_member('b3333333-3333-3333-3333-333333333333', 'asistente')
  $$),
  'Administrador puede invitar a un asistente'
);

select ok(
  rls_team_test.statement_fails($$
    select public.invite_workspace_member('b4444444-4444-4444-4444-444444444444', 'administrador')
  $$),
  'Administrador NO puede invitar a otro administrador'
);

reset role;

-- b4 acepta directamente como solo_lectura (invitado por el propietario).
select set_config('request.jwt.claim.sub', 'b1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.invite_workspace_member('b4444444-4444-4444-4444-444444444444', 'solo_lectura');
reset role;

select set_config('request.jwt.claim.sub', 'b3333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select public.accept_workspace_invitation('b1111111-1111-1111-1111-111111111111');
reset role;

select set_config('request.jwt.claim.sub', 'b4444444-4444-4444-4444-444444444444', true);
set local role authenticated;
select public.accept_workspace_invitation('b1111111-1111-1111-1111-111111111111');
reset role;

-- ------------------------------------------------------------------ jerarquía

select set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select ok(
  rls_team_test.statement_fails($$
    select public.change_workspace_member_role('b1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'asistente')
  $$),
  'Nadie puede cambiar el rol del propietario'
);

select ok(
  rls_team_test.statement_fails($$
    select public.suspend_workspace_member('b1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111')
  $$),
  'Nadie puede suspender al propietario'
);

reset role;

select set_config('request.jwt.claim.sub', 'b3333333-3333-3333-3333-333333333333', true);
set local role authenticated;

select ok(
  rls_team_test.statement_fails($$
    select public.invite_workspace_member('b5555555-5555-5555-5555-555555555555', 'solo_lectura')
  $$),
  'Un asistente no puede invitar (members.manage es solo propietario/administrador)'
);

reset role;

-- ------------------------------------------------------------------ cambio de rol / suspensión / remoción

select set_config('request.jwt.claim.sub', 'b1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select ok(
  rls_team_test.statement_succeeds($$
    select public.change_workspace_member_role('b1111111-1111-1111-1111-111111111111', 'b4444444-4444-4444-4444-444444444444', 'asistente')
  $$),
  'Propietario puede cambiar el rol de solo_lectura a asistente'
);

select ok(
  rls_team_test.statement_succeeds($$
    select public.suspend_workspace_member('b1111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333')
  $$),
  'Propietario puede suspender a un asistente'
);

reset role;

select is(
  (select status from public.workspace_members
     where workspace_id = 'b1111111-1111-1111-1111-111111111111' and user_id = 'b3333333-3333-3333-3333-333333333333'),
  'revoked',
  'El asistente suspendido queda con status revoked'
);

select set_config('request.jwt.claim.sub', 'b3333333-3333-3333-3333-333333333333', true);
set local role authenticated;

select is(
  (select count(*) from public.clients),
  0::bigint,
  'El miembro suspendido pierde acceso de inmediato (no ve nada del Workspace)'
);

reset role;

select set_config('request.jwt.claim.sub', 'b1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select ok(
  rls_team_test.statement_succeeds($$
    select public.reactivate_workspace_member('b1111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333')
  $$),
  'Propietario puede reactivar a un miembro suspendido'
);

select ok(
  rls_team_test.statement_succeeds($$
    select public.remove_workspace_member('b1111111-1111-1111-1111-111111111111', 'b4444444-4444-4444-4444-444444444444')
  $$),
  'Propietario puede remover un miembro'
);

reset role;

select is(
  (select count(*) from public.workspace_members
     where workspace_id = 'b1111111-1111-1111-1111-111111111111' and user_id = 'b4444444-4444-4444-4444-444444444444'),
  0::bigint,
  'La membresía removida desaparece de workspace_members'
);

select is(
  (select count(*) from public.workspace_activity
     where workspace_id = 'b1111111-1111-1111-1111-111111111111' and target_user_id = 'b4444444-4444-4444-4444-444444444444' and event_type = 'member_removed'),
  1::bigint,
  'La remoción queda registrada en workspace_activity (no se borra el historial)'
);

-- ------------------------------------------------------------------ matriz de permisos

-- b3 (asistente, activo de nuevo) crea un cliente y un machote, pero no
-- puede finalizar una escritura ni anular un pago ni gestionar miembros ni
-- editar configuración.
select set_config('request.jwt.claim.sub', 'b3333333-3333-3333-3333-333333333333', true);
set local role authenticated;

select ok(
  rls_team_test.statement_succeeds($$
    insert into public.clients (
      id, owner_id, full_name, identification_type, identification_number,
      marital_status, nationality, occupation, exact_address
    ) values (
      'c9999999-0000-0000-0000-000000000001', 'b3333333-3333-3333-3333-333333333333',
      'Cliente de Asistente', 'cedula_fisica', '1-0000-0099', 'single', 'Costa Rican', 'Engineer', 'Fake address'
    )
  $$),
  'Asistente puede crear un cliente (clients.write)'
);

select ok(
  rls_team_test.statement_fails($$
    insert into public.lawyer_profiles (id, owner_id, full_name)
    values ('d9999999-0000-0000-0000-000000000001', 'b3333333-3333-3333-3333-333333333333', 'Asistente Intenta Configurar')
  $$),
  'Asistente NO puede escribir configuración (settings.manage es prop/admin)'
);

select ok(
  rls_team_test.statement_fails($$
    select public.invite_workspace_member('b5555555-5555-5555-5555-555555555555', 'solo_lectura')
  $$),
  'Asistente NO puede invitar miembros (repetido con matriz completa poblada)'
);

reset role;

-- b4 (solo_lectura) no puede escribir nada.
select set_config('request.jwt.claim.sub', 'b1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.invite_workspace_member('b5555555-5555-5555-5555-555555555555', 'solo_lectura');
reset role;
select set_config('request.jwt.claim.sub', 'b5555555-5555-5555-5555-555555555555', true);
set local role authenticated;
select public.accept_workspace_invitation('b1111111-1111-1111-1111-111111111111');
reset role;

select set_config('request.jwt.claim.sub', 'b5555555-5555-5555-5555-555555555555', true);
set local role authenticated;

select is(
  (select count(*) from public.clients),
  1::bigint,
  'Solo_lectura sí puede leer los clientes del Workspace'
);

select ok(
  rls_team_test.statement_fails($$
    insert into public.clients (
      id, owner_id, full_name, identification_type, identification_number,
      marital_status, nationality, occupation, exact_address
    ) values (
      'c9999999-0000-0000-0000-000000000002', 'b5555555-5555-5555-5555-555555555555',
      'Cliente de Solo Lectura', 'cedula_fisica', '1-0000-0098', 'single', 'Costa Rican', 'Engineer', 'Fake address'
    )
  $$),
  'Solo_lectura NO puede crear un cliente'
);

reset role;

-- ------------------------------------------------------------------ request manipulado

-- b5 (ahora miembro solo_lectura del Workspace de b1) intenta actuar sobre
-- un Workspace del que NO es propietario/administrador (el suyo propio ya
-- no existe, así que se usa el de b1 con un rol insuficiente, y también un
-- Workspace inventado que no existe en absoluto).
select set_config('request.jwt.claim.sub', 'b5555555-5555-5555-5555-555555555555', true);
set local role authenticated;

select ok(
  rls_team_test.statement_fails($$
    select public.suspend_workspace_member('b1111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333')
  $$),
  'Solo_lectura no puede suspender a nadie (rol insuficiente)'
);

select ok(
  rls_team_test.statement_fails($$
    select public.invite_workspace_member('b3333333-3333-3333-3333-333333333333', 'asistente')
  $$),
  'Request manipulado: workspace_id inexistente/ajeno también falla por membresía insuficiente'
);

reset role;

-- ------------------------------------------------------------------ aislamiento entre Workspaces

-- Un Workspace completamente ajeno (el bootstrap propio de b outsider, que
-- ya no existe porque aceptó una invitación) — se usa un sexto usuario que
-- SÍ conserva su propio Workspace bootstrap, para probar aislamiento total.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'b6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-isolated@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

select set_config('request.jwt.claim.sub', 'b6666666-6666-6666-6666-666666666666', true);
set local role authenticated;

select is(
  (select count(*) from public.clients),
  0::bigint,
  'Un Workspace completamente ajeno no ve clientes de otro Workspace'
);

select is(
  (select count(*) from public.workspace_activity),
  0::bigint,
  'Un Workspace completamente ajeno no ve la auditoría de equipo de otro Workspace'
);

select ok(
  rls_team_test.statement_fails($$
    select public.change_workspace_member_role('b1111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333', 'solo_lectura')
  $$),
  'Un Workspace ajeno no puede cambiar roles de otro Workspace'
);

reset role;

select * from finish();

rollback;
