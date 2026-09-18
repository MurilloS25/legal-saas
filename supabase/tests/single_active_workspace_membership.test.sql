-- Product invariant: there is no Workspace selector, so each user has at
-- most one active membership. Accepting another invitation performs an
-- explicit, atomic transition and preserves the previous membership/history.

begin;

set search_path = public, extensions;

select plan(13);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('aa111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'single-a@example.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('bb222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'single-b@example.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('cc333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'single-member@example.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

select has_index(
  'public', 'workspace_members', 'workspace_members_one_active_per_user_idx',
  'workspace_members has the partial unique active-membership index'
);

-- First join: personal bootstrap -> Workspace A.
select set_config('request.jwt.claim.sub', 'aa111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.invite_workspace_member(
  'cc333333-3333-3333-3333-333333333333', 'asistente'
);
reset role;

select set_config('request.jwt.claim.sub', 'cc333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select public.accept_workspace_invitation('aa111111-1111-1111-1111-111111111111');
reset role;

-- Workspace B invites the already active member.
select set_config('request.jwt.claim.sub', 'bb222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public.invite_workspace_member(
  'cc333333-3333-3333-3333-333333333333', 'administrador'
);
reset role;

select set_config('request.jwt.claim.sub', 'cc333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select lives_ok(
  $$select public.accept_workspace_invitation('bb222222-2222-2222-2222-222222222222')$$,
  'an active non-owner can accept and transition to another Workspace'
);
reset role;

select is(
  (select count(*) from public.workspace_members
    where user_id = 'cc333333-3333-3333-3333-333333333333' and status = 'active'),
  1::bigint,
  'the transition leaves exactly one active membership'
);

select is(
  (select status from public.workspace_members
    where workspace_id = 'aa111111-1111-1111-1111-111111111111'
      and user_id = 'cc333333-3333-3333-3333-333333333333'),
  'revoked',
  'the previous real membership is retained as revoked'
);

select is(
  (select status from public.workspace_members
    where workspace_id = 'bb222222-2222-2222-2222-222222222222'
      and user_id = 'cc333333-3333-3333-3333-333333333333'),
  'active',
  'the accepted Workspace becomes active'
);

select is(
  (select count(*) from public.workspace_activity
    where workspace_id = 'aa111111-1111-1111-1111-111111111111'
      and target_user_id = 'cc333333-3333-3333-3333-333333333333'
      and event_type = 'member_workspace_left'),
  1::bigint,
  'leaving the previous Workspace is audited'
);

select is(
  (select metadata ->> 'previousWorkspaceId' from public.workspace_activity
    where workspace_id = 'bb222222-2222-2222-2222-222222222222'
      and target_user_id = 'cc333333-3333-3333-3333-333333333333'
      and event_type = 'member_invitation_accepted'),
  'aa111111-1111-1111-1111-111111111111',
  'the acceptance audit identifies the previous Workspace'
);

select throws_ok(
  $$update public.workspace_members
       set status = 'active'
     where workspace_id = 'aa111111-1111-1111-1111-111111111111'
       and user_id = 'cc333333-3333-3333-3333-333333333333'$$,
  '23505', null,
  'the database rejects a second active membership directly'
);

-- An owner cannot silently abandon a real Workspace because ownership
-- transfer does not exist yet. The attempted accept is fully rolled back.
select set_config('request.jwt.claim.sub', 'bb222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public.invite_workspace_member(
  'aa111111-1111-1111-1111-111111111111', 'asistente'
);
reset role;

select set_config('request.jwt.claim.sub', 'aa111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select throws_ok(
  $$select public.accept_workspace_invitation('bb222222-2222-2222-2222-222222222222')$$,
  '55000',
  'workspace owner cannot accept another workspace invitation before transferring ownership',
  'an owner receives an explicit transition error'
);
reset role;

select is(
  (select status from public.workspace_members
    where workspace_id = 'aa111111-1111-1111-1111-111111111111'
      and user_id = 'aa111111-1111-1111-1111-111111111111'),
  'active',
  'the owner remains active in the owned Workspace'
);

select is(
  (select status from public.workspace_members
    where workspace_id = 'bb222222-2222-2222-2222-222222222222'
      and user_id = 'aa111111-1111-1111-1111-111111111111'),
  'invited',
  'the owner invitation remains pending after the rejected transition'
);

select throws_ok(
  $$update public.workspace_members
       set status = 'active'
     where workspace_id = 'aa111111-1111-1111-1111-111111111111'
       and user_id = 'cc333333-3333-3333-3333-333333333333'$$,
  '23505', null,
  'a revoked former membership cannot be reactivated while another is active'
);

select is(
  (select count(*) from public.workspace_members
    where user_id = 'cc333333-3333-3333-3333-333333333333' and status = 'active'),
  1::bigint,
  'failed direct/reactivation attempts preserve the invariant'
);

select * from finish();
rollback;
