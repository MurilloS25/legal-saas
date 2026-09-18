-- A user can belong to several Workspaces historically (revoked rows) and
-- can have pending invitations, but the product has no Workspace selector:
-- exactly one membership may be active at a time.

do $$
begin
  if exists (
    select 1
      from public.workspace_members
     where status = 'active'
     group by user_id
    having count(*) > 1
  ) then
    raise exception
      'cannot enforce one active workspace: duplicate active memberships require explicit reconciliation'
      using errcode = '23505';
  end if;
end;
$$;

create unique index workspace_members_one_active_per_user_idx
  on public.workspace_members (user_id)
  where status = 'active';

-- Accepting an invitation is the only product flow that switches the active
-- Workspace. The transition is atomic:
--
-- * a bootstrap/personal Workspace is removed as before;
-- * a previous non-owner membership is retained as revoked for audit/history;
-- * an owner cannot silently abandon a real Workspace because the product has
--   no ownership-transfer flow yet;
-- * the destination becomes active only after the previous membership is no
--   longer active, so the unique index is respected throughout the statement.
create or replace function public.accept_workspace_invitation(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor_name text;
  v_actor_role text;
  v_previous_workspace_id uuid;
  v_previous_role text;
  v_previous_actor_name text;
  v_previous_actor_role text;
  v_discard_empty_bootstrap boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Serialize concurrent accepts for the same user, then lock all of that
  -- user's membership rows before deciding the transition.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::text, 0)
  );

  perform 1
    from public.workspace_members
   where user_id = v_uid
   for update;

  if not exists (
    select 1
      from public.workspace_members
     where workspace_id = p_workspace_id
       and user_id = v_uid
       and status = 'invited'
  ) then
    raise exception 'no pending invitation found' using errcode = 'P0002';
  end if;

  select workspace_id, role
    into v_previous_workspace_id, v_previous_role
    from public.workspace_members
   where user_id = v_uid
     and status = 'active';

  if v_previous_role = 'propietario' then
    -- A newly created/invited account receives an empty personal Workspace
    -- from the auth.users bootstrap trigger. It is safe to discard only while
    -- it has no collaborators, business rows, settings, or audit history.
    v_discard_empty_bootstrap :=
      v_previous_workspace_id = v_uid
      and not exists (
        select 1 from public.workspace_members
         where workspace_id = v_previous_workspace_id and user_id <> v_uid
      )
      and not exists (select 1 from public.clients where workspace_id = v_previous_workspace_id)
      and not exists (select 1 from public.templates where workspace_id = v_previous_workspace_id)
      and not exists (select 1 from public.template_fields where workspace_id = v_previous_workspace_id)
      and not exists (select 1 from public.template_index_configurations where workspace_id = v_previous_workspace_id)
      and not exists (select 1 from public.template_index_configuration_fields where workspace_id = v_previous_workspace_id)
      and not exists (select 1 from public.documents where workspace_id = v_previous_workspace_id)
      and not exists (select 1 from public.document_activity where workspace_id = v_previous_workspace_id)
      and not exists (select 1 from public.document_notarial_metadata where workspace_id = v_previous_workspace_id)
      and not exists (select 1 from public.document_settings where workspace_id = v_previous_workspace_id)
      and not exists (select 1 from public.receivables where workspace_id = v_previous_workspace_id)
      and not exists (select 1 from public.receivable_activity where workspace_id = v_previous_workspace_id)
      and not exists (select 1 from public.receivable_payments where workspace_id = v_previous_workspace_id)
      and not exists (select 1 from public.lawyer_profiles where workspace_id = v_previous_workspace_id)
      and not exists (select 1 from public.notarial_index_exports where workspace_id = v_previous_workspace_id)
      and not exists (select 1 from public.workspace_activity where workspace_id = v_previous_workspace_id);

    if not v_discard_empty_bootstrap then
      raise exception 'workspace owner cannot accept another workspace invitation before transferring ownership'
        using errcode = '55000';
    end if;
  end if;

  if v_discard_empty_bootstrap then
    delete from public.workspace_members
     where workspace_id = v_uid
       and user_id = v_uid;
  elsif v_previous_workspace_id is not null then
    select actor_name, actor_role
      into v_previous_actor_name, v_previous_actor_role
      from public.resolve_actor_snapshot(v_previous_workspace_id, v_uid);

    update public.workspace_members
       set status = 'revoked'
     where workspace_id = v_previous_workspace_id
       and user_id = v_uid
       and status = 'active';

    insert into public.workspace_activity (
      workspace_id, actor_user_id, target_user_id,
      actor_name_snapshot, actor_role_snapshot, event_type, metadata
    ) values (
      v_previous_workspace_id, v_uid, v_uid,
      v_previous_actor_name, v_previous_actor_role,
      'member_workspace_left',
      jsonb_build_object('nextWorkspaceId', p_workspace_id)
    );
  end if;

  update public.workspace_members
     set status = 'active'
   where workspace_id = p_workspace_id
     and user_id = v_uid
     and status = 'invited';

  if not found then
    raise exception 'no pending invitation found' using errcode = 'P0002';
  end if;

  select actor_name, actor_role
    into v_actor_name, v_actor_role
    from public.resolve_actor_snapshot(p_workspace_id, v_uid);

  insert into public.workspace_activity (
    workspace_id, actor_user_id, target_user_id,
    actor_name_snapshot, actor_role_snapshot, event_type, metadata
  ) values (
    p_workspace_id, v_uid, v_uid,
    v_actor_name, v_actor_role,
    'member_invitation_accepted',
    case
      when v_previous_workspace_id is null then '{}'::jsonb
      else jsonb_build_object('previousWorkspaceId', v_previous_workspace_id)
    end
  );
end;
$$;
