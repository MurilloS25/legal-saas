import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError, ValidationError } from "@/lib/server/errors";
import type { FortnightSelection } from "../model/fortnight";
import type { NotarialIndexRow } from "../model/notarial-index-row";
import { mapNotarialIndexRows, NOTARIAL_INDEX_SELECT } from "./mappers";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];
export const NOTARIAL_EXPORT_LIMIT = 2000;

export type NotarialExportData = {
  rows: NotarialIndexRow[];
  total: number;
};

export async function listNotarialIndexForExport(
  selection: FortnightSelection,
): Promise<NotarialExportData> {
  const { supabase, user } = await requireUser();
  return queryNotarialIndexForExport(supabase, user.id, selection);
}

export async function queryNotarialIndexForExport(
  supabase: Supabase,
  userId: string,
  selection: FortnightSelection,
): Promise<NotarialExportData> {
  const { data, count, error } = await supabase
    .from("notarial_index_entries")
    .select(NOTARIAL_INDEX_SELECT, { count: "exact" })
    .eq("owner_id", userId)
    .eq("period_year", selection.year)
    .eq("period_month", selection.month)
    .eq("period_half", selection.half)
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
