-- default_workspace_id_from_actor(): cuando un actor tiene más de una fila
-- activa en workspace_members (su propio Workspace de arranque + uno donde
-- fue añadido directamente como activo, sin pasar por
-- accept_workspace_invitation()), el trigger debe preferir la membresía
-- "genuina" (workspace_id distinto de su propio user id) sobre la de
-- arranque — igual que ya hace getWorkspaceAccess() a nivel de aplicación.
--
-- Reproduce el fixture que expuso el bug original: un asistente insertado
-- directamente en workspace_members con status 'active' (como hacen varios
-- specs E2E vía service role, sin pasar por la RPC que sí limpia el
-- Workspace de arranque al aceptar).

begin;

set search_path = public, extensions;

select plan(3);

-- Propietario (dueño del Workspace compartido).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('91111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dwifa-owner@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('92222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dwifa-assistant@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

-- El bootstrap automático (trigger sobre auth.users) ya le creó a cada uno
-- su propio Workspace personal como propietario. El asistente además se
-- añade DIRECTO como activo al Workspace compartido del propietario, sin
-- pasar por accept_workspace_invitation() — así queda con dos filas
-- activas, la ambigüedad que el trigger debe resolver.
insert into public.workspace_members (workspace_id, user_id, role, status, invited_by)
values ('91111111-1111-1111-1111-111111111111','92222222-2222-2222-2222-222222222222','asistente','active','91111111-1111-1111-1111-111111111111');

select is(
  (select count(*) from public.workspace_members
    where user_id = '92222222-2222-2222-2222-222222222222' and status = 'active'),
  2::bigint,
  'El asistente del fixture queda con dos membresías activas (arranque propio + compartida)'
);

-- Datos mínimos del Workspace compartido para poder crear una cuenta por
-- cobrar como el asistente.
insert into public.clients (id, owner_id, workspace_id, full_name, identification_type,
  identification_number, marital_status, nationality, occupation, exact_address)
values ('91111111-c000-0000-0000-000000000001','91111111-1111-1111-1111-111111111111','91111111-1111-1111-1111-111111111111','Cliente Owner','cedula_fisica','1-1111-1111','soltero','Costarricense','Abogado','San José');

-- El asistente actúa: crea una cuenta por cobrar bajo el Workspace
-- compartido (workspace_id explícito, como hace createReceivableRow).
select set_config('request.jwt.claim.sub','92222222-2222-2222-2222-222222222222', true);
set local role authenticated;

insert into public.receivables (id, owner_id, workspace_id, client_id, concept, currency, amount_total, issued_at)
values ('92222222-a000-0000-0000-000000000001','92222222-2222-2222-2222-222222222222','91111111-1111-1111-1111-111111111111','91111111-c000-0000-0000-000000000001','Honorarios','CRC',40000.00,'2026-08-12');

-- receivables_record_activity (AFTER INSERT) dispara la fila de auditoría;
-- su propio BEFORE INSERT (default_workspace_id_from_actor) debe resolver
-- workspace_id = el compartido (el mismo de la cuenta), no el de arranque
-- del asistente — de lo contrario esta fila ni siquiera se insertaría
-- (ra_receivable_workspace_fk la rechazaría con 23503, el bug original).
select is(
  (select workspace_id from public.receivable_activity
    where receivable_id = '92222222-a000-0000-0000-000000000001' and event_type = 'receivable_created'),
  '91111111-1111-1111-1111-111111111111'::uuid,
  'La actividad de la cuenta resuelve el Workspace compartido (genuino), no el de arranque del asistente'
);

reset role;

select isnt(
  (select workspace_id from public.receivable_activity
    where receivable_id = '92222222-a000-0000-0000-000000000001' and event_type = 'receivable_created'),
  '92222222-2222-2222-2222-222222222222'::uuid,
  'La actividad de la cuenta NO resuelve el Workspace de arranque del asistente'
);

select * from finish();
rollback;
