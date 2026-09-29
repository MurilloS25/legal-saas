/**
 * Parsing y validación de la paginación y la búsqueda del directorio de
 * clientes.
 *
 * Paginación y búsqueda son server-side (misma estrategia que Escrituras,
 * Cuentas por cobrar e Índice notarial): la página actual y el texto de
 * búsqueda (`q`) viajan en el query string y se normalizan aquí con límites
 * seguros antes de tocar la base de datos.
 */

import {
  DEFAULT_PAGE_SIZE,
  normalizePage,
  normalizePageSize,
  type PageSizeOption,
} from "@/lib/pagination";

export const CLIENTS_PAGE_SIZE = DEFAULT_PAGE_SIZE;
export const CLIENTS_MAX_SEARCH_LENGTH = 100;

export type RawClientsQuery = {
  page?: string;
  pageSize?: string;
  q?: string;
};

export type ClientsQuery = {
  page: number;
  pageSize: PageSizeOption;
  /** Texto de búsqueda ya recortado ("" si no hay búsqueda). */
  q: string;
};

export function parseClientsQuery(raw: RawClientsQuery): ClientsQuery {
  return {
    page: normalizePage(raw.page),
    pageSize: normalizePageSize(raw.pageSize),
    q: (raw.q ?? "").trim().slice(0, CLIENTS_MAX_SEARCH_LENGTH),
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
  if (query.q) params.q = query.q;
  if (query.pageSize && query.pageSize !== CLIENTS_PAGE_SIZE) {
    params.pageSize = String(query.pageSize);
  }
  if (query.page && query.page > 1) params.page = String(query.page);
  return params;
}

/**
 * Reduce la búsqueda a caracteres seguros para expresiones PostgREST `.or()`:
 * conserva letras Unicode, números, espacios y guiones y descarta la
 * puntuación que alteraría la sintaxis del filtro (`.`, `,`, `(`, `)`, `%`,
 * `_`, comillas…).
 */
export function sanitizeClientSearchTerm(search: string): string {
  return search
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Forma comparable de una identificación: sin guiones ni espacios y en
 * minúsculas. Es la MISMA regla que la columna generada
 * `clients.identification_search` (ver la migración
 * `20260929120000_clients_identification_search`): si una cambia, la otra
 * también.
 */
export function normalizeIdentificationForSearch(value: string): string {
  return value.replace(/[\s-]/g, "").toLowerCase();
}

/**
 * Filtro `.or()` de PostgREST para buscar por nombre / razón social o por
 * identificación. Devuelve `null` si la búsqueda está vacía y `""` si no
 * queda ningún carácter seguro (no debe coincidir nada).
 *
 * La identificación se compara contra `identification_search` (columna
 * generada sin guiones ni espacios) con el texto buscado normalizado igual:
 * `3101123456`, `3-101-123456` y `3 101 123456` encuentran `3-101-123456`,
 * y ningún carácter arbitrario puede colarse entre los dígitos. Solo se
 * consulta por identificación si lo escrito contiene algún dígito.
 */
export function buildClientSearchFilter(search: string): string | null {
  if (search.trim() === "") return null;
  const term = sanitizeClientSearchTerm(search);
  if (term === "") return "";

  const parts = [`full_name.ilike.%${term}%`];
  const identification = normalizeIdentificationForSearch(term);
  if (/\d/.test(identification)) {
    parts.push(`identification_search.ilike.%${identification}%`);
  }
  return parts.join(",");
}
