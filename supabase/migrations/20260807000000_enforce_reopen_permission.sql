-- ==================================================== reopen permission guard
--
-- `enforce_document_finalize_permission` (20260804210000) only guarded
-- *entering* `final` (propietario/administrador). Leaving `final` back to
-- `draft` (reopen) was never guarded at the DB layer: `documents_update_
-- workspace` RLS allows role `asistente` to UPDATE any workspace document
-- unconditionally, so an asistente could reopen a finalized document
-- directly via the REST API, bypassing both the UI (which hides the
-- "Reabrir escritura" button for that role) and the Server Action-level
-- check (`transitionDocument` in lifecycle-actions.ts, fixed alongside this
-- migration). This is the DB-side half of that fix — the trigger is the
-- authoritative enforcement point; the Server Action check is UX only.

create or replace function public.enforce_document_finalize_permission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if (
    (new.status = 'final' and old.status is distinct from 'final')
    or (old.status = 'final' and new.status is distinct from 'final')
  ) then
    if not public.is_workspace_member(new.workspace_id, array['propietario', 'administrador']) then
      raise exception 'finalizing or reopening a document requires propietario or administrador role'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_document_finalize_permission()
  from public, anon, authenticated;
