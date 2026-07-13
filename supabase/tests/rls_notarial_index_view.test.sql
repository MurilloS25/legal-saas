begin;

set search_path = public, extensions;

select plan(6);

-- seed
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('81111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-niv-a@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('82222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-niv-b@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

insert into public.templates (id, owner_id, name, status, content_json) values
  ('81111111-0000-0000-0000-000000000001','81111111-1111-1111-1111-111111111111','Tpl A','draft','{}'::jsonb),
  ('82222222-0000-0000-0000-000000000001','82222222-2222-2222-2222-222222222222','Tpl B','draft','{}'::jsonb);

-- A: una que se finalizará (con metadata completa), una draft (no aparece).
insert into public.documents (id, owner_id, template_id, title, status, field_values, rendered_content) values
  ('81111111-d000-0000-0000-000000000001','81111111-1111-1111-1111-111111111111','81111111-0000-0000-0000-000000000001','Final A','draft','{}'::jsonb,''),
  ('81111111-d000-0000-0000-000000000002','81111111-1111-1111-1111-111111111111','81111111-0000-0000-0000-000000000001','Draft A','draft','{}'::jsonb,'');

-- Metadata mientras la escritura aún es editable (antes de finalizar).
insert into public.document_notarial_metadata (owner_id, document_id, instrument_number, authorized_at, act_type)
values ('81111111-1111-1111-1111-111111111111','81111111-d000-0000-0000-000000000001','100','2026-07-13T16:35:00Z','Compraventa');

-- Ahora se finaliza.
update public.documents set status = 'final' where id = '81111111-d000-0000-0000-000000000001';

-- B: una final sin metadata.
insert into public.documents (id, owner_id, template_id, title, status, field_values, rendered_content) values
  ('82222222-d000-0000-0000-000000000001','82222222-2222-2222-2222-222222222222','82222222-0000-0000-0000-000000000001','Final B','final','{}'::jsonb,'');

-- ------------------------------------------------------------------ user A
select set_config('request.jwt.claim.sub','81111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select is((select count(*) from public.notarial_index_entries),
  1::bigint, 'User A sees only their own finalized entry (drafts excluded)');

select is((select document_id from public.notarial_index_entries),
  '81111111-d000-0000-0000-000000000001'::uuid, 'The visible entry is the finalized document');

select ok((select is_complete from public.notarial_index_entries
  where document_id = '81111111-d000-0000-0000-000000000001'),
  'A finalized document with the three core fields is complete');

select ok((select has_metadata from public.notarial_index_entries
  where document_id = '81111111-d000-0000-0000-000000000001'),
  'has_metadata is true when metadata exists');

-- ------------------------------------------------------------------ user B
reset role;
select set_config('request.jwt.claim.sub','82222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is((select count(*) from public.notarial_index_entries),
  1::bigint, 'User B sees only their own finalized entry, not User A');

select ok((select not has_metadata from public.notarial_index_entries
  where document_id = '82222222-d000-0000-0000-000000000001'),
  'A finalized document without metadata shows has_metadata false (not hidden)');

reset role;
select * from finish();
rollback;
