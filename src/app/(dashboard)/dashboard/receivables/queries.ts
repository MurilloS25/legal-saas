import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { ReceivableStatus } from "@/lib/receivables/status";
import type { ReceivableActivityEvent } from "@/lib/receivables/activity-format";

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

  return (data as ReceivableEntry | null) ?? null;
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
  const row = data as ReceivableRow;
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
  return (data as ReceivableEntry[] | null) ?? [];
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
  return (data as ReceivableEntry[] | null) ?? [];
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
  return (data as ReceivableEntry[] | null) ?? [];
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
  return (data as ClientOption[] | null) ?? [];
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
  return (data as DocumentOption[] | null) ?? [];
}
