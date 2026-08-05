/**
 * Formateo de eventos de workspace_activity (historial de "Mi equipo") a
 * texto legible. La fuente de verdad es `event_type` + `metadata`; el texto
 * visible se deriva aquí. `target_email` es solo una etiqueta de
 * conveniencia (resuelta en vivo por list_workspace_activity, no un
 * snapshot histórico) — el snapshot real de identidad es
 * `actor_name_snapshot`/`actor_role_snapshot`.
 */

import { ROLE_LABELS, type WorkspaceRole } from "@/lib/server/permissions";

export type WorkspaceActivityEvent = {
  id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name_snapshot: string;
  actor_role_snapshot: string;
  target_email: string | null;
};

function roleLabel(role: unknown): string {
  if (typeof role !== "string") return String(role);
  return ROLE_LABELS[role as WorkspaceRole] ?? role;
}

function str(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function formatWorkspaceActivityEvent(event: WorkspaceActivityEvent): string {
  const meta = event.metadata ?? {};
  const who = event.target_email ?? "un miembro";

  switch (event.event_type) {
    case "member_invited": {
      const role = str(meta, "role");
      return role
        ? `Invitó a ${who} como ${roleLabel(role)}`
        : `Invitó a ${who}`;
    }
    case "member_invitation_accepted":
      return `Aceptó la invitación y se unió al equipo`;
    case "member_role_changed": {
      const prev = str(meta, "previousRole");
      const next = str(meta, "newRole");
      return prev && next
        ? `Cambió el rol de ${who} de ${roleLabel(prev)} a ${roleLabel(next)}`
        : `Cambió el rol de ${who}`;
    }
    case "member_suspended":
      return `Suspendió a ${who}`;
    case "member_reactivated":
      return `Reactivó a ${who}`;
    case "member_removed": {
      const prev = str(meta, "previousRole");
      return prev
        ? `Removió a ${who} (era ${roleLabel(prev)})`
        : `Removió a ${who}`;
    }
    default:
      return "Actividad registrada";
  }
}

/** Fecha y hora legible en español de Costa Rica. */
export function formatWorkspaceActivityTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("es-CR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
