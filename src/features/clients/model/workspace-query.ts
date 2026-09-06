/**
 * Parsing y validación de la paginación del directorio de clientes.
 *
 * La paginación es server-side (misma estrategia que Escrituras, Cuentas por
 * cobrar e Índice notarial): la página actual y el tamaño de página viajan en
 * el query string y se normalizan aquí con límites seguros antes de tocar la
 * base de datos.
 */

import { normalizePage, normalizePageSize, type PageSizeOption } from "@/lib/pagination";

export const CLIENTS_PAGE_SIZE: PageSizeOption = 10;

export type RawClientsQuery = {
  page?: string;
  pageSize?: string;
};

export type ClientsQuery = {
  page: number;
  pageSize: PageSizeOption;
};

export function parseClientsQuery(raw: RawClientsQuery): ClientsQuery {
  return {
    page: normalizePage(raw.page),
    pageSize: normalizePageSize(raw.pageSize, CLIENTS_PAGE_SIZE),
  };
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
