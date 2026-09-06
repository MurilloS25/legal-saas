/**
 * Parsing y validación de los parámetros del workspace de Escrituras.
 *
 * Toda la búsqueda/filtro/orden/paginación es server-side; los valores llegan
 * por query string, así que aquí se normalizan con listas blancas y límites.
 * Los valores inválidos se ignoran de forma segura (se cae al default), nunca
 * se interpolan crudos en el orden ni en filtros.
 */

import { DOCUMENT_STATUS_LABEL } from "./status";
import { normalizePage, normalizePageSize, type PageSizeOption } from "@/lib/pagination";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_SEARCH_LENGTH = 100;
export const DOCUMENTS_PAGE_SIZE: PageSizeOption = 10;

export const DOCUMENT_SORT_OPTIONS = [
  { value: "recent", label: "Más recientes", column: "updated_at", ascending: false },
  { value: "oldest", label: "Más antiguas", column: "updated_at", ascending: true },
  { value: "title_az", label: "Título A–Z", column: "title", ascending: true },
  { value: "title_za", label: "Título Z–A", column: "title", ascending: false },
] as const;

export type DocumentSortValue = (typeof DOCUMENT_SORT_OPTIONS)[number]["value"];

const DEFAULT_SORT: DocumentSortValue = "recent";

export type RawDocumentsQuery = {
  search?: string;
  status?: string;
  client?: string;
  template?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
};

export type DocumentsQuery = {
  search: string;
  status: string | null;
  clientId: string | null;
  templateId: string | null;
  sort: DocumentSortValue;
  page: number;
  pageSize: PageSizeOption;
  /** true si algún filtro/búsqueda está activo (para distinguir vacío vs. sin resultados). */
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
  return trimmed in DOCUMENT_STATUS_LABEL ? trimmed : null;
}

function normalizeSort(value: string | undefined): DocumentSortValue {
  const match = DOCUMENT_SORT_OPTIONS.find((option) => option.value === value);
  return match ? match.value : DEFAULT_SORT;
}

export function parseDocumentsQuery(raw: RawDocumentsQuery): DocumentsQuery {
  const search = (raw.search ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
  const status = normalizeStatus(raw.status);
  const clientId = normalizeUuid(raw.client);
  const templateId = normalizeUuid(raw.template);

  return {
    search,
    status,
    clientId,
    templateId,
    sort: normalizeSort(raw.sort),
    page: normalizePage(raw.page),
    pageSize: normalizePageSize(raw.pageSize, DOCUMENTS_PAGE_SIZE),
    hasActiveFilters:
      search !== "" || status !== null || clientId !== null || templateId !== null,
  };
}

export function sortColumnFor(sort: DocumentSortValue): {
  column: string;
  ascending: boolean;
} {
  const option =
    DOCUMENT_SORT_OPTIONS.find((o) => o.value === sort) ??
    DOCUMENT_SORT_OPTIONS[0];
  return { column: option.column, ascending: option.ascending };
}

/**
 * Reduce la búsqueda a caracteres seguros para expresiones PostgREST `.or()`.
 *
 * La búsqueda sigue siendo flexible para texto normal (incluye letras Unicode,
 * números, espacios y guiones), pero descarta puntuación que puede alterar la
 * sintaxis del filtro (`.`, `,`, `(`, `)`, `%`, `_`, comillas, etc.).
 */
export function sanitizeSearchTermForPostgrest(search: string): string {
  return search
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Serializa la query a un objeto de searchParams (omitiendo defaults) para
 * construir URLs compartibles y preservar filtros entre navegaciones.
 */
export function documentsQueryToParams(
  query: Partial<DocumentsQuery>,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.search) params.search = query.search;
  if (query.status) params.status = query.status;
  if (query.clientId) params.client = query.clientId;
  if (query.templateId) params.template = query.templateId;
  if (query.sort && query.sort !== DEFAULT_SORT) params.sort = query.sort;
  if (query.pageSize && query.pageSize !== DOCUMENTS_PAGE_SIZE) {
    params.pageSize = String(query.pageSize);
  }
  if (query.page && query.page > 1) params.page = String(query.page);
  return params;
}
