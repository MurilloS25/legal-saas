import {
  currentCostaRicaFortnight,
  fortnightRange,
  parseFortnightSelection,
  type FortnightSelection,
} from "./fortnight";

export const MAX_SEARCH_LENGTH = 100;
export const NOTARIAL_PAGE_SIZE = 15;

export const NOTARIAL_COMPLETENESS_FILTERS = [
  "complete",
  "incomplete",
  "missing",
] as const;
export type NotarialCompletenessFilter =
  (typeof NOTARIAL_COMPLETENESS_FILTERS)[number];

export type RawNotarialQuery = {
  search?: string;
  completeness?: string;
  act_type?: string;
  year?: string;
  month?: string;
  half?: string;
  page?: string;
};

export type NotarialQuery = {
  search: string;
  completeness: NotarialCompletenessFilter | null;
  actType: string | null;
  selection: FortnightSelection;
  page: number;
  hasActiveFilters: boolean;
};

function sanitizeSearchTermForPostgrest(search: string): string {
  return search
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseNotarialQuery(
  raw: RawNotarialQuery,
  now: Date = new Date(),
): NotarialQuery {
  const search = (raw.search ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
  const completeness = (
    NOTARIAL_COMPLETENESS_FILTERS as readonly string[]
  ).includes(raw.completeness ?? "")
    ? (raw.completeness as NotarialCompletenessFilter)
    : null;
  const actType = (raw.act_type ?? "").trim().slice(0, 200) || null;
  const selection =
    parseFortnightSelection(raw) ?? currentCostaRicaFortnight(now);
  const pageNum = Number.parseInt(raw.page ?? "", 10);
  const page =
    Number.isFinite(pageNum) && pageNum >= 1
      ? Math.min(pageNum, 100_000)
      : 1;

  return {
    search,
    completeness,
    actType,
    selection,
    page,
    hasActiveFilters:
      search !== "" || completeness !== null || actType !== null,
  };
}

export function notarialSearchTerm(search: string): string {
  return sanitizeSearchTermForPostgrest(search);
}

export function notarialSearchHasNoSafeTerm(search: string): boolean {
  return search.trim() !== "" && notarialSearchTerm(search) === "";
}

export function notarialDateRangeIso(query: NotarialQuery): {
  fromIso: string;
  toIso: string;
} {
  return fortnightRange(
    query.selection.year,
    query.selection.month,
    query.selection.half,
  );
}

export function notarialQueryToParams(
  query: Partial<NotarialQuery> & { selection?: FortnightSelection },
): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.selection) {
    params.year = String(query.selection.year);
    params.month = String(query.selection.month);
    params.half = query.selection.half;
  }
  if (query.search) params.search = query.search;
  if (query.completeness) params.completeness = query.completeness;
  if (query.actType) params.act_type = query.actType;
  if (query.page && query.page > 1) params.page = String(query.page);
  return params;
}
