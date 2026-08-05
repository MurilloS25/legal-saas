-- Iteración 6 — Identidad notarial y auditoría de actores.
--
-- Cubre que cada tabla de auditoría (document_activity, receivable_activity,
-- workspace_activity, notarial_index_exports) fija actor_name_snapshot /
-- actor_role_snapshot al momento del evento, y que ese valor NO cambia
-- retroactivamente cuando el rol del actor cambia después o cuando el
-- actor es removido del Workspace ("miembro removido conserva historial").

begin;

set search_path = public, extensions;

select plan(19);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('e1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'actor-owner@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('e2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'actor-assistant@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

-- ------------------------------------------------------------------ workspace_activity

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.invite_workspace_member('e2222222-2222-2222-2222-222222222222', 'asistente');
reset role;

select is(
  (select actor_name_snapshot from public.workspace_activity
     where workspace_id = 'e1111111-1111-1111-1111-111111111111' and event_type = 'member_invited'),
  'actor-owner@example.test',
  'invite_workspace_member snapshotea el email del propietario que invita'
);

select is(
  (select actor_role_snapshot from public.workspace_activity
     where workspace_id = 'e1111111-1111-1111-1111-111111111111' and event_type = 'member_invited'),
  'propietario',
  'invite_workspace_member snapshotea el rol propietario'
);

select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public.accept_workspace_invitation('e1111111-1111-1111-1111-111111111111');
reset role;

select is(
  (select actor_name_snapshot from public.workspace_activity
     where workspace_id = 'e1111111-1111-1111-1111-111111111111' and event_type = 'member_invitation_accepted'),
  'actor-assistant@example.test',
  'accept_workspace_invitation snapshotea el email de quien acepta'
);

select is(
  (select actor_role_snapshot from public.workspace_activity
     where workspace_id = 'e1111111-1111-1111-1111-111111111111' and event_type = 'member_invitation_accepted'),
  'asistente',
  'accept_workspace_invitation snapshotea el rol asistente (ya activo al aceptar)'
);

-- ------------------------------------------------------------------ document_activity

insert into public.templates (id, owner_id, workspace_id, name, status, content_json)
values ('e1111111-0000-0000-0000-000000000001', 'e1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'Tpl Actor', 'active', '{}'::jsonb);

select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
set local role authenticated;
insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content)
values ('e1111111-d000-0000-0000-000000000001', 'e2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 'e1111111-0000-0000-0000-000000000001', 'Borrador de Asistente', 'draft', '{}'::jsonb, 'texto');
reset role;

select is(
  (select actor_name_snapshot from public.document_activity
     where document_id = 'e1111111-d000-0000-0000-000000000001' and event_type = 'document_created'),
  'actor-assistant@example.test',
  'Un borrador creado por el asistente queda auditado con SU nombre, no el del propietario'
);

select is(
  (select actor_role_snapshot from public.document_activity
     where document_id = 'e1111111-d000-0000-0000-000000000001' and event_type = 'document_created'),
  'asistente',
  'La auditoría muestra el rol asistente para ese borrador'
);

-- El propietario asciende al asistente a administrador DESPUÉS del borrador.
select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.change_workspace_member_role('e1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', 'administrador');
reset role;

select is(
  (select actor_role_snapshot from public.document_activity
     where document_id = 'e1111111-d000-0000-0000-000000000001' and event_type = 'document_created'),
  'asistente',
  'El snapshot histórico del borrador NO cambia retroactivamente al ascender al actor a administrador'
);

select is(
  (select actor_name_snapshot from public.workspace_activity
     where workspace_id = 'e1111111-1111-1111-1111-111111111111' and event_type = 'member_role_changed'),
  'actor-owner@example.test',
  'change_workspace_member_role snapshotea al propietario como actor (quien ejecuta el cambio)'
);

-- El propietario remueve al (ahora) administrador. El historial sobrevive
-- con el nombre y rol que tenía CUANDO ocurrió cada evento pasado.
select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.remove_workspace_member('e1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222');
reset role;

select is(
  (select count(*)::int from public.workspace_members where user_id = 'e2222222-2222-2222-2222-222222222222'),
  0,
  'El miembro queda removido (sin ninguna fila en workspace_members)'
);

select is(
  (select actor_name_snapshot from public.document_activity
     where document_id = 'e1111111-d000-0000-0000-000000000001' and event_type = 'document_created'),
  'actor-assistant@example.test',
  'Tras remover al miembro, su borrador conserva el nombre del actor en el historial'
);

select is(
  (select actor_role_snapshot from public.document_activity
     where document_id = 'e1111111-d000-0000-0000-000000000001' and event_type = 'document_created'),
  'asistente',
  'Tras remover al miembro, su borrador conserva el rol que tenía al momento del hecho'
);

-- ------------------------------------------------------------------ receivable_activity

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
insert into public.receivables (id, owner_id, workspace_id, client_id, client_name_snapshot, concept, currency, amount_total, issued_at)
values ('e1111111-b000-0000-0000-000000000001', 'e1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', null, 'Cliente Libre', 'Honorarios', 'CRC', 1000, current_date);
reset role;

select is(
  (select actor_name_snapshot from public.receivable_activity
     where receivable_id = 'e1111111-b000-0000-0000-000000000001' and event_type = 'receivable_created'),
  'actor-owner@example.test',
  'Crear una cuenta por cobrar queda auditado con el nombre del propietario'
);

select is(
  (select actor_role_snapshot from public.receivable_activity
     where receivable_id = 'e1111111-b000-0000-0000-000000000001' and event_type = 'receivable_created'),
  'propietario',
  'Crear una cuenta por cobrar queda auditado con el rol propietario'
);

-- ------------------------------------------------------------------ notarial_index_exports

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.log_notarial_index_export('docx', current_date - 14, current_date, 3);
reset role;

select is(
  (select actor_name_snapshot from public.notarial_index_exports where workspace_id = 'e1111111-1111-1111-1111-111111111111'),
  'actor-owner@example.test',
  'Exportar el índice notarial queda auditado con el nombre de quien exporta'
);

select is(
  (select actor_role_snapshot from public.notarial_index_exports where workspace_id = 'e1111111-1111-1111-1111-111111111111'),
  'propietario',
  'Exportar el índice notarial queda auditado con el rol de quien exporta'
);

-- ------------------------------------------------------------------ resolve_actor_snapshot: fallback

select is(
  (select actor_name from public.resolve_actor_snapshot('e1111111-1111-1111-1111-111111111111', 'ffffffff-ffff-ffff-ffff-ffffffffffff')),
  'desconocido',
  'resolve_actor_snapshot cae a "desconocido" para un usuario que no existe (defensivo, nunca debe romper la auditoría)'
);

-- ------------------------------------------------------------------ list_workspace_activity

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select cmp_ok(
  (select count(*)::int from public.list_workspace_activity(50)),
  '>=',
  4,
  'list_workspace_activity devuelve el historial del Workspace del propietario (invite/accept/role-changed/removed)'
);

select is(
  (select target_email from public.list_workspace_activity(50) where event_type = 'member_removed' limit 1),
  'actor-assistant@example.test',
  'list_workspace_activity resuelve el email del target (aunque ya no sea miembro) como etiqueta de conveniencia'
);

reset role;

select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is(
  (select count(*)::int from public.list_workspace_activity(50)),
  0,
  'Un usuario removido (sin membresía activa en ningún Workspace) no ve el historial de equipo de nadie'
);

reset role;

select * from finish();

rollback;
