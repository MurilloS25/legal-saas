-- Reopen permission guard (20260807000000_enforce_reopen_permission.sql).
--
-- `enforce_document_finalize_permission` previously only guarded entering
-- `final`. This covers the DB-level half of the reopen fix: leaving `final`
-- back to `draft` now requires the same propietario/administrador role,
-- for every membership state (active in each role, suspended, removed,
-- foreign workspace, anonymous). The Server Action-level check
-- (`transitionDocument` in lifecycle-actions.ts) is UX only — this trigger
-- is the actual enforcement point and must hold even if that check is
-- bypassed (direct REST/PostgREST call).
--
-- Cross-creator collaboration is covered by release_security_rls_lifecycle.test.sql.

begin;

set search_path = public, extensions;

select plan(10);

create schema rls_reopen_test;
grant usage on schema rls_reopen_test to public;

create function rls_reopen_test.statement_succeeds(statement text)
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

create function rls_reopen_test.statement_fails(statement text)
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

create function rls_reopen_test.statement_row_count(statement text)
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  execute statement;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

-- ------------------------------------------------------------------ fixtures

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('e1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reopen-owner@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('e2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reopen-admin@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('e3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reopen-assistant@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('e4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reopen-readonly@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('e5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reopen-suspended@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('e6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reopen-outsider@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

-- Propietario (e1) forma su equipo: administrador (e2), asistente (e3, que
-- luego se suspende), solo_lectura (e4), y otro asistente (e5) que se
-- invita y ACEPTA para luego ser removido por completo.
select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.invite_workspace_member('e2222222-2222-2222-2222-222222222222', 'administrador');
select public.invite_workspace_member('e3333333-3333-3333-3333-333333333333', 'asistente');
select public.invite_workspace_member('e4444444-4444-4444-4444-444444444444', 'solo_lectura');
select public.invite_workspace_member('e5555555-5555-5555-5555-555555555555', 'asistente');
reset role;

select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public.accept_workspace_invitation('e1111111-1111-1111-1111-111111111111');
reset role;

select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select public.accept_workspace_invitation('e1111111-1111-1111-1111-111111111111');
reset role;

select set_config('request.jwt.claim.sub', 'e4444444-4444-4444-4444-444444444444', true);
set local role authenticated;
select public.accept_workspace_invitation('e1111111-1111-1111-1111-111111111111');
reset role;

select set_config('request.jwt.claim.sub', 'e5555555-5555-5555-5555-555555555555', true);
set local role authenticated;
select public.accept_workspace_invitation('e1111111-1111-1111-1111-111111111111');
reset role;

-- e5 queda removido por completo (sin ninguna fila en workspace_members).
select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.remove_workspace_member('e1111111-1111-1111-1111-111111111111', 'e5555555-5555-5555-5555-555555555555');

insert into public.templates (id, owner_id, workspace_id, name, status, content_json)
values (
  'e1111111-0000-0000-0000-000000000001', 'e1111111-1111-1111-1111-111111111111',
  'e1111111-1111-1111-1111-111111111111', 'Tpl reopen', 'draft', '{}'::jsonb
);

reset role;

-- ------------------------------------------------------------------ escenarios

-- 1) Propietario reabre su propia escritura finalizada.
select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content)
values (
  'e1111111-d000-0000-0000-000000000001', 'e1111111-1111-1111-1111-111111111111',
  'e1111111-1111-1111-1111-111111111111', 'e1111111-0000-0000-0000-000000000001',
  'Doc propietario', 'draft', '{}'::jsonb, ''
);
-- Final fixture follows the same draft -> final transition as the application.
reset role;
select set_config('request.jwt.claim.sub','e1111111-1111-1111-1111-111111111111',true);
set local role authenticated;
update public.documents set status='final' where id='e1111111-d000-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claim.sub','e1111111-1111-1111-1111-111111111111',true);
set local role authenticated;


select ok(
  rls_reopen_test.statement_succeeds($$
    update public.documents set status = 'draft'
    where id = 'e1111111-d000-0000-0000-000000000001'
  $$),
  '1) Propietario puede reabrir su escritura finalizada'
);

reset role;

-- 2) Administrador reabre SU PROPIA escritura finalizada dentro del mismo
-- Workspace (rol distinto de propietario; `documents_update_workspace`
-- exige owner_id = auth.uid(), así que se prueba con un documento propio).
select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content)
values (
  'e1111111-d000-0000-0000-000000000002', 'e2222222-2222-2222-2222-222222222222',
  'e1111111-1111-1111-1111-111111111111', 'e1111111-0000-0000-0000-000000000001',
  'Doc admin', 'draft', '{}'::jsonb, ''
);
-- Final fixture follows the same draft -> final transition as the application.
reset role;
select set_config('request.jwt.claim.sub','e1111111-1111-1111-1111-111111111111',true);
set local role authenticated;
update public.documents set status='final' where id='e1111111-d000-0000-0000-000000000002';
reset role;
select set_config('request.jwt.claim.sub','e2222222-2222-2222-2222-222222222222',true);
set local role authenticated;


select ok(
  rls_reopen_test.statement_succeeds($$
    update public.documents set status = 'draft'
    where id = 'e1111111-d000-0000-0000-000000000002'
  $$),
  '2) Administrador puede reabrir su propia escritura finalizada'
);

