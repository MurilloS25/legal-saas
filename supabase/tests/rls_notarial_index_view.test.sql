begin;

set search_path = public, extensions;

select plan(16);

select ok(
  'security_invoker=on' = any(coalesce(
    (select reloptions from pg_class
      where oid = 'public.notarial_index_entries'::regclass),
    array[]::text[]
  )),
  'notarial_index_entries uses security_invoker=true'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('81111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-niv-a@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('82222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-niv-b@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

insert into public.templates (id, owner_id, name, status, content_json) values
  ('81111111-0000-0000-0000-000000000001','81111111-1111-1111-1111-111111111111','Compraventa','draft','{}'::jsonb),
  ('82222222-0000-0000-0000-000000000001','82222222-2222-2222-2222-222222222222','Poder','draft','{}'::jsonb);

insert into public.documents (id, owner_id, template_id, title, status, field_values, rendered_content) values
  ('81111111-d000-0000-0000-000000000001','81111111-1111-1111-1111-111111111111','81111111-0000-0000-0000-000000000001','Día 1','draft','{}'::jsonb,''),
  ('81111111-d000-0000-0000-000000000002','81111111-1111-1111-1111-111111111111','81111111-0000-0000-0000-000000000001','Día 15','draft','{}'::jsonb,''),
  ('81111111-d000-0000-0000-000000000003','81111111-1111-1111-1111-111111111111','81111111-0000-0000-0000-000000000001','Día 16','draft','{}'::jsonb,''),
  ('81111111-d000-0000-0000-000000000004','81111111-1111-1111-1111-111111111111','81111111-0000-0000-0000-000000000001','Fin de mes','draft','{}'::jsonb,''),
  ('81111111-d000-0000-0000-000000000005','81111111-1111-1111-1111-111111111111','81111111-0000-0000-0000-000000000001','Draft A','draft','{}'::jsonb,''),
  ('82222222-d000-0000-0000-000000000001','82222222-2222-2222-2222-222222222222','82222222-0000-0000-0000-000000000001','Final B','final','{}'::jsonb,'');

select set_config('request.jwt.claim.sub','81111111-1111-1111-1111-111111111111', true);
set local role authenticated;

insert into public.document_notarial_metadata
  (owner_id, document_id, instrument_number, authorized_at, protocol_book,
   initial_folio, final_folio, act_name_snapshot, act_name_override,
   generated_parties, parties_override)
values
  ('81111111-1111-1111-1111-111111111111','81111111-d000-0000-0000-000000000001',40,'2026-07-01T06:00:00Z','08','1F','1V','Compraventa',null,'ANA Y BETO',null),
  ('81111111-1111-1111-1111-111111111111','81111111-d000-0000-0000-000000000002',10,'2026-07-16T05:59:59Z','08','2F','2V','Compraventa','VENTA CORREGIDA','ANA Y BETO','ANA Y CARLOS'),
  ('81111111-1111-1111-1111-111111111111','81111111-d000-0000-0000-000000000003',30,'2026-07-16T06:00:00Z','08','3F','3V','Compraventa',null,'DORA',null),
  ('81111111-1111-1111-1111-111111111111','81111111-d000-0000-0000-000000000004',20,'2026-08-01T05:59:59Z','08','4F','4V','Compraventa',null,'ELENA',null);

update public.documents set status = 'ready'
 where id in (
  '81111111-d000-0000-0000-000000000001',
  '81111111-d000-0000-0000-000000000002',
  '81111111-d000-0000-0000-000000000003',
  '81111111-d000-0000-0000-000000000004'
 );
update public.documents set status = 'final'
 where id in (
  '81111111-d000-0000-0000-000000000001',
  '81111111-d000-0000-0000-000000000002',
  '81111111-d000-0000-0000-000000000003',
  '81111111-d000-0000-0000-000000000004'
 );

select is((select count(*) from public.notarial_index_entries),
  4::bigint, 'Owner sees only their finalized entries');
select is((select count(*) from public.notarial_index_entries where is_complete),
  4::bigint, 'All eight required index values derive completeness');
select is((select period_half from public.notarial_index_entries where instrument_number = 40),
  'FIRST_HALF', 'Costa Rica day 1 is in the first half');
select is((select period_half from public.notarial_index_entries where instrument_number = 10),
  'FIRST_HALF', 'Costa Rica day 15 is in the first half');
select is((select period_half from public.notarial_index_entries where instrument_number = 30),
  'SECOND_HALF', 'Costa Rica day 16 is in the second half');
select is((select period_half from public.notarial_index_entries where instrument_number = 20),
  'SECOND_HALF', 'Costa Rica final calendar day is in the second half');
select is((select act_name from public.notarial_index_entries where instrument_number = 10),
  'VENTA CORREGIDA', 'Manual act override wins over its snapshot');
select is((select act_name from public.notarial_index_entries where instrument_number = 40),
  'Compraventa', 'Act snapshot remains the fallback');
select is((select parties from public.notarial_index_entries where instrument_number = 10),
  'ANA Y CARLOS', 'Manual parties override wins over generated parties');
select is((select parties from public.notarial_index_entries where instrument_number = 40),
  'ANA Y BETO', 'Generated parties remain the fallback');
select is((select array_agg(instrument_number order by instrument_number)
  from public.notarial_index_entries), array[10,20,30,40],
  'Instrument numbers support deterministic numeric ordering');

reset role;
select set_config('request.jwt.claim.sub','82222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select is((select count(*) from public.notarial_index_entries),
  1::bigint, 'Another owner sees only their own finalized entry');
select ok((select not has_metadata from public.notarial_index_entries),
  'A finalized document without metadata remains visible as incomplete');
-- Regresión: sin ninguna fila de metadata guardada (act_name_snapshot y
-- act_name_override ambos NULL por el LEFT JOIN), act_name debe caer al
-- nombre del machote — misma fuente ya usada por saveNotarialMetadataAction
-- y por el prefill del cliente — nunca quedar NULL/"Sin configurar" cuando
-- el machote sí tiene un nombre real.
select is((select act_name from public.notarial_index_entries),
  'Poder', 'act_name falls back to the template name with no saved metadata at all');

reset role;
select set_config('request.jwt.claim.sub','', true);
set local role anon;
select is((select count(*) from public.notarial_index_entries),
  0::bigint, 'Anonymous cannot read notarial index entries');

reset role;
select * from finish();
rollback;
