-- Template notarial index default (20260819210000_template_notarial_index_default.sql).
--
-- Cubre: default true para Machotes existentes/nuevos, la RPC
-- set_template_notarial_index_default respeta permisos de Workspace
-- (templates.write: propietario/administrador/asistente; solo_lectura y
-- miembros de otro Workspace bloqueados), y que el snapshot al crear una
-- Escritura es independiente de cambios posteriores al Machote (probado a
-- nivel de datos — el snapshot real ocurre en application code, no en DB).

begin;

set search_path = public, extensions;

select plan(10);

create schema tnid_test;
grant usage on schema tnid_test to public;

create function tnid_test.statement_fails(statement text)
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
  ('e1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tnid-owner@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('e3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tnid-assistant@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('e4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tnid-readonly@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('e6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tnid-outsider@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.invite_workspace_member('e3333333-3333-3333-3333-333333333333', 'asistente');
select public.invite_workspace_member('e4444444-4444-4444-4444-444444444444', 'solo_lectura');
reset role;

select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select public.accept_workspace_invitation('e1111111-1111-1111-1111-111111111111');
reset role;

select set_config('request.jwt.claim.sub', 'e4444444-4444-4444-4444-444444444444', true);
set local role authenticated;
select public.accept_workspace_invitation('e1111111-1111-1111-1111-111111111111');
reset role;

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

insert into public.templates (id, owner_id, workspace_id, name, status, content_json)
values (
  'e1111111-0000-0000-0000-000000000001', 'e1111111-1111-1111-1111-111111111111',
  'e1111111-1111-1111-1111-111111111111', 'Tpl A', 'active', '{}'::jsonb
);

-- 1) Default true para un Machote recién creado.
select ok(
  (select include_in_notarial_index_by_default from public.templates
    where id = 'e1111111-0000-0000-0000-000000000001'),
  '1) include_in_notarial_index_by_default nace en true por defecto'
);

-- 2) Propietario puede desactivarlo vía la RPC.
select public.set_template_notarial_index_default('e1111111-0000-0000-0000-000000000001', false);
select is(
  (select include_in_notarial_index_by_default from public.templates
    where id = 'e1111111-0000-0000-0000-000000000001'),
  false,
  '2) Propietario puede desactivar el default vía la RPC'
);

-- 3) Asistente (templates.write) puede reactivarlo.
reset role;
select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select public.set_template_notarial_index_default('e1111111-0000-0000-0000-000000000001', true);
select is(
  (select include_in_notarial_index_by_default from public.templates
    where id = 'e1111111-0000-0000-0000-000000000001'),
  true,
  '3) Asistente (templates.write) puede reactivar el default'
);
reset role;

-- 4) Solo_lectura no puede cambiarlo.
select set_config('request.jwt.claim.sub', 'e4444444-4444-4444-4444-444444444444', true);
set local role authenticated;
select ok(
  tnid_test.statement_fails($$
    select public.set_template_notarial_index_default('e1111111-0000-0000-0000-000000000001', false)
  $$),
  '4) Solo_lectura no puede cambiar el default (rol insuficiente)'
);
reset role;

-- 5) Miembro de otro Workspace no puede cambiarlo (ni siquiera ve el Machote).
select set_config('request.jwt.claim.sub', 'e6666666-6666-6666-6666-666666666666', true);
set local role authenticated;
select ok(
  tnid_test.statement_fails($$
    select public.set_template_notarial_index_default('e1111111-0000-0000-0000-000000000001', false)
  $$),
  '5) Miembro de otro Workspace no puede cambiar el default'
);
reset role;

-- 6) Anon no puede ejecutar la función en absoluto.
select ok(not has_function_privilege(
  'anon',
  'public.set_template_notarial_index_default(uuid,boolean)',
  'EXECUTE'
), '6) Anon no tiene EXECUTE sobre la función');
select ok(has_function_privilege(
  'authenticated',
  'public.set_template_notarial_index_default(uuid,boolean)',
  'EXECUTE'
), '6b) Authenticated sí tiene EXECUTE sobre la función');

-- ------------------------------------------------------ snapshot al crear Escritura

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

-- 7) Machote con default=true -> Escritura nace include_in_notarial_index=true.
insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content, include_in_notarial_index)
values (
  'e1111111-d000-0000-0000-000000000001', 'e1111111-1111-1111-1111-111111111111',
  'e1111111-1111-1111-1111-111111111111', 'e1111111-0000-0000-0000-000000000001',
  'Escritura con default true', 'draft', '{}'::jsonb, '',
  (select include_in_notarial_index_by_default from public.templates where id = 'e1111111-0000-0000-0000-000000000001')
);
select ok(
  (select include_in_notarial_index from public.documents where id = 'e1111111-d000-0000-0000-000000000001'),
  '7) Machote con default=true produce Escritura con include_in_notarial_index=true'
);

-- 8) Machote con default=false -> Escritura nace include_in_notarial_index=false.
select public.set_template_notarial_index_default('e1111111-0000-0000-0000-000000000001', false);
insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content, include_in_notarial_index)
values (
  'e1111111-d000-0000-0000-000000000002', 'e1111111-1111-1111-1111-111111111111',
  'e1111111-1111-1111-1111-111111111111', 'e1111111-0000-0000-0000-000000000001',
  'Escritura con default false', 'draft', '{}'::jsonb, '',
  (select include_in_notarial_index_by_default from public.templates where id = 'e1111111-0000-0000-0000-000000000001')
);
select ok(
  (select not include_in_notarial_index from public.documents where id = 'e1111111-d000-0000-0000-000000000002'),
  '8) Machote con default=false produce Escritura con include_in_notarial_index=false'
);

-- 9) Cambiar el Machote DESPUÉS no afecta Escrituras ya creadas (ninguna de
-- las dos filas anteriores cambia al reactivar el default).
select public.set_template_notarial_index_default('e1111111-0000-0000-0000-000000000001', true);
select ok(
  (select include_in_notarial_index from public.documents where id = 'e1111111-d000-0000-0000-000000000001')
  and (select not include_in_notarial_index from public.documents where id = 'e1111111-d000-0000-0000-000000000002'),
  '9) Cambiar el Machote después no modifica Escrituras ya creadas'
);

reset role;

select * from finish();

rollback;
