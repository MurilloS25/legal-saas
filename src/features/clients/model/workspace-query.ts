/**
 * Parsing y validación de la paginación del directorio de clientes.
 *
 * La paginación es server-side (misma estrategia que Escrituras, Cuentas por
 * cobrar e Índice notarial): la página actual viaja en el query string y se
 * normaliza aquí con límites seguros antes de tocar la base de datos.
 */

import {
  DEFAULT_PAGE_SIZE,
  normalizePage,
  normalizePageSize,
  type PageSizeOption,
} from "@/lib/pagination";

export const CLIENTS_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export type RawClientsQuery = {
  page?: string;
  pageSize?: string;
};

export type ClientsQuery = {
  page: number;
  pageSize: PageSizeOption;
};

export function parseClientsQuery(raw: RawClientsQuery): ClientsQuery {
  return { page: normalizePage(raw.page), pageSize: normalizePageSize(raw.pageSize) };
}

/**
 * Serializa la query a un objeto de searchParams (omitiendo el default) para
 * construir los enlaces de paginación.
 */
export function clientsQueryToParams(
  query: Partial<ClientsQuery>,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.pageSize && query.pageSize !== CLIENTS_PAGE_SIZE) {
    params.pageSize = String(query.pageSize);
  }
  if (query.page && query.page > 1) params.page = String(query.page);
  return params;
}
