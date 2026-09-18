import type { ReceivableEntry } from "@/features/receivables";

export function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function todayLabel(now: Date): string {
  const label = now.toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function relativeTime(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
  });
}

export function daysUntil(iso: string, now: Date): number {
  const due = new Date(`${iso}T00:00:00`);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - start.getTime()) / 86_400_000);
}

export function plural(
  count: number,
  singular: string,
  pluralForm: string,
): string {
  return count === 1 ? singular : pluralForm;
}

export function selectAttentionReceivables(
  receivables: ReceivableEntry[],
  now: Date,
): ReceivableEntry[] {
  return receivables
    .filter(
      (receivable) =>
        receivable.status === "overdue" ||
        (receivable.due_at !== null &&
          daysUntil(receivable.due_at, now) <= 7 &&
          receivable.status !== "paid"),
    )
    .sort((a, b) => {
      const aDays = a.due_at ? daysUntil(a.due_at, now) : 999;
      const bDays = b.due_at ? daysUntil(b.due_at, now) : 999;
      return aDays - bDays;
    })
    .slice(0, 5);
}
