import type { Database, Tables } from "@/lib/supabase/database.types";
import { isReceivableStatus } from "../model/status";
import type { ReceivableEntry } from "../model/types";

export const ENTRY_COLUMNS =
  "id, client_id, document_id, concept, currency, amount_total, issued_at, due_at, created_at, updated_at, client_name, document_title, paid_amount, balance_due, status";

export type ReceivableEntryView = Pick<
  Database["public"]["Views"]["receivable_entries"]["Row"],
  | "id"
  | "client_id"
  | "document_id"
  | "concept"
  | "currency"
  | "amount_total"
  | "issued_at"
  | "due_at"
  | "created_at"
  | "updated_at"
  | "client_name"
  | "document_title"
  | "paid_amount"
  | "balance_due"
  | "status"
>;

export type ReceivableTableRow = Pick<
  Tables<"receivables">,
  | "id"
  | "client_id"
  | "document_id"
  | "concept"
  | "currency"
  | "amount_total"
  | "issued_at"
  | "due_at"
  | "notes"
>;

export function mapReceivableEntry(
  row: ReceivableEntryView,
): ReceivableEntry | null {
  if (
    !row.id ||
    !row.client_id ||
    !row.concept ||
    !row.currency ||
    row.amount_total === null ||
    !row.issued_at ||
    !row.created_at ||
    !row.updated_at ||
    !row.client_name ||
    row.paid_amount === null ||
    row.balance_due === null ||
    !row.status ||
    !isReceivableStatus(row.status)
  ) {
    return null;
  }

  return {
    ...row,
    id: row.id,
    client_id: row.client_id,
    concept: row.concept,
    currency: row.currency,
    amount_total: String(row.amount_total),
    issued_at: row.issued_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    client_name: row.client_name,
    paid_amount: String(row.paid_amount),
    balance_due: String(row.balance_due),
    status: row.status,
  };
}

export function mapReceivableEntries(
  rows: ReceivableEntryView[] | null,
): ReceivableEntry[] {
  return (rows ?? [])
    .map(mapReceivableEntry)
    .filter((row): row is ReceivableEntry => row !== null);
}

export function normalizeAmount(value: string | number): string {
  const amount = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(amount) ? amount.toFixed(2) : String(value);
}
