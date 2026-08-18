-- Notarial index inclusion (20260818130000_notarial_index_inclusion.sql).
--
-- `status = 'final'` ya no implica por sí solo pertenencia al Índice
-- Notarial: `documents.include_in_notarial_index` es la decisión explícita.
-- Cubre: default true (compatibilidad hacia atrás), la vista
-- `notarial_index_entries` filtrando por status+inclusion, el resguardo
-- `effective_index_date` (nunca afecta is_complete ni la fecha real), el
-- trigger de permiso extendido, y el nuevo evento de auditoría.

begin;

set search_path = public, extensions;

select plan(12);

-- ------------------------------------------------------------------ fixtures

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('f1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'incl-owner@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('f3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'incl-assistant@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

select set_config('request.jwt.claim.sub', 'f1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.invite_workspace_member('f3333333-3333-3333-3333-333333333333', 'asistente');
reset role;

select set_config('request.jwt.claim.sub', 'f3333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select public.accept_workspace_invitation('f1111111-1111-1111-1111-111111111111');
reset role;

select set_config('request.jwt.claim.sub', 'f1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

insert into public.templates (id, owner_id, workspace_id, name, status, content_json)
values (
  'f1111111-0000-0000-0000-000000000001', 'f1111111-1111-1111-1111-111111111111',
  'f1111111-1111-1111-1111-111111111111', 'Tpl inclusion', 'draft', '{}'::jsonb
);

-- 1) Default true: preserva el comportamiento previo para filas nuevas sin
-- decisión explícita.
insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content)
values (
  'f1111111-d000-0000-0000-000000000001', 'f1111111-1111-1111-1111-111111111111',
  'f1111111-1111-1111-1111-111111111111', 'f1111111-0000-0000-0000-000000000001',
  'Caso A borrador', 'draft', '{}'::jsonb, ''
);
select ok(
  (select include_in_notarial_index from public.documents where id = 'f1111111-d000-0000-0000-000000000001'),
  '1) include_in_notarial_index nace en true por defecto'
);

-- Caso A: borrador, sin importar el flag, nunca aparece en el Índice.
select is(
  (select count(*) from public.notarial_index_entries where document_id = 'f1111111-d000-0000-0000-000000000001'),
  0::bigint,
  '2) Caso A: un borrador (aunque include=true) no aparece en el Índice'
);

-- Caso B: final + include=false → excluida.
insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content, include_in_notarial_index)
values (
  'f1111111-d000-0000-0000-000000000002', 'f1111111-1111-1111-1111-111111111111',
  'f1111111-1111-1111-1111-111111111111', 'f1111111-0000-0000-0000-000000000001',
  'Caso B constancia', 'final', '{}'::jsonb, '', false
);
select is(
  (select count(*) from public.notarial_index_entries where document_id = 'f1111111-d000-0000-0000-000000000002'),
  0::bigint,
  '3) Caso B: finalizada pero excluida no aparece en el Índice'
);

-- Caso E: final + include=true + authorized_at NULL (sin metadata) →
-- ubicable provisionalmente por effective_index_date = created_at, sin que
-- eso la marque completa ni invente una fecha de autorización real.
insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content, include_in_notarial_index, created_at)
values (
  'f1111111-d000-0000-0000-000000000003', 'f1111111-1111-1111-1111-111111111111',
  'f1111111-1111-1111-1111-111111111111', 'f1111111-0000-0000-0000-000000000001',
  'Caso E sin fecha', 'final', '{}'::jsonb, '', true, '2026-05-10T12:00:00Z'
);
select is(
  (select count(*) from public.notarial_index_entries where document_id = 'f1111111-d000-0000-0000-000000000003'),
  1::bigint,
  '4) Caso E: final+incluida sin authorized_at sigue siendo localizable en el Índice'
);
select is(
  (select authorized_at from public.notarial_index_entries where document_id = 'f1111111-d000-0000-0000-000000000003'),
  null,
  '5) Caso E: authorized_at real permanece NULL — nunca se inventa'
);
select is(
  (select effective_index_date from public.notarial_index_entries where document_id = 'f1111111-d000-0000-0000-000000000003'),
  '2026-05-10T12:00:00Z'::timestamptz,
  '6) Caso E: effective_index_date cae a created_at solo para ubicación provisional'
);
select ok(
  (select not is_complete from public.notarial_index_entries where document_id = 'f1111111-d000-0000-0000-000000000003'),
  '7) Caso E: la fecha provisional nunca marca is_complete=true'
);

-- 8) Permission trigger: asistente no puede cambiar include_in_notarial_index
-- de una escritura propia finalizada, mismo guardia que finalizar/reabrir.
insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content, include_in_notarial_index)
values (
  'f1111111-d000-0000-0000-000000000004', 'f1111111-1111-1111-1111-111111111111',
  'f1111111-1111-1111-1111-111111111111', 'f1111111-0000-0000-0000-000000000001',
  'Caso G/H propietario', 'final', '{}'::jsonb, '', true
);
reset role;

select set_config('request.jwt.claim.sub', 'f3333333-3333-3333-3333-333333333333', true);
set local role authenticated;

insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content, include_in_notarial_index)
values (
  'f1111111-d000-0000-0000-000000000005', 'f3333333-3333-3333-3333-333333333333',
  'f1111111-1111-1111-1111-111111111111', 'f1111111-0000-0000-0000-000000000001',
  'Doc asistente', 'final', '{}'::jsonb, '', true
);

select throws_ok(
  $$update public.documents set include_in_notarial_index = false
    where id = 'f1111111-d000-0000-0000-000000000005'$$,
  '42501',
  null,
  '8) Asistente NO puede cambiar la inclusión (rol insuficiente, mismo trigger de finalizar/reabrir)'
);

reset role;

-- 9-10) Caso G→H: propietario excluye y luego vuelve a incluir.
select set_config('request.jwt.claim.sub', 'f1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

update public.documents set include_in_notarial_index = false
 where id = 'f1111111-d000-0000-0000-000000000004';
select is(
  (select count(*) from public.notarial_index_entries where document_id = 'f1111111-d000-0000-0000-000000000004'),
  0::bigint,
  '9) Caso G: al desmarcar, desaparece del Índice sin perder status=final'
);
select is(
  (select status from public.documents where id = 'f1111111-d000-0000-0000-000000000004'),
  'final',
  '9b) Caso G: la escritura permanece finalizada'
);

update public.documents set include_in_notarial_index = true
 where id = 'f1111111-d000-0000-0000-000000000004';
select is(
  (select count(*) from public.notarial_index_entries where document_id = 'f1111111-d000-0000-0000-000000000004'),
  1::bigint,
  '10) Caso H: al reincluir, reaparece en el Índice'
);

-- 11) Auditoría: el cambio de inclusión queda registrado en document_activity
-- reutilizando el sistema existente (no uno nuevo).
select is(
  (select count(*) from public.document_activity
    where document_id = 'f1111111-d000-0000-0000-000000000004'
      and event_type = 'notarial_index_inclusion_changed'),
  2::bigint,
  '11) Cada cambio de inclusión queda auditado en document_activity'
);

reset role;

select * from finish();

rollback;
