-- Un usuario siempre debe poder ver su propia fila en workspace_members,
-- sin importar su status ('active' | 'invited' | 'revoked') o si ya no
-- tiene ninguna. La política existente
-- (workspace_members_select_same_workspace) exige is_workspace_member(),
-- que a su vez exige status = 'active' — así que un miembro suspendido o
-- recién removido no podía ver ni siquiera su propia fila 'revoked', y
-- ambos casos (suspendido vs. sin ninguna membresía) colapsaban de forma
-- indistinguible a "cero filas" para cualquier consulta hecha como ese
-- mismo usuario. Esto rompía getWorkspaceAccess() en
-- src/lib/server/auth.ts, que necesita poder leer su propia fila para
-- decidir entre /workspace-unavailable (suspendido/removido) y
-- /accept-invite (invitado).
create policy "workspace_members_select_own"
on public.workspace_members for select to authenticated
using (user_id = auth.uid());
