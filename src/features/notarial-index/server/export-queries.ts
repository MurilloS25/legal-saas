import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError, ValidationError } from "@/lib/server/errors";
import type { NotarialIndexRow } from "../model/notarial-index-row";
import { mapNotarialIndexRows, NOTARIAL_INDEX_SELECT } from "./mappers";
import {
  NOTARIAL_DATE_FILTER_COLUMN,
  notarialDateRangeIso,
  notarialSearchHasNoSafeTerm,
  notarialSearchTerm,
  type NotarialQuery,
} from "../model/query";

type Supabase = Awaited<ReturnType<typeof requireWorkspace>>["supabase"];
export const NOTARIAL_EXPORT_LIMIT = 2000;
const NOTARIAL_EXPORT_PAGE_SIZE = 500;

export type NotarialExportData = {
  rows: NotarialIndexRow[];
  total: number;
};

export async function collectExactExportRows<T>(
  total: number,
  fetchPage: (from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  if (total > NOTARIAL_EXPORT_LIMIT) {
    throw new ValidationError(
      `La quincena supera el límite de ${NOTARIAL_EXPORT_LIMIT} registros.`,
    );
  }

  const rows: T[] = [];
  for (let from = 0; from < total; from += NOTARIAL_EXPORT_PAGE_SIZE) {
    const to = Math.min(from + NOTARIAL_EXPORT_PAGE_SIZE - 1, total - 1);
    const page = await fetchPage(from, to);
    if (page.length !== to - from + 1) {
      throw new ValidationError(
        "No fue posible recuperar todos los registros del Índice. Intenta nuevamente.",
      );
    }
    rows.push(...page);
  }
  return rows;
}

export async function listNotarialIndexForExport(
  query: NotarialQuery,
): Promise<NotarialExportData> {
  const { supabase, workspaceId } = await requireWorkspace();
  return queryNotarialIndexForExport(supabase, workspaceId, query);
}

export async function queryNotarialIndexForExport(
  supabase: Supabase,
  workspaceId: string,
  query: NotarialQuery,
): Promise<NotarialExportData> {
  if (notarialSearchHasNoSafeTerm(query.search)) {
    return { rows: [], total: 0 };
  }

  const { fromIso, toIso } = notarialDateRangeIso(query);
  const term = notarialSearchTerm(query.search);
  // Mismo criterio de período que listNotarialIndex(): effective_index_date
  // (authorized_at si existe, created_at si no) nunca es NULL, así que un
  // .gte()/.lte() directo alcanza — la fila pertenece al export por
  // pertenecer al universo (final + incluida en el Índice), nunca se
  // excluye por is_complete/has_metadata/campo individual NULL. El modal de
  // exportación advierte explícitamente que los datos incompletos se
  // incluyen con campos faltantes.
  let countRequest = supabase
    .from("notarial_index_entries")
    .select("document_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte(NOTARIAL_DATE_FILTER_COLUMN, fromIso)
    .lte(NOTARIAL_DATE_FILTER_COLUMN, toIso);

  if (query.completeness === "complete") {
    countRequest = countRequest.eq("has_metadata", true).eq("is_complete", true);
  } else if (query.completeness === "incomplete") {
    countRequest = countRequest.eq("has_metadata", true).eq("is_complete", false);
  } else if (query.completeness === "missing") {
    countRequest = countRequest.eq("has_metadata", false);
  }
  if (query.actType) countRequest = countRequest.eq("act_name", query.actType);
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
    countRequest = countRequest.or(filters.join(","));
  }

  const { count, error: countError } = await countRequest;
  if (countError) throwDataAccessError("count notarial index export", countError);
  if (count === null) {
    throw new ValidationError(
      "No fue posible determinar cuántos registros contiene el Índice.",
    );
  }

  const rawRows = await collectExactExportRows(count, async (from, to) => {
    let request = supabase
      .from("notarial_index_entries")
      .select(NOTARIAL_INDEX_SELECT)
      .eq("workspace_id", workspaceId)
      .gte(NOTARIAL_DATE_FILTER_COLUMN, fromIso)
      .lte(NOTARIAL_DATE_FILTER_COLUMN, toIso);

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

    const { data, error } = await request
      .order("instrument_number", { ascending: true, nullsFirst: false })
      .order("authorized_at", { ascending: true, nullsFirst: false })
      .order("document_id", { ascending: true })
      .range(from, to);
    if (error) throwDataAccessError("export notarial index page", error);
    return data ?? [];
  });

  return { rows: mapNotarialIndexRows(rawRows), total: count };
}

export async function getLatestNotarialExportAt(): Promise<string | null> {
  const { supabase, workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from("notarial_index_exports")
    .select("created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throwDataAccessError("load latest notarial export", error);
  return data?.created_at ?? null;
}
