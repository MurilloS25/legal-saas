import "server-only";

import { requireUser } from "@/lib/server/auth";
import { isRangeNotSatisfiable, throwDataAccessError } from "@/lib/server/errors";
import { CLIENTS_PAGE_SIZE, type ClientsQuery } from "../model/workspace-query";
import type { ClientRow } from "../model/types";

const CLIENT_COLUMNS =
  "id, full_name, identification_type, identification_number, marital_status, nationality, occupation, exact_address, created_at, updated_at";

/** Todos los clientes del dueño, sin paginar (para selectores/filtros). */
export async function listClients(): Promise<ClientRow[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("owner_id", user.id)
    .order("full_name", { ascending: true });

  if (error) throwDataAccessError("list clients", error);
  return data ?? [];
}

export type ClientsPage = {
  rows: ClientRow[];
  total: number;
  pageCount: number;
};

/** Página del directorio de clientes para el listado principal (server-paginado). */
export async function listClientsPage(query: ClientsQuery): Promise<ClientsPage> {
  const { supabase, user } = await requireUser();
  const from = (query.page - 1) * CLIENTS_PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS, { count: "exact" })
    .eq("owner_id", user.id)
    .order("full_name", { ascending: true })
    .range(from, from + CLIENTS_PAGE_SIZE - 1);

  if (error && !isRangeNotSatisfiable(error)) {
    throwDataAccessError("list clients page", error);
  }

  if (error) {
    // El offset pedido quedó más allá de las filas disponibles (p. ej. una
    // página vieja tras borrar clientes): la página está vacía, no es un
    // error real.
    const { count: totalOnly, error: countError } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    if (countError) throwDataAccessError("count clients page", countError);
    const total = totalOnly ?? 0;
    return { rows: [], total, pageCount: Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE)) };
  }

  const total = count ?? 0;

  return {
    rows: data ?? [],
    total,
    pageCount: Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE)),
  };
}
