import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DocumentIdSchema } from "@/lib/validations/documents";
import { extractTemplateVariables } from "@/lib/templates/variables";
import {
  DOCUMENTS_PAGE_SIZE,
  sortColumnFor,
  type DocumentsQuery,
} from "@/lib/documents/workspace-query";

export type DocumentListRow = {
  id: string;
  title: string;
  status: string;
  template_id: string;
  client_id: string | null;
  updated_at: string;
  templates: { name: string } | null;
  clients: { id: string; full_name: string } | null;
};

export type DocumentRow = {
  id: string;
  title: string;
  status: string;
  template_id: string;
  client_id: string | null;
  field_values: Record<string, string>;
  rendered_content: string;
  created_at: string;
  updated_at: string;
  clients: { id: string; full_name: string } | null;
};

/** Escritura asociada a un cliente, para la sección del detalle de cliente. */
export type ClientDocumentRow = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  templates: { name: string } | null;
};

/** Borradores del usuario, el modificado más recientemente primero. */
export async function listDocuments(): Promise<DocumentListRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, title, status, template_id, client_id, updated_at, templates(name), clients(id, full_name)",
    )
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as unknown as DocumentListRow[];
}

/**
 * Escritura por ID, solo del usuario autenticado. Devuelve null tanto si no
 * existe como si pertenece a otro usuario — sin filtrar la diferencia.
 */
export async function getDocumentById(id: string): Promise<DocumentRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!DocumentIdSchema.safeParse(id).success) return null;

  const { data } = await supabase
    .from("documents")
    .select(
      "id, title, status, template_id, client_id, field_values, rendered_content, created_at, updated_at, clients(id, full_name)",
    )
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  return (data as unknown as DocumentRow | null) ?? null;
}

/**
 * Escrituras asociadas a un cliente propio, la más reciente primero. Solo
 * del usuario autenticado; el cliente ajeno no devuelve nada.
 */
export async function listDocumentsByClient(
  clientId: string,
): Promise<ClientDocumentRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!DocumentIdSchema.safeParse(clientId).success) return [];

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, status, updated_at, templates(name)")
    .eq("owner_id", user.id)
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as unknown as ClientDocumentRow[];
}

// ------------------------------------------------------------------ workspace

export type WorkspaceDocumentRow = {
  id: string;
  title: string;
  status: string;
  client_id: string | null;
  updated_at: string;
  templates: { name: string } | null;
  clients: { id: string; full_name: string } | null;
  /** Variables sin valor del snapshot persistido (para la descarga). */
  pendingVariableCount: number;
};

export type DocumentsPage = {
  rows: WorkspaceDocumentRow[];
  total: number;
  pageCount: number;
};

/** Neutraliza los metacaracteres del lenguaje de filtros de PostgREST. */
function sanitizeSearchTerm(search: string): string {
  return search
    .replace(/[,()*%\\:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Página de escrituras del usuario con búsqueda, filtros y orden server-side.
 * La búsqueda cubre título (columna base) y nombre de cliente/machote
 * (resolviendo primero los ids que coinciden, sin traer todo a memoria).
 */
export async function listDocumentsPage(
  query: DocumentsQuery,
): Promise<DocumentsPage> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Cláusula OR de búsqueda: título + ids de clientes/machotes que coinciden.
  let orClause: string | null = null;
  const term = sanitizeSearchTerm(query.search);
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

  if (error) return { rows: [], total: 0, pageCount: 0 };

  const rows: WorkspaceDocumentRow[] = (
    (data ?? []) as unknown as (Omit<
      WorkspaceDocumentRow,
      "pendingVariableCount"
    > & { rendered_content: string })[]
  ).map((row) => {
    const { rendered_content, ...rest } = row;
    return {
      ...rest,
      // El snapshot deja `{{clave}}` para las variables sin valor.
      pendingVariableCount: extractTemplateVariables(rendered_content ?? "")
        .length,
    };
  });

  const total = count ?? 0;
  return {
    rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / DOCUMENTS_PAGE_SIZE)),
  };
}
