"use client";

import { useActionState, useState } from "react";
import {
  changeMemberRoleAction,
  reactivateMemberAction,
  removeMemberAction,
  suspendMemberAction,
  type TeamMemberActionState,
} from "./actions";
import {
  ROLE_LABELS,
  canManageMember,
  INVITABLE_ROLES,
  type WorkspaceRole,
} from "@/lib/server/permissions";

export type TeamMember = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  status: string;
  invited_by: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  invited: "Invitación pendiente",
  revoked: "Suspendido",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  invited: "bg-amber-50 text-amber-700",
  revoked: "bg-slate-100 text-slate-600",
};

type Props = {
  member: TeamMember;
  callerUserId: string;
  callerRole: WorkspaceRole;
};

export function MemberRow({ member, callerUserId, callerRole }: Props) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const targetRole = member.role as WorkspaceRole;
  const canManage = canManageMember(callerRole, targetRole);
  const isSelf = member.user_id === callerUserId;

  const [roleState, roleAction, rolePending] = useActionState<
    TeamMemberActionState,
    FormData
  >(changeMemberRoleAction.bind(null, member.user_id), {});
  const [suspendState, suspendAction, suspendPending] = useActionState<
    TeamMemberActionState,
    FormData
  >(suspendMemberAction.bind(null, member.user_id), {});
  const [reactivateState, reactivateAction, reactivatePending] =
    useActionState<TeamMemberActionState, FormData>(
      reactivateMemberAction.bind(null, member.user_id),
      {},
    );
  const [removeState, removeAction, removePending] = useActionState<
    TeamMemberActionState,
    FormData
  >(removeMemberAction.bind(null, member.user_id), {});

  const rowMessage =
    roleState.message ??
    suspendState.message ??
    reactivateState.message ??
    removeState.message;

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">
          {member.full_name ?? member.email ?? "Sin nombre"}
          {isSelf && <span className="ml-2 text-xs text-slate-400">(tú)</span>}
        </p>
        {member.full_name && (
          <p className="truncate text-xs text-slate-500">{member.email}</p>
        )}
        <span
          className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[member.status] ?? "bg-slate-100 text-slate-600"}`}
        >
          {STATUS_LABELS[member.status] ?? member.status}
        </span>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {canManage ? (
          <form action={roleAction}>
            <select
              name="role"
              defaultValue={targetRole}
              disabled={rolePending}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50"
              aria-label={`Rol de ${member.email ?? "este miembro"}`}
            >
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-500">
            {ROLE_LABELS[targetRole] ?? member.role}
          </span>
        )}

        {canManage && member.status !== "invited" && (
          <form action={member.status === "revoked" ? reactivateAction : suspendAction}>
            <button
              type="submit"
              disabled={suspendPending || reactivatePending}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 transition-colors"
            >
              {member.status === "revoked" ? "Reactivar" : "Suspender"}
            </button>
          </form>
        )}

        {canManage && !confirmingRemove && (
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
          >
            Remover
          </button>
        )}

        {canManage && confirmingRemove && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">¿Confirmar?</span>
            <form action={removeAction}>
              <button
                type="submit"
                disabled={removePending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
              >
                {removePending ? "Removiendo…" : "Sí, remover"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setConfirmingRemove(false)}
              disabled={removePending}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {rowMessage && (
        <p role="alert" className="basis-full text-xs text-red-600">
          {rowMessage}
        </p>
      )}
    </div>
  );
}
