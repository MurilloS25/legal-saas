-- list_workspace_members (Iteración 5): la UI "Mi equipo" necesita email y
-- nombre de cada miembro, dato que vive en auth.users/lawyer_profiles y no
-- es accesible directo vía PostgREST. Cubre: solo miembros activos ven la
-- lista, aislamiento entre Workspaces, e invitados 'invited' SÍ aparecen en
-- la lista del Workspace (a diferencia de get_pending_workspace_invitation,
-- que es la vista del propio invitado antes de aceptar).

begin;

set search_path = public, extensions;

select plan(4);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('d1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'list-owner@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('d2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'list-assistant@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('d3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'list-outsider@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select lives_ok(
  $$select public.invite_workspace_member('d2222222-2222-2222-2222-222222222222', 'asistente')$$,
  'Propietario invita a d2 como asistente'
);

select is(
  (select count(*)::int from public.list_workspace_members()),
  2,
  'El propietario ve las 2 filas de su Workspace (propietario + invitado pendiente)'
);

select is(
  (select email from public.list_workspace_members() where user_id = 'd2222222-2222-2222-2222-222222222222'),
  'list-assistant@example.test',
  'El email del invitado se expone correctamente al propietario'
);

reset role;

-- Un tercero sin relación con el Workspace no ve nada.
select set_config('request.jwt.claim.sub', 'd3333333-3333-3333-3333-333333333333', true);
set local role authenticated;

select is(
  (select count(*)::int from public.list_workspace_members()),
  1,
  'Un tercero solo ve su propio Workspace personal (1 fila: él mismo)'
);

reset role;

select * from finish();

rollback;
