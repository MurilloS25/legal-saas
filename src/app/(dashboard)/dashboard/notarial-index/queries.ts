import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  NOTARIAL_PAGE_SIZE,
  notarialDateRangeIso,
  notarialSearchHasNoSafeTerm,
  notarialSearchTerm,
  notarialSortAscending,
  type NotarialQuery,
} from "@/lib/documents/notarial-query";

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

/** Página del índice: Escrituras finalizadas con su metadata, filtradas. */
export async function listNotarialIndex(
  query: NotarialQuery,
): Promise<NotarialIndexPage> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (notarialSearchHasNoSafeTerm(query.search)) {
    return { rows: [], total: 0, pageCount: 1 };
  }

  let request = supabase
    .from("notarial_index_entries")
    .select(SELECT, { count: "exact" })
    .eq("owner_id", user.id);

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
  const from = (query.page - 1) * NOTARIAL_PAGE_SIZE;

  const { data, count, error } = await request
    .order("authorized_at", { ascending, nullsFirst: false })
    .order("document_id", { ascending: true })
    .range(from, from + NOTARIAL_PAGE_SIZE - 1);

  if (error) return { rows: [], total: 0, pageCount: 0 };

  const total = count ?? 0;
  return {
    rows: (data ?? []) as unknown as NotarialIndexRow[],
    total,
    pageCount: Math.max(1, Math.ceil(total / NOTARIAL_PAGE_SIZE)),
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (notarialSearchHasNoSafeTerm(query.search)) {
    return [];
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

  if (error) return [];
  return (data ?? []) as unknown as NotarialIndexRow[];
}

/** Fecha de la última exportación del usuario, o null. */
export async function getLatestNotarialExportAt(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("notarial_index_exports")
    .select("created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as { created_at: string } | null)?.created_at ?? null;
}

/** Tipos de acto distintos del usuario, para el filtro. */
export async function listNotarialActTypes(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("notarial_index_entries")
    .select("act_type")
    .eq("owner_id", user.id)
    .not("act_type", "is", null);

  if (error) return [];
  const set = new Set<string>();
  for (const row of data ?? []) {
    const value = (row as { act_type: string | null }).act_type;
    if (value && value.trim() !== "") set.add(value);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}
