import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { Database } from "@/lib/supabase/database.types";
import {
  NOTARIAL_PAGE_SIZE,
  notarialDateRangeIso,
  notarialSearchHasNoSafeTerm,
  notarialSearchTerm,
  notarialSortAscending,
  type NotarialQuery,
} from "../model/notarial-query";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

export type NotarialIndexRow = {
  document_id: string;
  title: string;
  client_name: string | null;
  instrument_number: string | null;
  authorized_at: string | null;
  act_type: string | null;
  book_reference: string | null;
  folio_reference: string | null;
  appearing_parties_summary: string | null;
  has_metadata: boolean;
  is_complete: boolean;
};

export type NotarialIndexPage = {
  rows: NotarialIndexRow[];
  total: number;
  pageCount: number;
};

const SELECT =
  "document_id, title, client_name, instrument_number, authorized_at, act_type, book_reference, folio_reference, appearing_parties_summary, has_metadata, is_complete";

type NotarialIndexViewRow = Pick<
  Database["public"]["Views"]["notarial_index_entries"]["Row"],
  | "document_id"
  | "title"
  | "client_name"
  | "instrument_number"
  | "authorized_at"
  | "act_type"
  | "book_reference"
  | "folio_reference"
  | "appearing_parties_summary"
  | "has_metadata"
  | "is_complete"
>;

function mapNotarialIndexRows(
  rows: NotarialIndexViewRow[],
): NotarialIndexRow[] {
  return rows.map((row) => {
    if (
      !row.document_id ||
      !row.title ||
      row.has_metadata === null ||
      row.is_complete === null
    ) {
      throwDataAccessError("map notarial index row", { code: "invalid_view_row" });
    }

    return {
      document_id: row.document_id,
      title: row.title,
      client_name: row.client_name,
      instrument_number: row.instrument_number,
      authorized_at: row.authorized_at,
      act_type: row.act_type,
      book_reference: row.book_reference,
      folio_reference: row.folio_reference,
      appearing_parties_summary: row.appearing_parties_summary,
      has_metadata: row.has_metadata,
      is_complete: row.is_complete,
    };
  });
}

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
    .select(SELECT)
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

export const NOTARIAL_EXPORT_LIMIT = 5000;

/**
 * Todas las filas que coinciden con el filtro (hasta un límite), para la
 * exportación CSV. Respeta los mismos filtros y orden que el workspace.
 */
export async function listNotarialIndexForExport(
  query: NotarialQuery,
): Promise<NotarialIndexRow[]> {
  const { supabase, user } = await requireUser();

  return queryNotarialIndexForExport(supabase, user.id, query);
}

export async function queryNotarialIndexForExport(
  supabase: Supabase,
  userId: string,
  query: NotarialQuery,
): Promise<NotarialIndexRow[]> {

  if (notarialSearchHasNoSafeTerm(query.search)) {
    return [];
  }

  let request = supabase
    .from("notarial_index_entries")
    .select(SELECT)
    .eq("owner_id", userId);

  if (query.completeness === "complete") {
    request = request.eq("has_metadata", true).eq("is_complete", true);
  } else if (query.completeness === "incomplete") {
    request = request.eq("has_metadata", true).eq("is_complete", false);
  } else if (query.completeness === "missing") {
    request = request.eq("has_metadata", false);
  }
  if (query.actType) request = request.eq("act_type", query.actType);

  const { fromIso, toIso } = notarialDateRangeIso(query);
  if (fromIso) request = request.gte("authorized_at", fromIso);
  if (toIso) request = request.lte("authorized_at", toIso);

  const term = notarialSearchTerm(query.search);
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

  const ascending = notarialSortAscending(query.sort);
  const { data, error } = await request
    .order("authorized_at", { ascending, nullsFirst: false })
    .order("document_id", { ascending: true })
    .range(0, NOTARIAL_EXPORT_LIMIT - 1);

  if (error) throwDataAccessError("export notarial index", error);
  return mapNotarialIndexRows(data ?? []);
}

/** Fecha de la última exportación del usuario, o null. */
export async function getLatestNotarialExportAt(): Promise<string | null> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("notarial_index_exports")
    .select("created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throwDataAccessError("load latest notarial export", error);
  return data?.created_at ?? null;
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
