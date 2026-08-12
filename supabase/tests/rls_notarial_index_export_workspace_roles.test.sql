-- Notarial Index export RPC (`log_notarial_index_export`) authorization
-- matrix across Workspace roles/membership states — the existing
-- rls_notarial_index_exports.test.sql only exercises a single owner
-- (their own bootstrap Workspace, always role propietario), never actually
-- testing role/membership restriction. This is the test-first audit for
-- "Gap A": confirm (or expose and fix) whether the RPC's authorization is
-- workspace-membership+permission based, per `notarial_index.generate`
-- (propietario/administrador only, src/lib/server/permissions.ts), or still
-- leaking on `owner_id`.

begin;

set search_path = public, extensions;

select plan(15);

create schema rls_nie_roles_test;
grant usage on schema rls_nie_roles_test to public;

-- ------------------------------------------------------- función/permiso: introspección estática

-- SECURITY DEFINER + search_path fijo (evita hijacking vía search_path del
-- caller) — verificado antes de tocar ningún dato, independiente de rol.
select ok(
  (select prosecdef from pg_proc
    where oid = 'public.log_notarial_index_export(text, date, date, integer)'::regprocedure),
  'log_notarial_index_export is SECURITY DEFINER'
);

select ok(
  (select proconfig from pg_proc
    where oid = 'public.log_notarial_index_export(text, date, date, integer)'::regprocedure)
    @> array['search_path=pg_catalog, public'],
  'log_notarial_index_export pins search_path to pg_catalog, public'
);

-- Grants: ni anon ni el pseudo-rol PUBLIC tienen EXECUTE — solo
-- authenticated (y postgres/service_role, fuera del alcance de esta prueba).
select ok(
  not has_function_privilege(
    'anon', 'public.log_notarial_index_export(text, date, date, integer)', 'EXECUTE'
  ),
  'anon has no EXECUTE grant on the export RPC'
);
select ok(
  not has_function_privilege(
    'public', 'public.log_notarial_index_export(text, date, date, integer)', 'EXECUTE'
  ),
  'The PUBLIC pseudo-role has no EXECUTE grant on the export RPC'
);

-- ------------------------------------------------------------------ fixtures

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nie-owner@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('a2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nie-admin@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('a3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nie-assistant@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('a4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nie-readonly@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('a5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nie-suspended@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('a6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nie-removed@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('a7777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nie-outsider@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

-- Propietario (a1) forma su equipo: administrador (a2), asistente (a3),
-- solo_lectura (a4), un miembro que se suspende (a5), y uno que se remueve
-- por completo (a6).
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.invite_workspace_member('a2222222-2222-2222-2222-222222222222', 'administrador');
select public.invite_workspace_member('a3333333-3333-3333-3333-333333333333', 'asistente');
select public.invite_workspace_member('a4444444-4444-4444-4444-444444444444', 'solo_lectura');
select public.invite_workspace_member('a5555555-5555-5555-5555-555555555555', 'administrador');
select public.invite_workspace_member('a6666666-6666-6666-6666-666666666666', 'asistente');
reset role;

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public.accept_workspace_invitation('a1111111-1111-1111-1111-111111111111');
reset role;

select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select public.accept_workspace_invitation('a1111111-1111-1111-1111-111111111111');
reset role;

select set_config('request.jwt.claim.sub', 'a4444444-4444-4444-4444-444444444444', true);
set local role authenticated;
select public.accept_workspace_invitation('a1111111-1111-1111-1111-111111111111');
reset role;

select set_config('request.jwt.claim.sub', 'a5555555-5555-5555-5555-555555555555', true);
set local role authenticated;
select public.accept_workspace_invitation('a1111111-1111-1111-1111-111111111111');
reset role;

select set_config('request.jwt.claim.sub', 'a6666666-6666-6666-6666-666666666666', true);
set local role authenticated;
select public.accept_workspace_invitation('a1111111-1111-1111-1111-111111111111');
reset role;

select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.suspend_workspace_member('a1111111-1111-1111-1111-111111111111', 'a5555555-5555-5555-5555-555555555555');
select public.remove_workspace_member('a1111111-1111-1111-1111-111111111111', 'a6666666-6666-6666-6666-666666666666');
reset role;

-- ------------------------------------------------------------------ escenarios

-- 1) Propietario: permitido, queda registrado en su Workspace.
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.log_notarial_index_export('docx', '2026-07-01', '2026-07-15', 3);
reset role;

select is(
  (select count(*) from public.notarial_index_exports
    where workspace_id = 'a1111111-1111-1111-1111-111111111111' and owner_id = 'a1111111-1111-1111-1111-111111111111'),
  1::bigint,
  '1) Propietario: el RPC registra la exportación en su Workspace'
);

-- 2) Administrador: permitido (mismo Workspace, no propietario).
select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public.log_notarial_index_export('docx', '2026-07-01', '2026-07-15', 5);
reset role;

select is(
  (select count(*) from public.notarial_index_exports
    where workspace_id = 'a1111111-1111-1111-1111-111111111111' and owner_id = 'a2222222-2222-2222-2222-222222222222'),
  1::bigint,
  '2) Administrador: el RPC registra la exportación'
);

-- 3) Asistente (sin notarial_index.generate): la llamada no rompe, pero no
-- registra nada — mismo patrón "silencioso" que un formato inválido.
select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select public.log_notarial_index_export('docx', '2026-07-01', '2026-07-15', 7);
reset role;

