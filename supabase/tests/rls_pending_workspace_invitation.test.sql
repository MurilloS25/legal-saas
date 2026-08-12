-- get_pending_workspace_invitation (Iteración 5): la página /accept-invite
-- debe poder leer nombre del Workspace y rol ofrecido para un usuario
-- todavía en status = 'invited' (is_workspace_member exige 'active', por lo
-- que la RLS normal de workspaces/workspace_members no le sirve). El RPC
-- nunca debe exponer la invitación de otro usuario.

begin;

set search_path = public, extensions;

select plan(5);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pending-owner@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('c2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pending-invitee@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('c3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pending-outsider@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

update public.workspaces set name = 'Notaría de Prueba'
 where id = 'c1111111-1111-1111-1111-111111111111';

select set_config('request.jwt.claim.sub', 'c1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select lives_ok(
  $$select public.invite_workspace_member('c2222222-2222-2222-2222-222222222222', 'asistente')$$,
  'Propietario invita a c2 como asistente'
);

reset role;

-- El invitado ve su propia invitación pendiente.
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is(
  (select workspace_name from public.get_pending_workspace_invitation()),
  'Notaría de Prueba',
  'El invitado ve el nombre del Workspace que lo invitó'
);

select is(
  (select role from public.get_pending_workspace_invitation()),
  'asistente',
  'El invitado ve el rol ofrecido'
);

reset role;

-- Un tercero sin invitación pendiente no ve nada.
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
set local role authenticated;

select is(
  (select count(*)::int from public.get_pending_workspace_invitation()),
  0,
  'Un usuario sin invitación pendiente no obtiene filas'
);

reset role;

-- Tras aceptar, la invitación deja de aparecer como pendiente.
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select public.accept_workspace_invitation('c1111111-1111-1111-1111-111111111111');

select is(
  (select count(*)::int from public.get_pending_workspace_invitation()),
  0,
  'Tras aceptar, ya no hay invitación pendiente que mostrar'
);

reset role;

select * from finish();

rollback;
