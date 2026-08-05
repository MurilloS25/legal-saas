import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";
import { AppShell } from "./_components/AppShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user, workspaceId, role } = await requireWorkspace();

  const { data: profile } = await supabase
    .from("lawyer_profiles")
    .select("full_name")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return (
    <AppShell
      userLabel={profile?.full_name ?? null}
      userEmail={user.email ?? null}
      showTeamLink={hasPermission(role, "members.manage")}
    >
      {children}
    </AppShell>
  );
}
