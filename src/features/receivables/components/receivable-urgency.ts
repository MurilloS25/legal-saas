import type { ReceivableEntry } from "../model/types";

/**
 * Agrupación puramente visual/de presentación de la lista de cuentas por
 * cobrar. NO reinterpreta ni recalcula `status` — ese campo ya viene
 * derivado por la vista `receivable_entries` con precedencia
 * paid > overdue > partial > pending (ver `model/status.ts`). Esta función
 * solo decide, dentro de las filas ya cargadas para la página actual, en qué
 * grupo visual cae cada una, para poder mostrar "vencidas" antes que
 * "próximas a vencer" antes que "al día", en vez de una sola tabla plana
 * ordenada solo por fecha.
 */

export type UrgencyGroup = "overdue" | "due_soon" | "rest";

const DUE_SOON_WINDOW_DAYS = 7;

function daysUntilDue(dueAt: string): number {
  const due = new Date(`${dueAt}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function classifyReceivableUrgency(
  row: Pick<ReceivableEntry, "status" | "due_at">,
): UrgencyGroup {
  if (row.status === "overdue") return "overdue";
  if (row.status !== "paid" && row.due_at) {
    const days = daysUntilDue(row.due_at);
    if (days >= 0 && days <= DUE_SOON_WINDOW_DAYS) return "due_soon";
  }
  return "rest";
}

export const URGENCY_GROUP_ORDER: readonly UrgencyGroup[] = [
  "overdue",
  "due_soon",
  "rest",
];

export const URGENCY_GROUP_META: Record<
  UrgencyGroup,
  { label: string; dotClass: string; headerClass: string; textClass: string }
> = {
  overdue: {
    label: "Vencidas",
    dotClass: "bg-red-500",
    headerClass: "bg-red-50/70",
    textClass: "text-red-700",
  },
  due_soon: {
    label: "Próximas a vencer",
    dotClass: "bg-amber-500",
    headerClass: "bg-amber-50/70",
    textClass: "text-amber-800",
  },
  rest: {
    label: "Al día",
    dotClass: "bg-slate-300",
    headerClass: "bg-slate-50/60",
    textClass: "text-slate-500",
  },
};
