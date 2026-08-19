-- Notarial index confirmation lifecycle (20260818140000_notarial_index_confirmation_lifecycle.sql).
--
-- Cubre: confirmar exige completitud, edición bloqueada mientras confirmado
-- (incluso vía request directa), permisos (propietario/administrador para
-- confirmar/corregir, asistente puede seguir guardando contenido mientras
-- NO está confirmado), corregir preserva valores y reabre edición,
-- corrección concurrente/doble confirmación no rompe estado, reopen de la
-- Escritura invalida la confirmación sin borrar metadata, y los eventos de
-- auditoría nuevos quedan registrados.
--
-- Nota: `dnm_update_workspace` exige `owner_id = auth.uid()` (misma
-- restricción estructural ya documentada para `documents_update_workspace`
-- en rls_document_reopen_permission.test.sql) — cada escenario de rol prueba
-- sobre SU PROPIA fila, no sobre la de otro miembro.

begin;

set search_path = public, extensions;

select plan(18);

create schema nic_test;
grant usage on schema nic_test to public;

create function nic_test.statement_fails(statement text)
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
  ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nic-owner@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('c3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nic-assistant@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

select set_config('request.jwt.claim.sub', 'c1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.invite_workspace_member('c3333333-3333-3333-3333-333333333333', 'asistente');
reset role;

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select public.accept_workspace_invitation('c1111111-1111-1111-1111-111111111111');
reset role;

select set_config('request.jwt.claim.sub', 'c1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

insert into public.templates (id, owner_id, workspace_id, name, status, content_json)
values (
  'c1111111-0000-0000-0000-000000000001', 'c1111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111', 'Tpl confirmation', 'draft', '{}'::jsonb
);

insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content)
values (
  'c1111111-d000-0000-0000-000000000001', 'c1111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111', 'c1111111-0000-0000-0000-000000000001',
  'Escritura confirmable', 'final', '{}'::jsonb, ''
);

-- 1) Confirmar exige completitud: metadata parcial, propietario intenta
-- confirmar directamente -> rechazado.
insert into public.document_notarial_metadata
  (owner_id, workspace_id, document_id, instrument_number)
values
  ('c1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111',
   'c1111111-d000-0000-0000-000000000001', 50);

select ok(
  nic_test.statement_fails($$
    update public.document_notarial_metadata
       set notarial_confirmed_at = now(), notarial_confirmed_by = 'c1111111-1111-1111-1111-111111111111'
     where document_id = 'c1111111-d000-0000-0000-000000000001'
  $$),
  '1) No se puede confirmar metadata incompleta'
);

-- Completa los campos requeridos.
update public.document_notarial_metadata
   set authorized_at = '2026-07-01T10:00:00Z', protocol_book = '08',
       initial_folio = '1F', final_folio = '1V', act_name_override = 'Compraventa',
       parties_override = 'ANA Y BETO'
 where document_id = 'c1111111-d000-0000-0000-000000000001';

reset role;

-- Escritura + metadata propias del asistente, completa, para los
-- escenarios de permiso (2, 3, 8) — la RLS de ownership exige que cada
-- actor pruebe sobre su propia fila.
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
set local role authenticated;

insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content)
values (
  'c3333333-d000-0000-0000-000000000001', 'c3333333-3333-3333-3333-333333333333',
  'c1111111-1111-1111-1111-111111111111', 'c1111111-0000-0000-0000-000000000001',
  'Escritura del asistente', 'final', '{}'::jsonb, ''
);
insert into public.document_notarial_metadata
  (owner_id, workspace_id, document_id, instrument_number, authorized_at, protocol_book,
   initial_folio, final_folio, act_name_override, parties_override)
values (
  'c3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111',
  'c3333333-d000-0000-0000-000000000001', 51, '2026-07-01T10:00:00Z', '08',
  '1F', '1V', 'Compraventa', 'ANA Y BETO'
);

-- 2) Asistente NO puede confirmar aunque los datos estén completos (rol
-- insuficiente) — sigue pudiendo guardar contenido (probado en 3).
select ok(
  nic_test.statement_fails($$
    update public.document_notarial_metadata
       set notarial_confirmed_at = now(), notarial_confirmed_by = 'c3333333-3333-3333-3333-333333333333'
     where document_id = 'c3333333-d000-0000-0000-000000000001'
  $$),
  '2) Asistente no puede confirmar (rol insuficiente)'
);

