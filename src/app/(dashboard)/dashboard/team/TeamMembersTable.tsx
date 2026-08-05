import type { WorkspaceRole } from "@/lib/server/permissions";
import { MemberRow, type TeamMember } from "./MemberRow";

type Props = {
  members: TeamMember[];
  callerUserId: string;
  callerRole: WorkspaceRole;
};

export function TeamMembersTable({ members, callerUserId, callerRole }: Props) {
  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-500">Todavía no hay miembros.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">
        Miembros ({members.length})
      </h2>
      <div>
        {members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            callerUserId={callerUserId}
            callerRole={callerRole}
          />
        ))}
      </div>
    </div>
  );
}
