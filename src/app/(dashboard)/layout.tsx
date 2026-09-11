import { requireWorkspace } from "@/lib/server/auth";
import { AppShell } from "./_components/AppShell";
import { NavigationGuardProvider } from "@/components/navigation/NavigationGuard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user, workspaceId } = await requireWorkspace();

  const { data: profile } = await supabase
    .from("lawyer_profiles")
    .select("full_name")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return (
    <NavigationGuardProvider>
    <AppShell userLabel={profile?.full_name ?? null} userEmail={user.email ?? null}>
      {children}
    </AppShell>
    </NavigationGuardProvider>
  );
}
