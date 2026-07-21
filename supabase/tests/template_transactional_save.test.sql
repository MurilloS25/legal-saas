begin;

set search_path = public, extensions;

select plan(26);

create schema template_save_test;
grant usage on schema template_save_test to public;

create function template_save_test.statement_fails(statement text)
returns boolean
language plpgsql
as $$
begin
  execute statement;
  return false;
exception when others then
  return true;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '71111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'template-save-a@example.test',
    'fake-local-password-hash', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  ),
  (
    '72222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'template-save-b@example.test',
    'fake-local-password-hash', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  );

select set_config('request.jwt.claim.sub', '71111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select lives_ok($$
  select * from public.save_template_workspace(
    null, null, 'Machote fake A', 'Descripción fake', 'draft',
    '{"version":1,"document":{"type":"doc","content":[]},"text":""}'::jsonb,
    '',
    '[{"field_key":"buyer_1.full_name","label":"Nombre completo","required":true}]'::jsonb
  )
$$, 'authenticated user can create a template and fields atomically');

select is((select count(*) from public.templates where name = 'Machote fake A'), 1::bigint,
  'creation persists one template');
select is((select count(*) from public.template_fields where field_key = 'buyer_1.full_name'), 1::bigint,
  'creation persists its field');
select is((select owner_id from public.templates where name = 'Machote fake A'),
  '71111111-1111-1111-1111-111111111111'::uuid, 'owner is derived from auth.uid()');

create temporary table template_save_snapshot as
select id, updated_at from public.templates where name = 'Machote fake A';

select lives_ok(format($sql$
  select * from public.save_template_workspace(
    %L::uuid, %L::timestamptz, 'Machote fake A editado', null, 'active',
    '{"version":1,"document":{"type":"doc","content":[]},"text":""}'::jsonb,
    '',
    '[{"field_key":"seller_1.full_name","label":"Vendedor","required":false}]'::jsonb
  )
$sql$, (select id from template_save_snapshot), (select updated_at from template_save_snapshot)),
  'owner can update and reconcile fields');

select is((select status from public.templates where id = (select id from template_save_snapshot)),
  'active', 'update changes template metadata');
select is((select count(*) from public.template_fields where template_id = (select id from template_save_snapshot)),
  1::bigint, 'reconciliation leaves exactly the desired fields');
select is((select field_key from public.template_fields where template_id = (select id from template_save_snapshot)),
  'seller_1.full_name', 'reconciliation removes the old field and inserts the new one');
select is((select autofill_source from public.template_fields where template_id = (select id from template_save_snapshot)),
  'none', 'a field omitting autofill_source defaults to none (historical Machotes)');
select is((select output_transform from public.template_fields where template_id = (select id from template_save_snapshot)),
  'none', 'a field omitting output_transform defaults to none (historical Machotes)');

update template_save_snapshot
set updated_at = (select updated_at from public.templates where id = template_save_snapshot.id);

select lives_ok(format($sql$
  select * from public.save_template_workspace(
    %L::uuid, %L::timestamptz, 'Machote fake A editado', null, 'active',
    '{"version":1,"document":{"type":"doc","content":[]},"text":""}'::jsonb,
    '',
    '[{"field_key":"seller_1.full_name","label":"Vendedor","required":false}]'::jsonb
  )
$sql$, (select id from template_save_snapshot), (select updated_at from template_save_snapshot)),
  'an identical save is a successful no-op');
select is((select updated_at from public.templates where id = (select id from template_save_snapshot)),
  (select updated_at from template_save_snapshot), 'no-op preserves updated_at');

select ok(template_save_test.statement_fails(format($sql$
  select * from public.save_template_workspace(
    %L::uuid, %L::timestamptz, 'Sobrescritura obsoleta', null, 'draft',
    '{"version":1,"document":{"type":"doc","content":[]},"text":""}'::jsonb,
    '', '[]'::jsonb
  )
$sql$, (select id from template_save_snapshot), '2000-01-01T00:00:00Z')),
  'stale expected_updated_at is rejected');
select is((select name from public.templates where id = (select id from template_save_snapshot)),
  'Machote fake A editado', 'stale update does not overwrite the template');

set local role postgres;
create function template_save_test.force_field_failure()
returns trigger language plpgsql as $$
begin
  if new.field_key = 'force.failure' then
    raise exception 'forced intermediate failure';
  end if;
  return new;
