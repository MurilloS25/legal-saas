/**
 * Parsing y validación de los parámetros del workspace de cuentas por cobrar.
 *
 * Todo el filtro/orden/paginación es server-side; los valores llegan por query
 * string y se normalizan con listas blancas y límites. Los valores inválidos
 * se ignoran de forma segura (se cae al default); nunca se interpolan crudos.
 */

import { RECEIVABLE_STATUSES, RECEIVABLE_CURRENCIES } from "./status";
import {
  DEFAULT_PAGE_SIZE,
  normalizePage,
  normalizePageSize,
  type PageSizeOption,
} from "@/lib/pagination";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_SEARCH_LENGTH = 100;
export const RECEIVABLES_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export const RECEIVABLE_SORT_OPTIONS = [
  { value: "recent", label: "Más recientes", column: "created_at", ascending: false },
  { value: "oldest", label: "Más antiguas", column: "created_at", ascending: true },
  { value: "due_soon", label: "Vencen antes", column: "due_at", ascending: true },
  { value: "amount_high", label: "Mayor monto", column: "amount_total", ascending: false },
  { value: "amount_low", label: "Menor monto", column: "amount_total", ascending: true },
] as const;

export type ReceivableSortValue =
  (typeof RECEIVABLE_SORT_OPTIONS)[number]["value"];

const DEFAULT_SORT: ReceivableSortValue = "recent";

export const DOC_PRESENCE_VALUES = ["with", "without"] as const;
export type DocPresence = (typeof DOC_PRESENCE_VALUES)[number];

export type RawReceivablesQuery = {
  search?: string;
  status?: string;
  client?: string;
  document?: string;
  doc?: string;
  currency?: string;
  issued_from?: string;
  issued_to?: string;
  due_from?: string;
  due_to?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
};

export type ReceivablesQuery = {
  search: string;
  status: string | null;
  clientId: string | null;
  documentId: string | null;
  docPresence: DocPresence | null;
  currency: string | null;
  issuedFrom: string | null;
  issuedTo: string | null;
  dueFrom: string | null;
  dueTo: string | null;
  sort: ReceivableSortValue;
  page: number;
  pageSize: PageSizeOption;
  hasActiveFilters: boolean;
};

function normalizeUuid(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

function normalizeStatus(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (RECEIVABLE_STATUSES as readonly string[]).includes(trimmed)
    ? trimmed
    : null;
}

function normalizeCurrency(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (RECEIVABLE_CURRENCIES as readonly string[]).includes(trimmed)
    ? trimmed
    : null;
}

function normalizeDocPresence(value: string | undefined): DocPresence | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (DOC_PRESENCE_VALUES as readonly string[]).includes(trimmed)
    ? (trimmed as DocPresence)
    : null;
}

function normalizeDate(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return DATE_RE.test(trimmed) ? trimmed : null;
}

function normalizeSort(value: string | undefined): ReceivableSortValue {
  const match = RECEIVABLE_SORT_OPTIONS.find((o) => o.value === value);
  return match ? match.value : DEFAULT_SORT;
}

export function parseReceivablesQuery(
  raw: RawReceivablesQuery,
): ReceivablesQuery {
  const search = (raw.search ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
  const status = normalizeStatus(raw.status);
  const clientId = normalizeUuid(raw.client);
  const documentId = normalizeUuid(raw.document);
  const docPresence = normalizeDocPresence(raw.doc);
  const currency = normalizeCurrency(raw.currency);
  const issuedFrom = normalizeDate(raw.issued_from);
  const issuedTo = normalizeDate(raw.issued_to);
  const dueFrom = normalizeDate(raw.due_from);
  const dueTo = normalizeDate(raw.due_to);

  return {
    search,
    status,
    clientId,
    documentId,
    docPresence,
    currency,
    issuedFrom,
    issuedTo,
    dueFrom,
    dueTo,
    sort: normalizeSort(raw.sort),
    page: normalizePage(raw.page),
    pageSize: normalizePageSize(raw.pageSize),
    hasActiveFilters:
      search !== "" ||
      status !== null ||
      clientId !== null ||
      documentId !== null ||
      docPresence !== null ||
      currency !== null ||
      issuedFrom !== null ||
      issuedTo !== null ||
      dueFrom !== null ||
      dueTo !== null,
  };
}

export function sortColumnFor(sort: ReceivableSortValue): {
  column: string;
  ascending: boolean;
} {
  const option =
    RECEIVABLE_SORT_OPTIONS.find((o) => o.value === sort) ??
    RECEIVABLE_SORT_OPTIONS[0];
  return { column: option.column, ascending: option.ascending };
}

/**
 * Reduce la búsqueda a caracteres seguros para expresiones PostgREST `.or()`:
 * conserva letras/números/espacios/guiones y descarta puntuación que altera la
 * sintaxis del filtro (`.`, `,`, `(`, `)`, `%`, `_`, comillas, etc.).
 */
export function sanitizeSearchTermForPostgrest(search: string): string {
  return search
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchHasNoSafeTerm(search: string): boolean {
  return search.trim() !== "" && sanitizeSearchTermForPostgrest(search) === "";
}

export function receivablesQueryToParams(
  query: Partial<ReceivablesQuery>,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.search) params.search = query.search;
  if (query.status) params.status = query.status;
  if (query.clientId) params.client = query.clientId;
  if (query.documentId) params.document = query.documentId;
  if (query.docPresence) params.doc = query.docPresence;
  if (query.currency) params.currency = query.currency;
  if (query.issuedFrom) params.issued_from = query.issuedFrom;
  if (query.issuedTo) params.issued_to = query.issuedTo;
  if (query.dueFrom) params.due_from = query.dueFrom;
  if (query.dueTo) params.due_to = query.dueTo;
  if (query.sort && query.sort !== DEFAULT_SORT) params.sort = query.sort;
  if (query.pageSize && query.pageSize !== RECEIVABLES_PAGE_SIZE) {
    params.pageSize = String(query.pageSize);
  }
  if (query.page && query.page > 1) params.page = String(query.page);
  return params;
}