select is(
  (select count(*) from public.notarial_index_exports where owner_id = 'a3333333-3333-3333-3333-333333333333'),
  0::bigint,
  '3) Asistente: sin permiso funcional, el RPC no registra nada (rol insuficiente)'
);

-- 4) Solo_lectura: igual, sin permiso funcional.
select set_config('request.jwt.claim.sub', 'a4444444-4444-4444-4444-444444444444', true);
set local role authenticated;
select public.log_notarial_index_export('docx', '2026-07-01', '2026-07-15', 9);
reset role;

select is(
  (select count(*) from public.notarial_index_exports where owner_id = 'a4444444-4444-4444-4444-444444444444'),
  0::bigint,
  '4) Solo_lectura: sin permiso funcional, el RPC no registra nada'
);

-- 5) Miembro suspendido (a5, era administrador): sin membresía ACTIVA, el
-- RPC no encuentra ningún Workspace y no registra nada.
select set_config('request.jwt.claim.sub', 'a5555555-5555-5555-5555-555555555555', true);
set local role authenticated;
select public.log_notarial_index_export('docx', '2026-07-01', '2026-07-15', 11);
reset role;

select is(
  (select count(*) from public.notarial_index_exports where owner_id = 'a5555555-5555-5555-5555-555555555555'),
  0::bigint,
  '5) Miembro suspendido (rol antes válido): sin membresía activa, no registra nada'
);

-- 6) Miembro removido (a6, sin ninguna fila en workspace_members): mismo
-- resultado, por la misma razón (sin membresía activa en ningún Workspace).
select set_config('request.jwt.claim.sub', 'a6666666-6666-6666-6666-666666666666', true);
set local role authenticated;
select public.log_notarial_index_export('docx', '2026-07-01', '2026-07-15', 13);
reset role;

select is(
  (select count(*) from public.notarial_index_exports where owner_id = 'a6666666-6666-6666-6666-666666666666'),
  0::bigint,
  '6) Miembro removido: sin ninguna membresía, no registra nada'
);

-- 7) Usuario de un Workspace completamente distinto (a7, dueño de su propio
-- Workspace bootstrap, rol propietario ahí): el RPC SÍ registra, pero
-- atribuido a SU PROPIO Workspace — nunca al de a1 — y no puede ver el
-- historial de exportaciones de a1 (aislamiento).
select set_config('request.jwt.claim.sub', 'a7777777-7777-7777-7777-777777777777', true);
set local role authenticated;
select public.log_notarial_index_export('docx', '2026-07-01', '2026-07-15', 4);

select is(
  (select count(*) from public.notarial_index_exports),
  1::bigint,
  '7a) Miembro de otro Workspace: ve únicamente su propia exportación (aislamiento)'
);
select is(
  (select workspace_id from public.notarial_index_exports limit 1),
  'a7777777-7777-7777-7777-777777777777'::uuid,
  '7b) Miembro de otro Workspace: su exportación queda atribuida a SU Workspace, nunca al ajeno'
);
reset role;

-- El Workspace de a1 tampoco ve la exportación de a7 (aislamiento en ambos
-- sentidos).
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select is(
  (select count(*) from public.notarial_index_exports where owner_id = 'a7777777-7777-7777-7777-777777777777'),
  0::bigint,
  '7c) El Workspace de a1 no ve la exportación de un Workspace completamente distinto'
);
reset role;

-- 8) Anon: bloqueado por falta de grant EXECUTE (ya verificado arriba de
-- forma estática); confirma también que no puede leer nada.
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select is(
  (select count(*) from public.notarial_index_exports),
  0::bigint,
  '8) Anon no puede leer el historial de exportaciones'
);
reset role;

-- ------------------------------------------------------------------ resumen

select is(
  (select count(*) from public.notarial_index_exports),
  3::bigint,
  '9) Total esperado: propietario + administrador + miembro de otro Workspace (3), nada más'
);

select * from finish();

rollback;
