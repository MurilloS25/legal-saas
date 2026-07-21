import "server-only";

import { requireUser } from "@/lib/server/auth";
import { isRangeNotSatisfiable, throwDataAccessError } from "@/lib/server/errors";
import { extractTemplateVariables } from "@/features/templates";
import {
  DOCUMENTS_PAGE_SIZE,
  sanitizeSearchTermForPostgrest,
  sortColumnFor,
  type DocumentsQuery,
} from "../model/workspace-query";

export type WorkspaceDocumentRow = {
  id: string;
  title: string;
  status: string;
  client_id: string | null;
  updated_at: string;
  templates: { name: string } | null;
  clients: { id: string; full_name: string } | null;
  pendingVariableCount: number;
};

export type DocumentsPage = {
  rows: WorkspaceDocumentRow[];
  total: number;
  pageCount: number;
};

export async function listDocumentsPage(
  query: DocumentsQuery,
): Promise<DocumentsPage> {
  const { supabase, user } = await requireUser();
  let orClause: string | null = null;
  const term = sanitizeSearchTermForPostgrest(query.search);
  if (query.search !== "" && term === "") {
    return { rows: [], total: 0, pageCount: 1 };
  }

  if (term !== "") {
    const like = `%${term}%`;
    const [clientMatches, templateMatches] = await Promise.all([
      supabase
        .from("clients")
        .select("id")
        .eq("owner_id", user.id)
        .ilike("full_name", like),
      supabase
        .from("templates")
        .select("id")
        .eq("owner_id", user.id)
        .ilike("name", like),
    ]);

    if (clientMatches.error) {
      throwDataAccessError("search document clients", clientMatches.error);
    }
    if (templateMatches.error) {
      throwDataAccessError("search document templates", templateMatches.error);
    }

    const parts = [`title.ilike.${like}`];
    const clientIds = (clientMatches.data ?? []).map((row) => row.id);
    const templateIds = (templateMatches.data ?? []).map((row) => row.id);
    if (clientIds.length > 0) parts.push(`client_id.in.(${clientIds.join(",")})`);
    if (templateIds.length > 0) {
      parts.push(`template_id.in.(${templateIds.join(",")})`);
    }
    orClause = parts.join(",");
  }

  let request = supabase
    .from("documents")
    .select(
      "id, title, status, client_id, rendered_content, updated_at, templates(name), clients(id, full_name)",
      { count: "exact" },
    )
    .eq("owner_id", user.id);

  if (query.status) request = request.eq("status", query.status);
  if (query.clientId) request = request.eq("client_id", query.clientId);
  if (query.templateId) request = request.eq("template_id", query.templateId);
  if (orClause) request = request.or(orClause);

  const { column, ascending } = sortColumnFor(query.sort);
  const from = (query.page - 1) * DOCUMENTS_PAGE_SIZE;
  const { data, count, error } = await request
    .order(column, { ascending })
    .order("id", { ascending: true })
    .range(from, from + DOCUMENTS_PAGE_SIZE - 1);

  if (error && !isRangeNotSatisfiable(error)) {
    throwDataAccessError("list documents workspace", error);
  }

  if (error) {
    // El offset pedido quedó más allá de las filas disponibles (p. ej. una
    // página vieja tras borrar/filtrar escrituras): la página está vacía,
    // no es un error real. Se repite el mismo filtro sin `.range()`.
    let countRequest = supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    if (query.status) countRequest = countRequest.eq("status", query.status);
    if (query.clientId) countRequest = countRequest.eq("client_id", query.clientId);
    if (query.templateId) {
      countRequest = countRequest.eq("template_id", query.templateId);
    }
    if (orClause) countRequest = countRequest.or(orClause);
    const { count: totalOnly, error: countError } = await countRequest;
    if (countError) {
      throwDataAccessError("count documents workspace", countError);
    }
    const total = totalOnly ?? 0;
    return {
      rows: [],
      total,
      pageCount: Math.max(1, Math.ceil(total / DOCUMENTS_PAGE_SIZE)),
    };
  }

  const rows = (data ?? []).map(({ rendered_content, ...row }) => ({
    ...row,
    pendingVariableCount: extractTemplateVariables(rendered_content ?? "").length,
  }));
  const total = count ?? 0;

  return {
    rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / DOCUMENTS_PAGE_SIZE)),
  };
}
