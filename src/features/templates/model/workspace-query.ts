/**
 * Parsing y validación de la paginación del listado de machotes.
 *
 * La paginación es server-side (misma estrategia que Escrituras, Clientes,
 * Cuentas por cobrar e Índice notarial): la página actual y el tamaño de
 * página viajan en el query string y se normalizan aquí con límites seguros
 * antes de tocar la base de datos.
 */

import { normalizePage, normalizePageSize, type PageSizeOption } from "@/lib/pagination";

export const TEMPLATES_PAGE_SIZE: PageSizeOption = 10;

export type RawTemplatesQuery = {
  page?: string;
  pageSize?: string;
};

export type TemplatesQuery = {
  page: number;
  pageSize: PageSizeOption;
};

export function parseTemplatesQuery(raw: RawTemplatesQuery): TemplatesQuery {
  return {
    page: normalizePage(raw.page),
    pageSize: normalizePageSize(raw.pageSize, TEMPLATES_PAGE_SIZE),
  };
}

/**
 * Serializa la query a un objeto de searchParams (omitiendo el default) para
 * construir los enlaces de paginación.
 */
export function templatesQueryToParams(
  query: Partial<TemplatesQuery>,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.pageSize && query.pageSize !== TEMPLATES_PAGE_SIZE) {
    params.pageSize = String(query.pageSize);
  }
  if (query.page && query.page > 1) params.page = String(query.page);
  return params;
}
