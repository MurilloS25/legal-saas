import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";
import { InviteMemberForm } from "./InviteMemberForm";
import { TeamMembersTable } from "./TeamMembersTable";

export default async function TeamPage() {
  const { supabase, user, role } = await requireWorkspace();

  if (!hasPermission(role, "members.manage")) {
    redirect("/dashboard");
  }

  const { data: members, error } = await supabase
    .rpc("list_workspace_members")
    .returns<
      {
        id: string;
        user_id: string;
        email: string | null;
        full_name: string | null;
        role: string;
        status: string;
        invited_by: string | null;
        created_at: string;
      }[]
    >();

  if (error) {
    throw new Error("No fue posible cargar los miembros del equipo.");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Mi equipo</h1>
        <p className="mt-1 text-sm text-slate-500">
          Invita colaboradores, asigna roles y gestiona su acceso al Workspace.
        </p>
      </div>

      <div className="mb-8">
        <InviteMemberForm />
      </div>

      <TeamMembersTable
        members={members ?? []}
        callerUserId={user.id}
        callerRole={role}
      />
    </div>
  );
}
