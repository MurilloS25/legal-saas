import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import {
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

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];
export const NOTARIAL_EXPORT_LIMIT = 5000;

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
  if (notarialSearchHasNoSafeTerm(query.search)) return [];

  let request = supabase
    .from("notarial_index_entries")
    .select(NOTARIAL_INDEX_SELECT)
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

  const { data, error } = await request
    .order("authorized_at", {
      ascending: notarialSortAscending(query.sort),
      nullsFirst: false,
    })
    .order("document_id", { ascending: true })
    .range(0, NOTARIAL_EXPORT_LIMIT - 1);

  if (error) throwDataAccessError("export notarial index", error);
  return mapNotarialIndexRows(data ?? []);
}

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