reset role;

-- 3) Asistente activo intenta reabrir SU PROPIA escritura finalizada —
-- owner_id coincide con auth.uid(), así que lo único que lo bloquea es el
-- trigger de permiso (rol insuficiente), aislado de la restricción de
-- ownership de la política.
select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);
set local role authenticated;

insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content)
values (
  'e1111111-d000-0000-0000-000000000003', 'e3333333-3333-3333-3333-333333333333',
  'e1111111-1111-1111-1111-111111111111', 'e1111111-0000-0000-0000-000000000001',
  'Doc asistente', 'draft', '{}'::jsonb, ''
);
-- Final fixture follows the same draft -> final transition as the application.
reset role;
select set_config('request.jwt.claim.sub','e1111111-1111-1111-1111-111111111111',true);
set local role authenticated;
update public.documents set status='final' where id='e1111111-d000-0000-0000-000000000003';
reset role;
select set_config('request.jwt.claim.sub','e3333333-3333-3333-3333-333333333333',true);
set local role authenticated;


select ok(
  rls_reopen_test.statement_fails($$
    update public.documents set status = 'draft'
    where id = 'e1111111-d000-0000-0000-000000000003'
  $$),
  '3) Asistente NO puede reabrir ni su propia escritura (rol insuficiente, rechazado por el trigger)'
);

reset role;

-- 4) Solo_lectura intenta reabrir la escritura del propietario — bloqueado
-- por RLS antes de llegar al trigger (su rol no está en
-- documents_update_workspace en absoluto, así que la fila no es ni
-- siquiera visible para UPDATE).
select set_config('request.jwt.claim.sub', 'e4444444-4444-4444-4444-444444444444', true);
set local role authenticated;

-- Read-only rows are excluded by the UPDATE USING policy.
select is(rls_reopen_test.statement_row_count($q$
    update public.documents set status = 'draft'
    where id = 'e1111111-d000-0000-0000-000000000001'
  $q$),0::bigint,
  '4) Solo_lectura cannot reopen (no writable rows)');

reset role;

-- 5) Miembro suspendido (e3, asistente ya probado, ahora se suspende) no
-- puede ni siquiera intentar: is_workspace_member exige status='active'.
select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.suspend_workspace_member('e1111111-1111-1111-1111-111111111111', 'e3333333-3333-3333-3333-333333333333');
reset role;

select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);
set local role authenticated;

select is(
  rls_reopen_test.statement_row_count($$
    update public.documents set status = 'draft'
    where id = 'e1111111-d000-0000-0000-000000000003'
  $$),
  0::bigint,
  '5) Miembro suspendido NO puede reabrir (RLS: ya no es miembro activo)'
);

reset role;

-- 6) Miembro removido (e5, sin fila en workspace_members) no ve el
-- Workspace en absoluto.
select set_config('request.jwt.claim.sub', 'e5555555-5555-5555-5555-555555555555', true);
set local role authenticated;

select is(
  rls_reopen_test.statement_row_count($$
    update public.documents set status = 'draft'
    where id = 'e1111111-d000-0000-0000-000000000001'
  $$),
  0::bigint,
  '6) Miembro removido NO puede reabrir (sin ninguna membresía)'
);

reset role;

-- 7) Miembro de un Workspace completamente distinto no ve la escritura de
-- otro Workspace en absoluto.
select set_config('request.jwt.claim.sub', 'e6666666-6666-6666-6666-666666666666', true);
set local role authenticated;

select is(
  rls_reopen_test.statement_row_count($$
    update public.documents set status = 'draft'
    where id = 'e1111111-d000-0000-0000-000000000001'
  $$),
  0::bigint,
  '7) Miembro de otro Workspace NO puede reabrir (aislamiento total)'
);

reset role;

-- 8) Anon (sin sesión) no puede ni leer ni escribir.
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select is(
  (select count(*) from public.documents where id = 'e1111111-d000-0000-0000-000000000001'),
  0::bigint,
  '8) Anon no puede leer la escritura'
);

select is(
  rls_reopen_test.statement_row_count($$
    update public.documents set status = 'draft'
    where id = 'e1111111-d000-0000-0000-000000000001'
  $$),
  0::bigint,
  '8) Anon no puede reabrir la escritura'
);

reset role;

-- 9) Regresión: el trigger sigue rechazando finalizar (entrar a 'final')
-- para un rol sin permiso, igual que antes de este fix. Reutiliza al
-- asistente (e3), reactivado, sobre un borrador propio nuevo.
select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.reactivate_workspace_member('e1111111-1111-1111-1111-111111111111', 'e3333333-3333-3333-3333-333333333333');
reset role;

select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);
set local role authenticated;

insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content)
values (
  'e1111111-d000-0000-0000-000000000004', 'e3333333-3333-3333-3333-333333333333',
  'e1111111-1111-1111-1111-111111111111', 'e1111111-0000-0000-0000-000000000001',
  'Doc borrador para finalizar', 'draft', '{}'::jsonb, ''
);

select ok(
  rls_reopen_test.statement_fails($$
    update public.documents set status = 'final'
    where id = 'e1111111-d000-0000-0000-000000000004'
  $$),
  '9) Regresión: asistente sigue sin poder finalizar (dirección de entrada al trigger, sin cambios)'
);

reset role;

select * from finish();

rollback;
