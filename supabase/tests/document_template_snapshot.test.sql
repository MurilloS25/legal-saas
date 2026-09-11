begin;

set search_path = public, extensions;

select plan(5);

select has_column(
  'public',
  'documents',
  'template_snapshot',
  'documents stores its structured template snapshot'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'd5111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'snapshot-owner@example.test', 'fake-hash',
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.templates (
  id, owner_id, workspace_id, name, status, content_json
)
values (
  'd5111111-0000-0000-0000-000000000001',
  'd5111111-1111-1111-1111-111111111111',
  'd5111111-1111-1111-1111-111111111111',
  'Snapshot Template', 'active', '{"text":"Version one"}'::jsonb
);

select lives_ok($sql$
  insert into public.documents (
    id, owner_id, workspace_id, template_id, title, rendered_content, template_snapshot
  ) values (
    'd5111111-0000-0000-0000-000000000002',
    'd5111111-1111-1111-1111-111111111111',
    'd5111111-1111-1111-1111-111111111111',
    'd5111111-0000-0000-0000-000000000001',
    'Structured snapshot', 'Version one',
    '{"version":1,"document":{"type":"doc","content":[{"type":"paragraph"}]},"fields":[]}'::jsonb
  )
$sql$, 'a structured snapshot can be stored when the document is created');

select lives_ok($sql$
  insert into public.documents (
    id, owner_id, workspace_id, template_id, title, rendered_content
  ) values (
    'd5111111-0000-0000-0000-000000000003',
    'd5111111-1111-1111-1111-111111111111',
    'd5111111-1111-1111-1111-111111111111',
    'd5111111-0000-0000-0000-000000000001',
    'Pre-migration document', 'Historical text'
  )
$sql$, 'null remains valid for explicit pre-migration compatibility');

select throws_ok($sql$
  insert into public.documents (
    owner_id, workspace_id, template_id, title, template_snapshot
  ) values (
    'd5111111-1111-1111-1111-111111111111',
    'd5111111-1111-1111-1111-111111111111',
    'd5111111-0000-0000-0000-000000000001',
    'Invalid snapshot', '[]'::jsonb
  )
$sql$, '23514', null, 'non-object snapshots are rejected');

select throws_ok($sql$
  update public.documents
  set template_snapshot = '{"version":2}'::jsonb
  where id = 'd5111111-0000-0000-0000-000000000002'
$sql$, '23514', 'document template snapshot is immutable',
  'the creation snapshot cannot be changed later');

select * from finish();
rollback;
