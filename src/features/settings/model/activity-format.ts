/**
 * Formateo de eventos de workspace_activity (historial de "Mi equipo") a
 * texto legible. La fuente de verdad es `event_type` + `metadata`; el texto
 * visible se deriva aquí. `target_email` es solo una etiqueta de
 * conveniencia (resuelta en vivo por list_workspace_activity, no un
 * snapshot histórico) — el snapshot real de identidad es
 * `actor_name_snapshot`/`actor_role_snapshot`.
 */

import { ROLE_LABELS, type WorkspaceRole } from "@/lib/server/permissions";
import type { WorkspaceActivityEvent } from "./types";

export type { WorkspaceActivityEvent } from "./types";

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

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/**
 * Fecha y hora legible en español de Costa Rica, formateada a mano en vez
 * de con `Intl.toLocaleString("es-CR", ...)`: el separador que usa esa API
 * para `es-CR` difiere entre el ICU de Node (SSR) y el de Chromium
 * (hidratación) — "…, 04:21 p. m." vs "…a las 04:21 p. m." — lo que
 * provocaba un mismatch de hidratación real en cuanto este componente pasó
 * a hidratarse (antes se renderizaba solo en servidor). Un formateo
 * determinista evita depender de esa diferencia de versión de ICU.
 */
export function formatWorkspaceActivityTimestamp(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTHS_ES[date.getMonth()];
  const year = date.getFullYear();
  const hours24 = date.getHours();
  const period = hours24 < 12 ? "a. m." : "p. m.";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} de ${month} de ${year}, ${hours12}:${minutes} ${period}`;
}
