import { requireUser } from "@/lib/server/auth";
import { AppShell } from "./_components/AppShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("lawyer_profiles")
    .select("full_name")
    .eq("owner_id", user.id)
    .maybeSingle();

  return (
    <AppShell userLabel={profile?.full_name ?? null} userEmail={user.email ?? null}>
      {children}
    </AppShell>
  );
}
