import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";

export async function getTeamRouteDestination() {
  const { role } = await requireWorkspace();

  return hasPermission(role, "members.manage")
    ? "/dashboard/settings?tab=workspace"
    : "/dashboard";
}
