import { PageContainer } from "@/components/layout/PageContainer";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";
import { SettingsTabs } from "./_components/SettingsTabs";
import type { TeamMember } from "@/app/(dashboard)/dashboard/team/MemberRow";
import type { WorkspaceActivityEvent } from "@/app/(dashboard)/dashboard/team/activity-format";
import { resolveSettingsLoad } from "./settings-load";

export const metadata = {
  title: "Cuenta y configuración — LexCR",
};

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function SettingsPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const { supabase, user, workspaceId, role } = await requireWorkspace();
  const canManage = hasPermission(role, "settings.manage");
  const canManageMembers = hasPermission(role, "members.manage");
  // Solo se piden los datos de equipo cuando realmente se está viendo
  // Despacho: cada visita a esta página (incluida cada vez que una acción de
  // equipo la revalida) pagaba antes 2 consultas extra sin usarlas si el
  // usuario estaba en Perfil o Configuración.
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

  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">
            Cuenta y configuración
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Perfil, formato de documentos y despacho.
          </p>
        </div>

        <SettingsTabs
          userEmail={user.email ?? null}
          canManage={canManage}
          initialProfile={loaded.profile}
          initialSettings={loaded.settings}
          team={
            canManageMembers
              ? {
                  canManageMembers: true,
                  members: loaded.members,
                  activity: loaded.activity,
                  callerUserId: user.id,
                  callerRole: role,
                }
              : null
          }
        />
      </div>
    </PageContainer>
  );
}
