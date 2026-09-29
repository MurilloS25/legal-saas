import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { isRangeNotSatisfiable, throwDataAccessError } from "@/lib/server/errors";
import {
  buildClientSearchFilter,
  type ClientsQuery,
} from "../model/workspace-query";
import type { ClientRow } from "../model/types";
import {
  AUXILIARY_QUERY_LIMIT,
  ensureWithinResultLimit,
} from "@/lib/server/bounded-results";

const CLIENT_COLUMNS =
  "id, full_name, identification_type, identification_number, marital_status, nationality, occupation, exact_address, created_at, updated_at";

/** Todos los clientes del Workspace, sin paginar (para selectores/filtros). */
export async function listClients(): Promise<ClientRow[]> {
  const { supabase, workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("full_name", { ascending: true })
    .limit(AUXILIARY_QUERY_LIMIT + 1);

  if (error) throwDataAccessError("list clients", error);
  return ensureWithinResultLimit(
    data ?? [],
    AUXILIARY_QUERY_LIMIT,
    "clientes",
  );
}

export type ClientsPage = {
  rows: ClientRow[];
  total: number;
  pageCount: number;
};

/**
 * Página del directorio de clientes para el listado principal (server-paginado
 * y con búsqueda opcional por nombre / razón social o identificación).
 */
export async function listClientsPage(query: ClientsQuery): Promise<ClientsPage> {
  const { supabase, workspaceId } = await requireWorkspace();
  const from = (query.page - 1) * query.pageSize;
  const searchFilter = buildClientSearchFilter(query.q);
  // Búsqueda sin ningún carácter seguro: no coincide nada.
  if (searchFilter === "") return { rows: [], total: 0, pageCount: 1 };

  let request = supabase
    .from("clients")
    .select(CLIENT_COLUMNS, { count: "exact" })
    .eq("workspace_id", workspaceId);
  if (searchFilter) request = request.or(searchFilter);
  const { data, count, error } = await request
    .order("full_name", { ascending: true })
    .range(from, from + query.pageSize - 1);

  if (error && !isRangeNotSatisfiable(error)) {
    throwDataAccessError("list clients page", error);
  }

  if (error) {
    // El offset pedido quedó más allá de las filas disponibles (p. ej. una
    // página vieja tras borrar clientes): la página está vacía, no es un
    // error real.
    let countRequest = supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);
    if (searchFilter) countRequest = countRequest.or(searchFilter);
    const { count: totalOnly, error: countError } = await countRequest;
    if (countError) throwDataAccessError("count clients page", countError);
    const total = totalOnly ?? 0;
    return { rows: [], total, pageCount: Math.max(1, Math.ceil(total / query.pageSize)) };
  }

  const total = count ?? 0;

  return {
    rows: data ?? [],
    total,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
