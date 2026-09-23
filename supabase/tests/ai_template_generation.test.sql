-- AI template generation ledger (20260923120000_ai_template_generation.sql).
--
-- Cubre: authenticated no puede escribir el libro ni el override de cuota,
-- ni ejecutar las RPCs begin/finish; solo service_role. begin exige
-- membresía activa con rol de escritura, aplica la cuota diaria (default y
-- override por Workspace), impide dos generaciones activas del mismo
-- usuario y cierra filas huérfanas. finish solo acepta un borrador del
-- mismo Workspace y registra el evento de auditoría `template_ai_generated`.
-- Aislamiento: un miembro de otro Workspace no ve las filas.

begin;

set search_path = public, extensions;

select plan(24);

create schema aitg_test;
grant usage on schema aitg_test to public;

create function aitg_test.error_message(statement text)
returns text
language plpgsql
as $$
begin
  execute statement;
  return null;
exception when others then
  return sqlerrm;
end;
$$;
grant execute on function aitg_test.error_message(text) to public;

-- ------------------------------------------------------------------ fixtures

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a1a1a1a1-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aitg-owner@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('a1a1a1a1-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aitg-readonly@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('a1a1a1a1-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aitg-outsider@example.test', 'fake-hash', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

select set_config('request.jwt.claim.sub', 'a1a1a1a1-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.invite_workspace_member('a1a1a1a1-4444-4444-4444-444444444444', 'solo_lectura');
insert into public.templates (id, owner_id, workspace_id, name, status, content_json)
values
  ('a1a1a1a1-0000-0000-0000-000000000001', 'a1a1a1a1-1111-1111-1111-111111111111',
   'a1a1a1a1-1111-1111-1111-111111111111', 'AI draft', 'draft', '{}'::jsonb),
  ('a1a1a1a1-0000-0000-0000-000000000002', 'a1a1a1a1-1111-1111-1111-111111111111',
   'a1a1a1a1-1111-1111-1111-111111111111', 'Published', 'active', '{}'::jsonb);
reset role;

select set_config('request.jwt.claim.sub', 'a1a1a1a1-4444-4444-4444-444444444444', true);
set local role authenticated;
select public.accept_workspace_invitation('a1a1a1a1-1111-1111-1111-111111111111');
reset role;

-- ---------------------------------------------------- authenticated is locked out

select set_config('request.jwt.claim.sub', 'a1a1a1a1-1111-1111-1111-111111111111', true);
set local role authenticated;

select ok(
  aitg_test.error_message($$select public.begin_ai_template_generation(
    'a1a1a1a1-1111-1111-1111-111111111111', 'a1a1a1a1-1111-1111-1111-111111111111',
    'text', 10, 'openai', 'm', 'v1', 1000, 600)$$) like 'permission denied%',
  '1) authenticated cannot execute begin (would allow choosing its own limit)'
);
select ok(
  aitg_test.error_message($$select public.finish_ai_template_generation(
    gen_random_uuid(), 'failed', 'x', null, 1, null, null, 1, '{}'::jsonb, false)$$) like 'permission denied%',
  '2) authenticated cannot execute finish (would allow refunding quota)'
);
select ok(
  aitg_test.error_message($$insert into public.ai_template_generations
    (workspace_id, actor_user_id, source_type, provider, model, schema_version, input_chars)
    values ('a1a1a1a1-1111-1111-1111-111111111111', 'a1a1a1a1-1111-1111-1111-111111111111',
            'text', 'openai', 'm', 'v1', 1)$$) like 'permission denied%',
  '3) authenticated cannot insert into the ledger'
);
select ok(
  aitg_test.error_message($$insert into public.workspace_ai_settings
    (workspace_id, ai_template_daily_limit_per_user)
    values ('a1a1a1a1-1111-1111-1111-111111111111', 999)$$) like 'permission denied%',
  '4) an owner cannot raise their own Workspace quota'
);
reset role;

-- -------------------------------------------------------- begin (service_role)

set local role service_role;

select ok(
  aitg_test.error_message($$select public.begin_ai_template_generation(
    'a1a1a1a1-1111-1111-1111-111111111111', 'a1a1a1a1-4444-4444-4444-444444444444',
    'text', 10, 'openai', 'm', 'v1', 2, 600)$$) like '%workspace_membership_required%',
  '5) solo_lectura cannot start a generation'
);
select ok(
  aitg_test.error_message($$select public.begin_ai_template_generation(
    'a1a1a1a1-1111-1111-1111-111111111111', 'a1a1a1a1-6666-6666-6666-666666666666',
    'text', 10, 'openai', 'm', 'v1', 2, 600)$$) like '%workspace_membership_required%',
  '6) an outsider cannot start a generation in another Workspace'
);

create temporary table aitg_ids (label text primary key, id uuid) on commit drop;
grant all on aitg_ids to public;

insert into aitg_ids values ('first', public.begin_ai_template_generation(
  'a1a1a1a1-1111-1111-1111-111111111111', 'a1a1a1a1-1111-1111-1111-111111111111',
  'pdf', 1200, 'openai', 'model-x', 'lexcr.template_generation.v1', 2, 600));

select is(
  (select status from public.ai_template_generations where id = (select id from aitg_ids where label = 'first')),
  'running',
  '7) begin inserts a running row'
);
select ok(
  aitg_test.error_message($$select public.begin_ai_template_generation(
    'a1a1a1a1-1111-1111-1111-111111111111', 'a1a1a1a1-1111-1111-1111-111111111111',
    'text', 10, 'openai', 'm', 'v1', 2, 600)$$) like '%ai_generation_in_progress%',
  '8) a second concurrent generation of the same user is rejected'
);
select ok(
  aitg_test.error_message($$insert into public.ai_template_generations
    (workspace_id, actor_user_id, source_type, provider, model, schema_version, input_chars)
    values ('a1a1a1a1-1111-1111-1111-111111111111', 'a1a1a1a1-1111-1111-1111-111111111111',
            'text', 'openai', 'm', 'v1', 1)$$) like '%ai_template_generations_one_running_per_user%',
  '9) the partial unique index also blocks a second running row'
);

-- ----------------------------------------------------------------- finish

select ok(
  aitg_test.error_message(format($$select public.finish_ai_template_generation(
    %L, 'succeeded', null, 'a1a1a1a1-0000-0000-0000-000000000002', 1, 10, 20, 100, '{}'::jsonb, true)$$,
    (select id from aitg_ids where label = 'first'))) like '%template_not_draft_in_workspace%',
  '10) finish rejects a published (non-draft) template'
);

select public.finish_ai_template_generation(
  (select id from aitg_ids where label = 'first'), 'succeeded', null,
  'a1a1a1a1-0000-0000-0000-000000000001', 2, 1500, 3000, 4200,
  '{"reviewKeys":["comprador.estado_civil"],"warnings":["ambiguous_values"]}'::jsonb, true);

select is(
  (select status || ':' || attempts || ':' || template_id
     from public.ai_template_generations where id = (select id from aitg_ids where label = 'first')),
  'succeeded:2:a1a1a1a1-0000-0000-0000-000000000001',
  '11) finish records success, attempts (retry in the same row) and template'
);
select is(
  (select count(*)::integer from public.workspace_activity
    where event_type = 'template_ai_generated'
      and metadata->>'templateId' = 'a1a1a1a1-0000-0000-0000-000000000001'
      and metadata->>'provider' = 'openai'
      and metadata->>'model' = 'model-x'
      and actor_name_snapshot = 'aitg-owner@example.test'),
  1,
  '12) success writes one audit event with actor, template, provider and model'
);
select ok(
  aitg_test.error_message(format($$select public.finish_ai_template_generation(
    %L, 'failed', 'internal_error', null, 1, null, null, 1, '{}'::jsonb, false)$$,
    (select id from aitg_ids where label = 'first'))) like '%generation_not_running%',
  '13) a finished generation cannot be finished again'
);

-- -------------------------------------------------------------------- quota

insert into aitg_ids values ('second', public.begin_ai_template_generation(
  'a1a1a1a1-1111-1111-1111-111111111111', 'a1a1a1a1-1111-1111-1111-111111111111',
  'text', 10, 'openai', 'model-x', 'v1', 2, 600));
select public.finish_ai_template_generation(
  (select id from aitg_ids where label = 'second'), 'failed', 'invalid_output', null,
  2, 100, 100, 10, '{}'::jsonb, true);

select ok(
  aitg_test.error_message($$select public.begin_ai_template_generation(
    'a1a1a1a1-1111-1111-1111-111111111111', 'a1a1a1a1-1111-1111-1111-111111111111',
    'text', 10, 'openai', 'm', 'v1', 2, 600)$$) like '%ai_quota_exceeded%',
  '14) the third generation of the day exceeds the default limit of 2'
);
select is(
  (select count(*)::integer from public.workspace_activity
    where event_type = 'template_ai_generated'
      and workspace_id = 'a1a1a1a1-1111-1111-1111-111111111111'),
  1,
  '15) failures do not write audit events (they stay in the ledger)'
);

-- Un fallo no cobrable (proveedor no disponible) libera la unidad.
update public.ai_template_generations set counts_toward_quota = false
 where id = (select id from aitg_ids where label = 'second');
insert into aitg_ids values ('third', public.begin_ai_template_generation(
  'a1a1a1a1-1111-1111-1111-111111111111', 'a1a1a1a1-1111-1111-1111-111111111111',
  'text', 10, 'openai', 'm', 'v1', 2, 600));
select isnt((select id from aitg_ids where label = 'third'), null,
  '16) a non-billable failure does not consume quota');
select public.finish_ai_template_generation(
  (select id from aitg_ids where label = 'third'), 'failed', 'provider_unavailable', null,
  1, null, null, 1, '{}'::jsonb, true);

-- Override por Workspace.
insert into public.workspace_ai_settings (workspace_id, ai_template_daily_limit_per_user)
values ('a1a1a1a1-1111-1111-1111-111111111111', 5);
insert into aitg_ids values ('fourth', public.begin_ai_template_generation(
  'a1a1a1a1-1111-1111-1111-111111111111', 'a1a1a1a1-1111-1111-1111-111111111111',
  'text', 10, 'openai', 'm', 'v1', 2, 600));
select isnt((select id from aitg_ids where label = 'fourth'), null,
  '17) the Workspace override raises the daily limit without code changes');

-- Fila huérfana: se cierra como abandonada al iniciar otra.
update public.ai_template_generations
   set started_at = clock_timestamp() - interval '20 minutes'
 where id = (select id from aitg_ids where label = 'fourth');
insert into aitg_ids values ('fifth', public.begin_ai_template_generation(
  'a1a1a1a1-1111-1111-1111-111111111111', 'a1a1a1a1-1111-1111-1111-111111111111',
  'text', 10, 'openai', 'm', 'v1', 2, 600));
select is(
  (select status || ':' || error_code from public.ai_template_generations
    where id = (select id from aitg_ids where label = 'fourth')),
  'failed:abandoned',
  '18) a stale running generation is closed as abandoned'
);

select ok(
  aitg_test.error_message($$select public.begin_ai_template_generation(
    'a1a1a1a1-1111-1111-1111-111111111111', 'a1a1a1a1-1111-1111-1111-111111111111',
    'text', 10, 'openai', 'm', 'v1', 5000, 600)$$) like '%invalid_daily_limit%',
  '19) the caller-provided default limit is bounded'
);
select ok(
  aitg_test.error_message($$update public.ai_template_generations
    set review_summary = '[]'::jsonb$$) like '%ai_template_generations_review_summary_valid%',
  '20) review_summary must be a JSON object'
);
reset role;

-- --------------------------------------------------------------- visibility

select set_config('request.jwt.claim.sub', 'a1a1a1a1-4444-4444-4444-444444444444', true);
set local role authenticated;
select ok(
  (select count(*) from public.ai_template_generations
    where template_id = 'a1a1a1a1-0000-0000-0000-000000000001') = 1,
  '21) a Workspace member can see that a template was AI-generated'
);
select ok(
  aitg_test.error_message($$select count(*) from public.workspace_ai_settings$$)
    like 'permission denied%',
  '22) quota overrides are not readable by members'
);
reset role;

select set_config('request.jwt.claim.sub', 'a1a1a1a1-6666-6666-6666-666666666666', true);
set local role authenticated;
select is(
  (select count(*)::integer from public.ai_template_generations
    where workspace_id = 'a1a1a1a1-1111-1111-1111-111111111111'),
  0,
  '23) members of another Workspace cannot see the ledger'
);
select ok(
  aitg_test.error_message($$update public.ai_template_generations set counts_toward_quota = false$$)
    like 'permission denied%',
  '24) authenticated cannot update the ledger'
);
reset role;

select * from finish();
rollback;