-- 3) Asistente SÍ puede seguir guardando contenido mientras no está
-- confirmado (documents.edit ya lo permite; sin cambios de comportamiento).
update public.document_notarial_metadata
   set protocol_book = '09'
 where document_id = 'c3333333-d000-0000-0000-000000000001';
select is(
  (select protocol_book from public.document_notarial_metadata where document_id = 'c3333333-d000-0000-0000-000000000001'),
  '09',
  '3) Asistente puede seguir guardando contenido sin confirmar'
);

-- 8) Asistente no puede iniciar corrección (mismo rol que confirmar) —
-- primero confirma como propietario en su propia fila para tener algo que
-- corregir, sin poder hacerlo desde el rol asistente.
reset role;
select set_config('request.jwt.claim.sub', 'c1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
update public.document_notarial_metadata
   set notarial_confirmed_at = now(), notarial_confirmed_by = 'c1111111-1111-1111-1111-111111111111'
 where document_id = 'c1111111-d000-0000-0000-000000000001';
reset role;

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select ok(
  nic_test.statement_fails($$
    update public.document_notarial_metadata
       set notarial_confirmed_at = null, notarial_confirmed_by = null, notarial_review_required = true
     where document_id = 'c3333333-d000-0000-0000-000000000001'
  $$),
  '8) Asistente no puede iniciar Corregir datos en su propia fila (rol insuficiente)'
);
reset role;

-- ------------------------------------------------------ flujo principal (propietario)

select set_config('request.jwt.claim.sub', 'c1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

-- 4) Propietario ya confirmó (paso 8 arriba, en su propia fila) — verifica
-- actor + timestamp.
select ok(
  (select notarial_confirmed_at is not null and notarial_confirmed_by = 'c1111111-1111-1111-1111-111111111111'
     from public.document_notarial_metadata where document_id = 'c1111111-d000-0000-0000-000000000001'),
  '4) Propietario confirma: queda actor + timestamp'
);

-- 5) Evento de auditoría notarial_index_data_confirmed registrado.
select is(
  (select count(*) from public.document_activity
    where document_id = 'c1111111-d000-0000-0000-000000000001'
      and event_type = 'notarial_index_data_confirmed'),
  1::bigint,
  '5) Evento notarial_index_data_confirmed registrado'
);

-- 6) Caso D: request directa que intenta editar contenido saltándose el
-- flujo de corrección -> rechazado, incluso siendo propietario.
select ok(
  nic_test.statement_fails($$
    update public.document_notarial_metadata
       set protocol_book = '99'
     where document_id = 'c1111111-d000-0000-0000-000000000001'
  $$),
  '6) Editar contenido confirmado sin pasar por Corregir datos -> rechazado'
);

-- 7) Doble confirmación no rompe nada: la fila ya no calza el predicado
-- "no confirmada" que el server action real usaría (WHERE
-- notarial_confirmed_at IS NULL) — una segunda confirmación concurrente no
-- encuentra fila que actualizar.
select is(
  (select count(*) from public.document_notarial_metadata
    where document_id = 'c1111111-d000-0000-0000-000000000001'
      and notarial_confirmed_at is null),
  0::bigint,
  '7) Segunda confirmación concurrente no encontraría fila (predicado ya no calza)'
);

-- 9) Propietario corrige: desbloquea, conserva TODOS los valores, pasa a
-- Revisión requerida.
update public.document_notarial_metadata
   set notarial_confirmed_at = null, notarial_confirmed_by = null, notarial_review_required = true
 where document_id = 'c1111111-d000-0000-0000-000000000001';
select ok(
  (select notarial_confirmed_at is null and notarial_review_required
     and protocol_book = '08' and instrument_number = 50
     from public.document_notarial_metadata where document_id = 'c1111111-d000-0000-0000-000000000001'),
  '9) Corregir datos: desbloquea, marca Revisión requerida, conserva valores'
);

-- 10) Evento notarial_index_data_correction_started registrado.
select is(
  (select count(*) from public.document_activity
    where document_id = 'c1111111-d000-0000-0000-000000000001'
      and event_type = 'notarial_index_data_correction_started'),
  1::bigint,
  '10) Evento notarial_index_data_correction_started registrado'
);

-- 11) Tras corregir, el contenido vuelve a ser editable (no confirmado).
update public.document_notarial_metadata
   set protocol_book = '10'
 where document_id = 'c1111111-d000-0000-0000-000000000001';
