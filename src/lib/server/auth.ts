import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/server/errors";
import type { WorkspaceRole } from "@/lib/server/permissions";

const getServerAuth = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
});

/** Auth context for Server Components and Server Actions. */
export async function requireUser() {
  const context = await getServerAuth();
  if (!context.user) redirect("/login");
  return { supabase: context.supabase, user: context.user };
}

/** Auth context for Route Handlers. APIs must map this error to HTTP. */
export async function requireApiUser() {
  const context = await getServerAuth();
  if (!context.user) throw new UnauthorizedError();
  return { supabase: context.supabase, user: context.user };
}

/**
 * Estado de acceso a Workspace de un usuario ya autenticado. `status` en
 * `workspace_members` puede ser 'active' | 'invited' | 'revoked', y un
 * usuario puede no tener NINGUNA fila (removido, o nunca tuvo una) — de
 * ahí los 4 casos. Nunca hay un fallback a ningún `workspace_id`: si no
 * hay una membresía 'active', `workspaceId` simplemente no existe en el
 * resultado (ver docs/WORKSPACE_MULTIUSER_ARCHITECTURE.md §12.6).
 */
export type WorkspaceAccessState =
  | { kind: "active"; workspaceId: string; role: WorkspaceRole }
  | { kind: "invited"; workspaceId: string }
  | { kind: "suspended" }
  | { kind: "none" };

// getUser() above is already cache()-memoized per request; esta segunda
// consulta es barata (a lo sumo un par de filas, por el índice en user_id)
// y se mantiene separada para no pagarla en los callers de requireUser()
// que no necesitan Workspace.
//
// Se trae TODAS las filas del usuario (no solo status='active') porque un
// usuario puede tener, a la vez, su Workspace personal activo Y una
// invitación real pendiente (antes de aceptarla) — o, tras ser removido,
// ninguna fila en absoluto.
//
// CUALQUIER usuario nuevo (incluido uno recién invitado: admin.inviteUserByEmail
// también inserta en auth.users, y eso dispara el mismo trigger de bootstrap)
// tiene su propio Workspace personal — `workspaces.id = auth.users.id`, ver
// bootstrap_workspace_for_new_user() — activo desde el instante en que existe
// la cuenta, ANTES de aceptar ninguna invitación. Si ese Workspace personal
// "ganara" simplemente por tener status='active', un invitado que inicia
// sesión normalmente (sin pasar por el enlace del correo, que sí resuelve
// /accept-invite por su cuenta sin pasar por aquí) caería silenciosamente en
// su propio Workspace vacío en vez de ver la invitación — nunca llegaría a
// /accept-invite. Por eso una invitación pendiente ('invited') gana sobre
// ese Workspace personal específicamente (`workspace_id === userId`, la
// única forma en que un Workspace tiene ese id, por construcción del
// bootstrap) — pero NO sobre una membresía activa genuina en otro Workspace
// (alguien ya asentado en un Workspace real que además recibe una invitación
// nueva a otro no debería ser desviado de su Workspace real en cada login).
export const getWorkspaceAccess = cache(
  async (
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
  ): Promise<WorkspaceAccessState> => {
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, status")
      .eq("user_id", userId);

    const rows = data ?? [];

    const genuineActive = rows.find(
      (row) => row.status === "active" && row.workspace_id !== userId,
    );
    if (genuineActive) {
      return {
        kind: "active",
        workspaceId: genuineActive.workspace_id,
        role: genuineActive.role as WorkspaceRole,
      };
    }

    const invited = rows.find((row) => row.status === "invited");
    if (invited) {
      return { kind: "invited", workspaceId: invited.workspace_id };
    }

    const bootstrapActive = rows.find(
      (row) => row.status === "active" && row.workspace_id === userId,
    );
    if (bootstrapActive) {
      return {
        kind: "active",
        workspaceId: bootstrapActive.workspace_id,
        role: bootstrapActive.role as WorkspaceRole,
      };
    }

    const suspended = rows.find((row) => row.status === "revoked");
    if (suspended) {
      return { kind: "suspended" };
    }

    return { kind: "none" };
  },
);

/**
 * Auth + Workspace context for Server Components and Server Actions.
 * `workspaceId` reemplaza `user.id` como alcance real de los datos (ver
 * docs/WORKSPACE_MULTIUSER_ARCHITECTURE.md §11) — todo query/mutación que
 * antes filtraba por `owner_id = user.id` debe filtrar por
 * `workspace_id = workspaceId` en su lugar. `owner_id` en un INSERT sigue
 * siendo `user.id` (el actor), sin cambios.
 *
 * Un usuario autenticado sin membresía activa NUNCA cae de vuelta a
 * /login — sus credenciales siguen siendo válidas, solo no tiene acceso a
 * ningún Workspace ahora mismo. Se le manda a /accept-invite (si tiene una
 * invitación real pendiente) o a /workspace-unavailable (suspendido o sin
 * ninguna membresía), que sí puede distinguir esos dos casos porque vuelve
 * a resolver el estado por su cuenta.
 */
export async function requireWorkspace() {
  const { supabase, user } = await requireUser();
  const access = await getWorkspaceAccess(supabase, user.id);

  if (access.kind === "active") {
    return {
      supabase,
      user,
      workspaceId: access.workspaceId,
      role: access.role,
    };
  }
  if (access.kind === "invited") {
    redirect("/accept-invite");
  }
  redirect("/workspace-unavailable");
}

/** Auth + Workspace context for Route Handlers. */
export async function requireApiWorkspace() {
  const { supabase, user } = await requireApiUser();
  const access = await getWorkspaceAccess(supabase, user.id);
  if (access.kind === "active") {
    return {
      supabase,
      user,
      workspaceId: access.workspaceId,
      role: access.role,
    };
  }
  // invited/suspended/none: autenticado, pero sin acceso a este recurso —
  // 403, no 401 (eso ya lo cubrió requireApiUser() arriba).
  throw new ForbiddenError();
}
