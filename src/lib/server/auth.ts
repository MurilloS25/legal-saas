import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UnauthorizedError } from "@/lib/server/errors";
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

// getUser() above is already cache()-memoized per request; this second
// lookup is cheap (one indexed row) and kept separate so requireUser()
// callers that don't need workspace_id (rare) don't pay for it.
const getWorkspaceMembership = cache(
  async (
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
  ) => {
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    return data;
  },
);

/**
 * Auth + Workspace context for Server Components and Server Actions.
 * `workspaceId` reemplaza `user.id` como alcance real de los datos (ver
 * docs/WORKSPACE_MULTIUSER_ARCHITECTURE.md §11) — todo query/mutación que
 * antes filtraba por `owner_id = user.id` debe filtrar por
 * `workspace_id = workspaceId` en su lugar. `owner_id` en un INSERT sigue
 * siendo `user.id` (el actor), sin cambios.
 */
export async function requireWorkspace() {
  const { supabase, user } = await requireUser();
  const membership = await getWorkspaceMembership(supabase, user.id);
  // No debería ocurrir dado el invariante "1 workspace activo por usuario"
  // (bootstrap automático en auth.users) — pero una membresía recién
  // suspendida entre el login y esta request es un caso real posible.
  if (!membership) redirect("/login");
  return {
    supabase,
    user,
    workspaceId: membership.workspace_id,
    role: membership.role as WorkspaceRole,
  };
}

/** Auth + Workspace context for Route Handlers. */
export async function requireApiWorkspace() {
  const { supabase, user } = await requireApiUser();
  const membership = await getWorkspaceMembership(supabase, user.id);
  if (!membership) throw new UnauthorizedError();
  return {
    supabase,
    user,
    workspaceId: membership.workspace_id,
    role: membership.role as WorkspaceRole,
  };
}
