-- get_pending_workspace_invitation: expone los datos mínimos (nombre del
-- Workspace y rol ofrecido) que la página /accept-invite necesita mostrar
-- ANTES de que el usuario invitado acepte. Es necesaria porque
-- is_workspace_member() — y por lo tanto toda la RLS de workspaces/
-- workspace_members — exige status = 'active', y un invitado todavía está
-- en status = 'invited': sin este RPC SECURITY DEFINER, la página de
-- aceptación no podría leer ni el nombre del Workspace ni el rol. Solo
-- devuelve la invitación de auth.uid(), nunca la de otro usuario.
create or replace function public.get_pending_workspace_invitation()
returns table (workspace_id uuid, workspace_name text, role text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select w.id, w.name, m.role
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = auth.uid()
    and m.status = 'invited'
  order by m.created_at desc
  limit 1;
$$;

revoke all on function public.get_pending_workspace_invitation() from public, anon;
grant execute on function public.get_pending_workspace_invitation() to authenticated;
