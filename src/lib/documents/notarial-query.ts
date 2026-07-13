/**
 * Parsing y validación de los parámetros del workspace del índice notarial.
 * Todo se filtra server-side; los valores llegan por query string y se
 * normalizan con listas blancas y límites. Reutiliza el saneamiento de
 * búsqueda del workspace de Escrituras.
 */

import { sanitizeSearchTermForPostgrest } from "./workspace-query";
import { costaRicaDayEndIso, costaRicaDayStartIso } from "./notarial-datetime";

export const MAX_SEARCH_LENGTH = 100;
export const NOTARIAL_PAGE_SIZE = 15;

export const NOTARIAL_SORT_OPTIONS = [
  { value: "recent", label: "Más recientes", ascending: false },
  { value: "oldest", label: "Más antiguas", ascending: true },
] as const;

export type NotarialSortValue = (typeof NOTARIAL_SORT_OPTIONS)[number]["value"];
const DEFAULT_SORT: NotarialSortValue = "recent";

export const NOTARIAL_COMPLETENESS_FILTERS = [
  "complete",
  "incomplete",
  "missing",
] as const;
export type NotarialCompletenessFilter =
  (typeof NOTARIAL_COMPLETENESS_FILTERS)[number];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type RawNotarialQuery = {
  search?: string;
  completeness?: string;
  act_type?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: string;
};

export type NotarialQuery = {
  search: string;
  completeness: NotarialCompletenessFilter | null;
  actType: string | null;
  from: string | null;
  to: string | null;
  sort: NotarialSortValue;
  page: number;
  hasActiveFilters: boolean;
};

function normDate(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return DATE_RE.test(trimmed) ? trimmed : null;
}

export function parseNotarialQuery(raw: RawNotarialQuery): NotarialQuery {
  const search = (raw.search ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
  const completeness = (
    NOTARIAL_COMPLETENESS_FILTERS as readonly string[]
  ).includes(raw.completeness ?? "")
    ? (raw.completeness as NotarialCompletenessFilter)
    : null;
  const actType = (raw.act_type ?? "").trim().slice(0, 200) || null;
  const from = normDate(raw.from);
  const to = normDate(raw.to);
  const sort = NOTARIAL_SORT_OPTIONS.some((o) => o.value === raw.sort)
    ? (raw.sort as NotarialSortValue)
    : DEFAULT_SORT;
  const pageNum = Number.parseInt(raw.page ?? "", 10);
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.min(pageNum, 100_000) : 1;

  return {
    search,
    completeness,
    actType,
    from,
    to,
    sort,
    page,
    hasActiveFilters:
      search !== "" ||
      completeness !== null ||
      actType !== null ||
      from !== null ||
      to !== null,
  };
}

/** Término de búsqueda saneado para expresiones PostgREST. */
export function notarialSearchTerm(search: string): string {
  return sanitizeSearchTermForPostgrest(search);
}

/** Rango [desde, hasta] en ISO UTC a partir de las fechas CR (o null). */
export function notarialDateRangeIso(query: NotarialQuery): {
  fromIso: string | null;
  toIso: string | null;
} {
  return {
    fromIso: query.from ? costaRicaDayStartIso(query.from) : null,
    toIso: query.to ? costaRicaDayEndIso(query.to) : null,
  };
}

export function notarialSortAscending(sort: NotarialSortValue): boolean {
  return NOTARIAL_SORT_OPTIONS.find((o) => o.value === sort)?.ascending ?? false;
}

export function notarialQueryToParams(
  query: Partial<NotarialQuery>,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.search) params.search = query.search;
  if (query.completeness) params.completeness = query.completeness;
  if (query.actType) params.act_type = query.actType;
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.sort && query.sort !== DEFAULT_SORT) params.sort = query.sort;
  if (query.page && query.page > 1) params.page = String(query.page);
  return params;
}
