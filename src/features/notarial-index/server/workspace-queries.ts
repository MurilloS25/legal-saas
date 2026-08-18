import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import {
  NOTARIAL_DATE_FILTER_COLUMN,
  NOTARIAL_PAGE_SIZE,
  notarialDateRangeIso,
  notarialSearchHasNoSafeTerm,
  notarialSearchTerm,
  type NotarialQuery,
} from "../model/query";

import {
  mapNotarialIndexRows,
  NOTARIAL_INDEX_SELECT,
} from "./mappers";
import type { NotarialIndexRow } from "../model/notarial-index-row";

export type NotarialIndexPage = {
  rows: NotarialIndexRow[];
  total: number;
  pageCount: number;
};

/** Página del índice: Escrituras finalizadas con su metadata, filtradas. */
export async function listNotarialIndex(
  query: NotarialQuery,
): Promise<NotarialIndexPage> {
  const { supabase, workspaceId } = await requireWorkspace();

  if (notarialSearchHasNoSafeTerm(query.search)) {
    return { rows: [], total: 0, pageCount: 1 };
  }

  const { fromIso, toIso } = notarialDateRangeIso(query);
  const term = notarialSearchTerm(query.search);

  let countRequest = supabase
    .from("notarial_index_entries")
    .select("document_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (query.completeness === "complete") {
    countRequest = countRequest.eq("has_metadata", true).eq("is_complete", true);
  } else if (query.completeness === "incomplete") {
    countRequest = countRequest.eq("has_metadata", true).eq("is_complete", false);
  } else if (query.completeness === "missing") {
    countRequest = countRequest.eq("has_metadata", false);
  }
  if (query.actType) countRequest = countRequest.eq("act_name", query.actType);
  countRequest = countRequest
    .gte(NOTARIAL_DATE_FILTER_COLUMN, fromIso)
    .lte(NOTARIAL_DATE_FILTER_COLUMN, toIso);
  if (term !== "") {
    const like = `%${term}%`;
    const filters = [
      `title.ilike.${like}`,
      `act_name.ilike.${like}`,
      `parties.ilike.${like}`,
      `client_name.ilike.${like}`,
    ];
    if (/^[1-9][0-9]*$/.test(term)) {
      filters.push(`instrument_number.eq.${Number(term)}`);
    }
    countRequest = countRequest.or(
      filters.join(","),
    );
  }

  const { count, error: countError } = await countRequest;
  if (countError) throwDataAccessError("count notarial index", countError);

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / NOTARIAL_PAGE_SIZE));
  if (total > 0 && query.page > pageCount) {
    return { rows: [], total, pageCount };
  }

  let request = supabase
    .from("notarial_index_entries")
    .select(NOTARIAL_INDEX_SELECT)
    .eq("workspace_id", workspaceId);

  if (query.completeness === "complete") {
    request = request.eq("has_metadata", true).eq("is_complete", true);
  } else if (query.completeness === "incomplete") {
    request = request.eq("has_metadata", true).eq("is_complete", false);
  } else if (query.completeness === "missing") {
    request = request.eq("has_metadata", false);
  }
  if (query.actType) request = request.eq("act_name", query.actType);

  request = request
    .gte(NOTARIAL_DATE_FILTER_COLUMN, fromIso)
    .lte(NOTARIAL_DATE_FILTER_COLUMN, toIso);

  if (term !== "") {
    const like = `%${term}%`;
    const filters = [
      `title.ilike.${like}`,
      `act_name.ilike.${like}`,
      `parties.ilike.${like}`,
      `client_name.ilike.${like}`,
    ];
    if (/^[1-9][0-9]*$/.test(term)) {
      filters.push(`instrument_number.eq.${Number(term)}`);
    }
    request = request.or(
      filters.join(","),
    );
  }

  const from = (query.page - 1) * NOTARIAL_PAGE_SIZE;

  const { data, error } = await request
    .order("instrument_number", { ascending: true, nullsFirst: false })
    .order("authorized_at", { ascending: true, nullsFirst: false })
    .order("document_id", { ascending: true })
    .range(from, from + NOTARIAL_PAGE_SIZE - 1);

  if (error) throwDataAccessError("list notarial index", error);

  return {
    rows: mapNotarialIndexRows(data ?? []),
    total,
    pageCount,
  };
}

/** Tipos de acto distintos del usuario, para el filtro. */
export async function listNotarialActTypes(): Promise<string[]> {
  const { supabase, workspaceId } = await requireWorkspace();

  const { data, error } = await supabase
    .from("notarial_index_entries")
    .select("act_name")
    .eq("workspace_id", workspaceId)
    .not("act_name", "is", null);

  if (error) throwDataAccessError("list notarial act types", error);
  const set = new Set<string>();
  for (const row of data ?? []) {
    const value = row.act_name;
    if (value && value.trim() !== "") set.add(value);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}
