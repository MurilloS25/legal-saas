/**
 * Estado derivado de una cuenta por cobrar. Nunca se almacena ni se acepta del
 * cliente: la base de datos lo computa en la vista `receivable_entries` con la
 * precedencia paid > overdue > partial > pending.
 */

export const RECEIVABLE_STATUSES = [
  "pending",
  "partial",
  "paid",
  "overdue",
] as const;
export type ReceivableStatus = (typeof RECEIVABLE_STATUSES)[number];

export function isReceivableStatus(value: string): value is ReceivableStatus {
  return (RECEIVABLE_STATUSES as readonly string[]).includes(value);
}

export const RECEIVABLE_STATUS_LABEL: Record<ReceivableStatus, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagada",
  overdue: "Vencida",
};

export function receivableStatusLabel(status: string): string {
  return RECEIVABLE_STATUS_LABEL[status as ReceivableStatus] ?? status;
}

const STATUS_BADGE_CLASS: Record<ReceivableStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  partial: "bg-amber-50 text-amber-800 border border-amber-200",
  paid: "bg-teal-50 text-teal-700 border border-teal-200",
  overdue: "bg-red-50 text-red-700 border border-red-200",
};

export function receivableStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASS[status as ReceivableStatus] ?? "bg-slate-100 text-slate-600";
}

export const RECEIVABLE_CURRENCIES = ["CRC", "USD"] as const;
export type ReceivableCurrency = (typeof RECEIVABLE_CURRENCIES)[number];

/**
 * Formatea un monto decimal (string o número) en la moneda dada, con la
 * convención costarricense: punto como separador de miles y coma decimal
 * (p. ej. `₡1.234.567,89`). Se formatea manualmente para ser determinista
 * (independiente de la versión de ICU del entorno).
 */
export function formatMoney(
  amount: string | number,
  currency: string,
): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return `${amount} ${currency}`;
  const negative = value < 0;
  const [intPart, decPart] = Math.abs(value).toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const symbol = currency === "CRC" ? "₡" : currency === "USD" ? "$" : "";
  return `${negative ? "-" : ""}${symbol}${grouped},${decPart} ${currency}`;
}
