import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";
import type {
  TeamMember,
  WorkspaceActivityEvent,
} from "../model/types";
import { resolveSettingsLoad } from "./settings-load";

export async function loadSettingsPageData(tab: string | undefined) {
  const { supabase, user, workspaceId, role } = await requireWorkspace();
  const canManage = hasPermission(role, "settings.manage");
  const canManageMembers = hasPermission(role, "members.manage");
  const needsTeam = canManageMembers && tab === "workspace";

  const [profileResult, settingsResult, membersResult, activityResult] =
    await Promise.all([
      supabase
        .from("lawyer_profiles")
        .select("full_name, professional_code, email, phone")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      supabase
        .from("document_settings")
        .select(
          "font_family, font_size, margin_top_cm, margin_bottom_cm, margin_left_cm, margin_right_cm, line_spacing",
        )
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      needsTeam
        ? supabase.rpc("list_workspace_members").returns<TeamMember[]>()
        : Promise.resolve({ data: null, error: null }),
      needsTeam
        ? supabase
            .rpc("list_workspace_activity", { p_limit: 30 })
            .returns<WorkspaceActivityEvent[]>()
        : Promise.resolve({ data: null, error: null }),
    ]);

  const loaded = resolveSettingsLoad({
    needsTeam,
    profileResult,
    settingsResult,
    membersResult,
    activityResult,
  });

  return {
    userEmail: user.email ?? null,
    canManage,
    initialProfile: loaded.profile,
    initialSettings: loaded.settings,
    team: canManageMembers
      ? {
          canManageMembers: true,
          members: loaded.members,
          activity: loaded.activity,
          callerUserId: user.id,
          callerRole: role,
        }
      : null,
  };
}
