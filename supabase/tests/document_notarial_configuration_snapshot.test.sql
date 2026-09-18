begin;

set search_path = public, extensions;

select plan(2);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'd5222222-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'notarial-snapshot@example.test', 'fake-hash',
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.templates (
  id, owner_id, workspace_id, name, status, content_json
)
values (
  'd5222222-0000-0000-0000-000000000001',
  'd5222222-1111-1111-1111-111111111111',
  'd5222222-1111-1111-1111-111111111111',
  'Acto actual', 'active', '{"text":"Contenido"}'::jsonb
);

insert into public.documents (
  id, owner_id, workspace_id, template_id, title, rendered_content,
  include_in_notarial_index, template_snapshot
)
values
  (
    'd5222222-d000-0000-0000-000000000001',
    'd5222222-1111-1111-1111-111111111111',
    'd5222222-1111-1111-1111-111111111111',
    'd5222222-0000-0000-0000-000000000001',
    'Snapshot notarial v2', 'Contenido', true,
    '{"version":2,"document":{"type":"doc","content":[{"type":"paragraph"}]},"fields":[],"notarial":{"templateName":"Acto histórico","configuration":null}}'::jsonb
  ),
  (
    'd5222222-d000-0000-0000-000000000002',
    'd5222222-1111-1111-1111-111111111111',
    'd5222222-1111-1111-1111-111111111111',
    'd5222222-0000-0000-0000-000000000001',
    'Snapshot anterior v1', 'Contenido', true,
    '{"version":1,"document":{"type":"doc","content":[{"type":"paragraph"}]},"fields":[]}'::jsonb
  );

select set_config(
  'request.jwt.claim.sub',
  'd5222222-1111-1111-1111-111111111111',
  true
);
set local role authenticated;

update public.documents
set status = 'final'
where id in (
  'd5222222-d000-0000-0000-000000000001',
  'd5222222-d000-0000-0000-000000000002'
);

select is(
  (
    select act_name
    from public.notarial_index_entries
    where document_id = 'd5222222-d000-0000-0000-000000000001'
  ),
  'Acto histórico',
  'version-2 Escrituras use the historical Machote name captured at creation'
);

select is(
  (
    select act_name
    from public.notarial_index_entries
    where document_id = 'd5222222-d000-0000-0000-000000000002'
  ),
  'Acto actual',
  'version-1 Escrituras keep the explicit current-template compatibility fallback'
);

reset role;
select * from finish();
rollback;
