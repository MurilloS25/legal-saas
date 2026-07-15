import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import {
  RECEIVABLES_PAGE_SIZE,
  searchHasNoSafeTerm,
  sanitizeSearchTermForPostgrest,
  sortColumnFor,
  type ReceivablesQuery,
} from "../model/workspace-query";
import type {
  CurrencyTotal,
  ReceivableEntry,
  ReceivablesWorkspacePage,
} from "../model/types";
import { ENTRY_COLUMNS, mapReceivableEntries } from "./mappers";

export async function listReceivables(): Promise<ReceivableEntry[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("receivable_entries")
    .select(ENTRY_COLUMNS)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throwDataAccessError("list receivables", error);
  return mapReceivableEntries(data);
}

export async function listReceivablesWorkspace(
  query: ReceivablesQuery,
): Promise<ReceivablesWorkspacePage> {
  const { supabase, user } = await requireUser();
  const { column, ascending } = sortColumnFor(query.sort);
  const term = sanitizeSearchTermForPostgrest(query.search);

  if (searchHasNoSafeTerm(query.search)) {
    return { rows: [], totalCount: 0, page: query.page, pageCount: 1, totals: [] };
  }

  let countBuilder = supabase
    .from("receivable_entries")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if (query.status) countBuilder = countBuilder.eq("status", query.status);
  if (query.clientId) countBuilder = countBuilder.eq("client_id", query.clientId);
  if (query.documentId) countBuilder = countBuilder.eq("document_id", query.documentId);
  if (query.currency) countBuilder = countBuilder.eq("currency", query.currency);
  if (query.docPresence === "with") countBuilder = countBuilder.not("document_id", "is", null);
  if (query.docPresence === "without") countBuilder = countBuilder.is("document_id", null);
  if (query.issuedFrom) countBuilder = countBuilder.gte("issued_at", query.issuedFrom);
  if (query.issuedTo) countBuilder = countBuilder.lte("issued_at", query.issuedTo);
  if (query.dueFrom) countBuilder = countBuilder.gte("due_at", query.dueFrom);
  if (query.dueTo) countBuilder = countBuilder.lte("due_at", query.dueTo);
  if (term) {
    countBuilder = countBuilder.or(
      `concept.ilike.%${term}%,client_name.ilike.%${term}%,document_title.ilike.%${term}%`,
    );
  }

  const { count, error: countError } = await countBuilder;
  if (countError) throwDataAccessError("count receivables workspace", countError);

  const totalCount = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / RECEIVABLES_PAGE_SIZE));
  const totals = await getReceivablesSummary(query);
  if (totalCount > 0 && query.page > pageCount) {
    return { rows: [], totalCount, page: query.page, pageCount, totals };
  }

  const from = (query.page - 1) * RECEIVABLES_PAGE_SIZE;
  const to = from + RECEIVABLES_PAGE_SIZE - 1;
  let builder = supabase
    .from("receivable_entries")
    .select(ENTRY_COLUMNS)
    .eq("owner_id", user.id);

  if (query.status) builder = builder.eq("status", query.status);
  if (query.clientId) builder = builder.eq("client_id", query.clientId);
  if (query.documentId) builder = builder.eq("document_id", query.documentId);
  if (query.currency) builder = builder.eq("currency", query.currency);
  if (query.docPresence === "with") builder = builder.not("document_id", "is", null);
  if (query.docPresence === "without") builder = builder.is("document_id", null);
  if (query.issuedFrom) builder = builder.gte("issued_at", query.issuedFrom);
  if (query.issuedTo) builder = builder.lte("issued_at", query.issuedTo);
  if (query.dueFrom) builder = builder.gte("due_at", query.dueFrom);
  if (query.dueTo) builder = builder.lte("due_at", query.dueTo);
  if (term) {
    builder = builder.or(
      `concept.ilike.%${term}%,client_name.ilike.%${term}%,document_title.ilike.%${term}%`,
    );
  }

  const { data, error } = await builder
    .order(column, { ascending, nullsFirst: false })
    .order("id", { ascending: true })
    .range(from, to);

  if (error) throwDataAccessError("list receivables workspace", error);
  return {
    rows: mapReceivableEntries(data),
    totalCount,
    page: query.page,
    pageCount,
    totals,
  };
}

export async function getReceivablesSummary(
  query: ReceivablesQuery,
): Promise<CurrencyTotal[]> {
  const { supabase } = await requireUser();
  const term = sanitizeSearchTermForPostgrest(query.search);
  if (searchHasNoSafeTerm(query.search)) return [];

  const { data, error } = await supabase.rpc("receivables_summary", {
    ...(term ? { p_search: term } : {}),
    ...(query.status ? { p_status: query.status } : {}),
    ...(query.clientId ? { p_client: query.clientId } : {}),
    ...(query.documentId ? { p_document: query.documentId } : {}),
    ...(query.docPresence ? { p_doc_presence: query.docPresence } : {}),
    ...(query.currency ? { p_currency: query.currency } : {}),
    ...(query.issuedFrom ? { p_issued_from: query.issuedFrom } : {}),
    ...(query.issuedTo ? { p_issued_to: query.issuedTo } : {}),
    ...(query.dueFrom ? { p_due_from: query.dueFrom } : {}),
    ...(query.dueTo ? { p_due_to: query.dueTo } : {}),
  });

  if (error) throwDataAccessError("summarize receivables", error);
  return (data ?? []).map((row) => ({
    currency: row.currency,
    count: Number(row.count),
    total: String(row.total),
    paid: String(row.paid),
    balance: String(row.balance),
  }));
}
