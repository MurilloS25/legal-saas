/**
 * Parsing y validación de la paginación del listado de machotes.
 *
 * La paginación es server-side (misma estrategia que Escrituras, Clientes,
 * Cuentas por cobrar e Índice notarial): la página actual viaja en el query
 * string y se normaliza aquí con límites seguros antes de tocar la base de
 * datos.
 */

import {
  DEFAULT_PAGE_SIZE,
  normalizePage,
  normalizePageSize,
  type PageSizeOption,
} from "@/lib/pagination";

export const TEMPLATES_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export type RawTemplatesQuery = {
  page?: string;
  pageSize?: string;
};

export type TemplatesQuery = {
  page: number;
  pageSize: PageSizeOption;
};

export function parseTemplatesQuery(raw: RawTemplatesQuery): TemplatesQuery {
  return { page: normalizePage(raw.page), pageSize: normalizePageSize(raw.pageSize) };
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
