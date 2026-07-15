import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import {
  NOTARIAL_PAGE_SIZE,
  notarialDateRangeIso,
  notarialSearchHasNoSafeTerm,
  notarialSearchTerm,
  notarialSortAscending,
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
  const { supabase, user } = await requireUser();

  if (notarialSearchHasNoSafeTerm(query.search)) {
    return { rows: [], total: 0, pageCount: 1 };
  }

  const { fromIso, toIso } = notarialDateRangeIso(query);
  const term = notarialSearchTerm(query.search);
  const ascending = notarialSortAscending(query.sort);

  let countRequest = supabase
    .from("notarial_index_entries")
    .select("document_id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if (query.completeness === "complete") {
    countRequest = countRequest.eq("has_metadata", true).eq("is_complete", true);
  } else if (query.completeness === "incomplete") {
    countRequest = countRequest.eq("has_metadata", true).eq("is_complete", false);
  } else if (query.completeness === "missing") {
    countRequest = countRequest.eq("has_metadata", false);
  }
  if (query.actType) countRequest = countRequest.eq("act_type", query.actType);
  if (fromIso) countRequest = countRequest.gte("authorized_at", fromIso);
  if (toIso) countRequest = countRequest.lte("authorized_at", toIso);
  if (term !== "") {
    const like = `%${term}%`;
    countRequest = countRequest.or(
      [
        `title.ilike.${like}`,
        `instrument_number.ilike.${like}`,
        `act_type.ilike.${like}`,
        `appearing_parties_summary.ilike.${like}`,
        `client_name.ilike.${like}`,
      ].join(","),
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
    .eq("owner_id", user.id);

  if (query.completeness === "complete") {
    request = request.eq("has_metadata", true).eq("is_complete", true);
  } else if (query.completeness === "incomplete") {
    request = request.eq("has_metadata", true).eq("is_complete", false);
  } else if (query.completeness === "missing") {
    request = request.eq("has_metadata", false);
  }
  if (query.actType) request = request.eq("act_type", query.actType);

  if (fromIso) request = request.gte("authorized_at", fromIso);
  if (toIso) request = request.lte("authorized_at", toIso);

  if (term !== "") {
    const like = `%${term}%`;
    request = request.or(
      [
        `title.ilike.${like}`,
        `instrument_number.ilike.${like}`,
        `act_type.ilike.${like}`,
        `appearing_parties_summary.ilike.${like}`,
        `client_name.ilike.${like}`,
      ].join(","),
    );
  }

  const from = (query.page - 1) * NOTARIAL_PAGE_SIZE;

  const { data, error } = await request
    .order("authorized_at", { ascending, nullsFirst: false })
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
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("notarial_index_entries")
    .select("act_type")
    .eq("owner_id", user.id)
    .not("act_type", "is", null);

  if (error) throwDataAccessError("list notarial act types", error);
  const set = new Set<string>();
  for (const row of data ?? []) {
    const value = row.act_type;
    if (value && value.trim() !== "") set.add(value);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}
