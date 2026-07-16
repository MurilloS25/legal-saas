import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError, ValidationError } from "@/lib/server/errors";
import type { NotarialIndexRow } from "../model/notarial-index-row";
import { mapNotarialIndexRows, NOTARIAL_INDEX_SELECT } from "./mappers";
import {
  notarialDateRangeIso,
  notarialSearchHasNoSafeTerm,
  notarialSearchTerm,
  type NotarialQuery,
} from "../model/query";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];
export const NOTARIAL_EXPORT_LIMIT = 2000;

export type NotarialExportData = {
  rows: NotarialIndexRow[];
  total: number;
};

export async function listNotarialIndexForExport(
  query: NotarialQuery,
): Promise<NotarialExportData> {
  const { supabase, user } = await requireUser();
  return queryNotarialIndexForExport(supabase, user.id, query);
}

export async function queryNotarialIndexForExport(
  supabase: Supabase,
  userId: string,
  query: NotarialQuery,
): Promise<NotarialExportData> {
  if (notarialSearchHasNoSafeTerm(query.search)) {
    return { rows: [], total: 0 };
  }

  const { fromIso, toIso } = notarialDateRangeIso(query);
  const term = notarialSearchTerm(query.search);
  let request = supabase
    .from("notarial_index_entries")
    .select(NOTARIAL_INDEX_SELECT, { count: "exact" })
    .eq("owner_id", userId)
    .gte("authorized_at", fromIso)
    .lte("authorized_at", toIso);

  if (query.completeness === "complete") {
    request = request.eq("has_metadata", true).eq("is_complete", true);
  } else if (query.completeness === "incomplete") {
    request = request.eq("has_metadata", true).eq("is_complete", false);
  } else if (query.completeness === "missing") {
    request = request.eq("has_metadata", false);
  }
  if (query.actType) request = request.eq("act_name", query.actType);
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
    request = request.or(filters.join(","));
  }

  const { data, count, error } = await request
    .order("instrument_number", { ascending: true, nullsFirst: false })
    .order("authorized_at", { ascending: true, nullsFirst: false })
    .order("document_id", { ascending: true })
    .range(0, NOTARIAL_EXPORT_LIMIT - 1);

  if (error) throwDataAccessError("export notarial index", error);
  const total = count ?? 0;
  if (total > NOTARIAL_EXPORT_LIMIT) {
    throw new ValidationError(
      `La quincena supera el límite de ${NOTARIAL_EXPORT_LIMIT} registros.`,
    );
  }
  return { rows: mapNotarialIndexRows(data ?? []), total };
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
