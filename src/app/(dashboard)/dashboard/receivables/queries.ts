import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database, Tables } from "@/lib/supabase/database.types";
import {
  isReceivableStatus,
  type ReceivableStatus,
} from "@/lib/receivables/status";
import type { ReceivableActivityEvent } from "@/lib/receivables/activity-format";
import {
  RECEIVABLES_PAGE_SIZE,
  searchHasNoSafeTerm,
  sanitizeSearchTermForPostgrest,
  sortColumnFor,
  type ReceivablesQuery,
} from "@/lib/receivables/workspace-query";

/**
 * Lecturas de cuentas por cobrar. Todas parten de la vista
 * `receivable_entries`, que deriva saldo y estado; el estado nunca se lee de
 * la tabla base. La RLS (owner) se aplica por `security_invoker` en la vista.
 */

// Columnas seleccionadas de la vista. El estado y el saldo son derivados.
const ENTRY_COLUMNS =
  "id, client_id, document_id, concept, currency, amount_total, issued_at, due_at, created_at, updated_at, client_name, document_title, paid_amount, balance_due, status";

export type ReceivableEntry = {
  id: string;
  client_id: string;
  document_id: string | null;
  concept: string;
  currency: string;
  amount_total: string;
  issued_at: string;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  client_name: string;
  document_title: string | null;
  paid_amount: string;
  balance_due: string;
  status: ReceivableStatus;
};

type ReceivableEntryView = Pick<
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

function mapReceivableEntry(
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

function mapReceivableEntries(
  rows: ReceivableEntryView[] | null,
): ReceivableEntry[] {
  return (rows ?? [])
    .map(mapReceivableEntry)
    .filter((row): row is ReceivableEntry => row !== null);
}

/** Cuenta por cobrar en su forma editable (tabla base, sin derivados). */
export type ReceivableRow = {
  id: string;
  client_id: string;
  document_id: string | null;
  concept: string;
  currency: string;
  amount_total: string;
  issued_at: string;
  due_at: string | null;
  notes: string | null;
};

type ReceivableTableRow = Pick<
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

export async function getReceivableEntry(
  id: string,
): Promise<ReceivableEntry | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("receivable_entries")
    .select(ENTRY_COLUMNS)
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  return data ? mapReceivableEntry(data) : null;
}

/** Forma editable, para precargar el formulario (incluye notas internas). */
export async function getReceivableForEdit(
  id: string,
): Promise<ReceivableRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("receivables")
    .select(
      "id, client_id, document_id, concept, currency, amount_total, issued_at, due_at, notes",
    )
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!data) return null;
  const row: ReceivableTableRow = data;
  // El monto puede llegar como número o string según el driver; se normaliza
  // a una cadena con dos decimales para que el formulario sea determinista.
  return { ...row, amount_total: normalizeAmount(row.amount_total) };
}

function normalizeAmount(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n.toFixed(2) : String(value);
}

/** Todas las cuentas del usuario, más reciente primero (listado base). */
export async function listReceivables(): Promise<ReceivableEntry[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("receivable_entries")
    .select(ENTRY_COLUMNS)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];
  return mapReceivableEntries(data);
}

// --------------------------------------------------------------- workspace

export type CurrencyTotal = {
  currency: string;
  count: number;
  total: string;
  paid: string;
  balance: string;
};

export type ReceivablesWorkspacePage = {
  rows: ReceivableEntry[];
  totalCount: number;
  page: number;
  pageCount: number;
  totals: CurrencyTotal[];
};

/**
 * Listado paginado del workspace con filtros server-side y totales por moneda
 * sobre TODOS los resultados filtrados (vía la función receivables_summary).
 */
export async function listReceivablesWorkspace(
  query: ReceivablesQuery,
): Promise<ReceivablesWorkspacePage> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { column, ascending } = sortColumnFor(query.sort);
  const term = sanitizeSearchTermForPostgrest(query.search);

  if (searchHasNoSafeTerm(query.search)) {
    return {
      rows: [],
      totalCount: 0,
      page: query.page,
      pageCount: 1,
      totals: [],
    };
  }

  let countBuilder = supabase
    .from("receivable_entries")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if (query.status) countBuilder = countBuilder.eq("status", query.status);
  if (query.clientId) countBuilder = countBuilder.eq("client_id", query.clientId);
  if (query.documentId) countBuilder = countBuilder.eq("document_id", query.documentId);
  if (query.currency) countBuilder = countBuilder.eq("currency", query.currency);
  if (query.docPresence === "with") {
    countBuilder = countBuilder.not("document_id", "is", null);
  } else if (query.docPresence === "without") {
    countBuilder = countBuilder.is("document_id", null);
  }
  if (query.issuedFrom) countBuilder = countBuilder.gte("issued_at", query.issuedFrom);
  if (query.issuedTo) countBuilder = countBuilder.lte("issued_at", query.issuedTo);
  if (query.dueFrom) countBuilder = countBuilder.gte("due_at", query.dueFrom);
  if (query.dueTo) countBuilder = countBuilder.lte("due_at", query.dueTo);

  if (term) {
    countBuilder = countBuilder.or(
      `concept.ilike.%${term}%,client_name.ilike.%${term}%,document_title.ilike.%${term}%`,
    );
  }

  const { count, error: countError } = await countBuilder;
  if (countError) {
    return {
      rows: [],
      totalCount: 0,
      page: query.page,
      pageCount: 1,
      totals: [],
    };
  }

  const totalCount = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / RECEIVABLES_PAGE_SIZE));
  const totals = await getReceivablesSummary(query);

  if (totalCount > 0 && query.page > pageCount) {
    return { rows: [], totalCount, page: query.page, pageCount, totals };
  }

  const from = (query.page - 1) * RECEIVABLES_PAGE_SIZE;
  const to = from + RECEIVABLES_PAGE_SIZE - 1;

  let builder = supabase
    .from("receivable_entries")
    .select(ENTRY_COLUMNS)
    .eq("owner_id", user.id);

  if (query.status) builder = builder.eq("status", query.status);
  if (query.clientId) builder = builder.eq("client_id", query.clientId);
  if (query.documentId) builder = builder.eq("document_id", query.documentId);
  if (query.currency) builder = builder.eq("currency", query.currency);
  if (query.docPresence === "with") {
    builder = builder.not("document_id", "is", null);
  } else if (query.docPresence === "without") {
    builder = builder.is("document_id", null);
  }
  if (query.issuedFrom) builder = builder.gte("issued_at", query.issuedFrom);
  if (query.issuedTo) builder = builder.lte("issued_at", query.issuedTo);
  if (query.dueFrom) builder = builder.gte("due_at", query.dueFrom);
  if (query.dueTo) builder = builder.lte("due_at", query.dueTo);
  if (term) {
    builder = builder.or(
      `concept.ilike.%${term}%,client_name.ilike.%${term}%,document_title.ilike.%${term}%`,
    );
  }

  // Orden estable: columna elegida + id como desempate determinista.
  const { data } = await builder
    .order(column, { ascending, nullsFirst: false })
    .order("id", { ascending: true })
    .range(from, to);

  const rows = mapReceivableEntries(data);

  return { rows, totalCount, page: query.page, pageCount, totals };
}