select is(
  (select protocol_book from public.document_notarial_metadata where document_id = 'c1111111-d000-0000-0000-000000000001'),
  '10',
  '11) Tras Corregir datos, el contenido es editable de nuevo'
);

-- 12) Reconfirmar: éxito.
update public.document_notarial_metadata
   set notarial_confirmed_at = now(), notarial_confirmed_by = 'c1111111-1111-1111-1111-111111111111'
 where document_id = 'c1111111-d000-0000-0000-000000000001';
select ok(
  (select notarial_confirmed_at is not null and not notarial_review_required
     from public.document_notarial_metadata where document_id = 'c1111111-d000-0000-0000-000000000001'),
  '12) Reconfirmar: vuelve a Confirmado'
);

-- 13) Caso G: reabrir la Escritura invalida la confirmación, sin borrar
-- metadata ni include_in_notarial_index.
update public.documents set status = 'draft'
 where id = 'c1111111-d000-0000-0000-000000000001';
select ok(
  (select notarial_confirmed_at is null and notarial_review_required
     and protocol_book = '10' and instrument_number = 50
     from public.document_notarial_metadata where document_id = 'c1111111-d000-0000-0000-000000000001'),
  '13) Reabrir invalida la confirmación y conserva la metadata'
);
select ok(
  (select include_in_notarial_index from public.documents where id = 'c1111111-d000-0000-0000-000000000001'),
  '13b) Reabrir no toca include_in_notarial_index'
);

-- 14) Caso H: re-finalizar NO reconfirma automáticamente.
update public.documents set status = 'final'
 where id = 'c1111111-d000-0000-0000-000000000001';
select ok(
  (select notarial_confirmed_at is null and notarial_review_required
     from public.document_notarial_metadata where document_id = 'c1111111-d000-0000-0000-000000000001'),
  '14) Re-finalizar no reconfirma automáticamente — sigue Revisión requerida'
);

-- 15) Reabrir una Escritura CUYA metadata nunca fue confirmada no marca
-- review_required (sin advertencia innecesaria).
insert into public.documents (id, owner_id, workspace_id, template_id, title, status, field_values, rendered_content)
values (
  'c1111111-d000-0000-0000-000000000002', 'c1111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111', 'c1111111-0000-0000-0000-000000000001',
  'Escritura nunca confirmada', 'final', '{}'::jsonb, ''
);
insert into public.document_notarial_metadata (owner_id, workspace_id, document_id, instrument_number)
values ('c1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111',
        'c1111111-d000-0000-0000-000000000002', 60);
update public.documents set status = 'draft' where id = 'c1111111-d000-0000-0000-000000000002';
select ok(
  (select not notarial_review_required from public.document_notarial_metadata
    where document_id = 'c1111111-d000-0000-0000-000000000002'),
  '15) Reabrir una Escritura nunca confirmada no marca Revisión requerida'
);

-- 16) La vista expone el estado de confirmación (NULL tras reopen, no
-- inventado).
update public.documents set status = 'final' where id = 'c1111111-d000-0000-0000-000000000002';
select is(
  (select notarial_confirmed_at from public.notarial_index_entries
    where document_id = 'c1111111-d000-0000-0000-000000000001'),
  null,
  '16) La vista expone notarial_confirmed_at (NULL tras reopen, no inventado)'
);

-- 17) Excluir/reincluir del Índice NO toca la confirmación.
update public.document_notarial_metadata
   set authorized_at = '2026-07-02T10:00:00Z', protocol_book = '08',
       initial_folio = '1F', final_folio = '1V', act_name_override = 'Compraventa',
       parties_override = 'ANA Y BETO'
 where document_id = 'c1111111-d000-0000-0000-000000000002';
update public.document_notarial_metadata
   set notarial_confirmed_at = now(), notarial_confirmed_by = 'c1111111-1111-1111-1111-111111111111',
       notarial_review_required = false
 where document_id = 'c1111111-d000-0000-0000-000000000002';
update public.documents set include_in_notarial_index = false where id = 'c1111111-d000-0000-0000-000000000002';
update public.documents set include_in_notarial_index = true where id = 'c1111111-d000-0000-0000-000000000002';
select ok(
  (select notarial_confirmed_at is not null from public.document_notarial_metadata
    where document_id = 'c1111111-d000-0000-0000-000000000002'),
  '17) Excluir/reincluir del Índice conserva la confirmación'
);

reset role;

select * from finish();

rollback;