end;
$$;
create trigger force_template_field_failure
before insert or update on public.template_fields
for each row execute function template_save_test.force_field_failure();
set local role authenticated;
select set_config('request.jwt.claim.sub', '71111111-1111-1111-1111-111111111111', true);

select ok(template_save_test.statement_fails(format($sql$
  select * from public.save_template_workspace(
    %L::uuid, %L::timestamptz, 'Nombre que debe revertirse', null, 'draft',
    '{"version":1,"document":{"type":"doc","content":[]},"text":""}'::jsonb,
    '', '[{"field_key":"force.failure","label":"Falla","required":false}]'::jsonb
  )
$sql$, (select id from template_save_snapshot), (select updated_at from template_save_snapshot))),
  'an intermediate field failure aborts the RPC');
select is((select name from public.templates where id = (select id from template_save_snapshot)),
  'Machote fake A editado', 'intermediate failure rolls back the template update');
select is((select field_key from public.template_fields where template_id = (select id from template_save_snapshot)),
  'seller_1.full_name', 'intermediate failure rolls back field reconciliation');

set local role postgres;
drop trigger force_template_field_failure on public.template_fields;
set local role authenticated;

select set_config('request.jwt.claim.sub', '72222222-2222-2222-2222-222222222222', true);
select ok(template_save_test.statement_fails(format($sql$
  select * from public.save_template_workspace(
    %L::uuid, %L::timestamptz, 'Intento ajeno', null, 'draft',
    '{"version":1,"document":{"type":"doc","content":[]},"text":""}'::jsonb,
    '', '[]'::jsonb
  )
$sql$, (select id from template_save_snapshot), (select updated_at from template_save_snapshot))),
  'another authenticated user cannot update the template');
select is((select count(*) from public.templates where name = 'Intento ajeno'), 0::bigint,
  'cross-owner attempt changes no rows');

set local role postgres;
select ok(
  not has_function_privilege(
    'anon',
    'public.save_template_workspace(uuid,timestamptz,text,text,text,jsonb,text,jsonb)',
    'EXECUTE'
  ),
  'anonymous has no execute privilege on the RPC'
);
select is((select count(*) from public.templates where name = 'Machote anónimo'), 0::bigint,
  'anonymous attempt creates no template');

select set_config('request.jwt.claim.sub', '71111111-1111-1111-1111-111111111111', true);
select lives_ok(format($sql$
  select * from public.save_template_workspace(
    %L::uuid, %L::timestamptz, 'Machote fake A editado', null, 'active',
    '{"version":1,"document":{"type":"doc","content":[]},"text":""}'::jsonb,
    '',
    '[{"field_key":"seller_1.full_name","label":"Vendedor","required":false,"autofill_source":"client_full_name","output_transform":"digits_to_words"}]'::jsonb
  )
$sql$, (select id from template_save_snapshot),
  (select updated_at from public.templates where id = (select id from template_save_snapshot))),
  'accepts an explicit valid autofill_source and output_transform');
select is((select autofill_source from public.template_fields where template_id = (select id from template_save_snapshot)),
  'client_full_name', 'persists the explicit autofill_source');
select is((select output_transform from public.template_fields where template_id = (select id from template_save_snapshot)),
  'digits_to_words', 'persists the explicit output_transform');

select ok(template_save_test.statement_fails(format($sql$
  select * from public.save_template_workspace(
    %L::uuid, %L::timestamptz, 'Machote fake A editado', null, 'active',
    '{"version":1,"document":{"type":"doc","content":[]},"text":""}'::jsonb,
    '',
    '[{"field_key":"seller_1.full_name","label":"Vendedor","required":false,"autofill_source":"client_email"}]'::jsonb
  )
$sql$, (select id from template_save_snapshot),
  (select updated_at from public.templates where id = (select id from template_save_snapshot)))),
  'rejects an unsupported autofill_source (client_email is out of scope)');

select ok(template_save_test.statement_fails(format($sql$
  select * from public.save_template_workspace(
    %L::uuid, %L::timestamptz, 'Machote fake A editado', null, 'active',
    '{"version":1,"document":{"type":"doc","content":[]},"text":""}'::jsonb,
    '',
    '[{"field_key":"seller_1.full_name","label":"Vendedor","required":false,"output_transform":"amount_to_words"}]'::jsonb
  )
$sql$, (select id from template_save_snapshot),
  (select updated_at from public.templates where id = (select id from template_save_snapshot)))),
  'rejects an unsupported output_transform (amounts are out of scope)');

select * from finish();
rollback;