/** Totales por moneda (sobre todos los resultados filtrados). */
export async function getReceivablesSummary(
  query: ReceivablesQuery,
): Promise<CurrencyTotal[]> {
  const supabase = await createClient();
  const term = sanitizeSearchTermForPostgrest(query.search);

  if (searchHasNoSafeTerm(query.search)) return [];

  const { data, error } = await supabase.rpc("receivables_summary", {
    ...(term ? { p_search: term } : {}),
    ...(query.status ? { p_status: query.status } : {}),
    ...(query.clientId ? { p_client: query.clientId } : {}),
    ...(query.documentId ? { p_document: query.documentId } : {}),
    ...(query.docPresence ? { p_doc_presence: query.docPresence } : {}),
    ...(query.currency ? { p_currency: query.currency } : {}),
    ...(query.issuedFrom ? { p_issued_from: query.issuedFrom } : {}),
    ...(query.issuedTo ? { p_issued_to: query.issuedTo } : {}),
    ...(query.dueFrom ? { p_due_from: query.dueFrom } : {}),
    ...(query.dueTo ? { p_due_to: query.dueTo } : {}),
  });

  if (error || !data) return [];
  return data.map((r) => ({
      currency: r.currency,
      count: Number(r.count),
      total: String(r.total),
      paid: String(r.paid),
      balance: String(r.balance),
    }));
}

export async function listReceivablesByClient(
  clientId: string,
): Promise<ReceivableEntry[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("receivable_entries")
    .select(ENTRY_COLUMNS)
    .eq("owner_id", user.id)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return mapReceivableEntries(data);
}

export async function listReceivablesByDocument(
  documentId: string,
): Promise<ReceivableEntry[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("receivable_entries")
    .select(ENTRY_COLUMNS)
    .eq("owner_id", user.id)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return mapReceivableEntries(data);
}

// ----------------------------------------------------------------- payments

export type ReceivablePayment = {
  id: string;
  amount: string;
  currency: string;
  paid_at: string;
  method: string;
  reference: string | null;
  status: string;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
};

/** Pagos de una cuenta, más reciente primero (incluye anulados). */
export async function listPaymentsByReceivable(
  receivableId: string,
): Promise<ReceivablePayment[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("receivable_payments")
    .select(
      "id, amount, currency, paid_at, method, reference, status, voided_at, void_reason, created_at",
    )
    .eq("receivable_id", receivableId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((payment) => ({
    ...payment,
    amount: String(payment.amount),
  }));
}

// ----------------------------------------------------------------- activity

const ACTIVITY_LIMIT = 50;

/**
 * Historial de una cuenta por cobrar, más reciente primero. La RLS restringe
 * a la actividad propia; el `receivable_id` acota a la cuenta.
 */
export async function listReceivableActivity(
  receivableId: string,
): Promise<ReceivableActivityEvent[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("receivable_activity")
    .select("id, event_type, metadata, created_at, actor_user_id")
    .eq("receivable_id", receivableId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(ACTIVITY_LIMIT);

  if (error) return [];
  return (data as ReceivableActivityEvent[] | null) ?? [];
}

// ------------------------------------------------------------- form options

export type ClientOption = { id: string; full_name: string };
export type DocumentOption = { id: string; title: string; client_id: string | null };

/** Clientes del usuario, para el selector del formulario. */
export async function listClientOptions(): Promise<ClientOption[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("owner_id", user.id)
    .order("full_name", { ascending: true });

  if (error) return [];
  return data ?? [];
}

/** Escrituras del usuario, para el selector opcional del formulario. */
export async function listDocumentOptions(): Promise<DocumentOption[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, client_id")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return [];
  return data ?? [];
}
