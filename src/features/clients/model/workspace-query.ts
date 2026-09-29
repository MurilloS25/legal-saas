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
 * Filtro `.or()` de PostgREST para buscar por nombre / razón social o por
 * identificación. Devuelve `null` si la búsqueda está vacía y `""` si no
 * queda ningún carácter seguro (no debe coincidir nada).
 *
 * La identificación tolera guiones y espacios: si lo escrito son solo
 * dígitos (≥ 4, p. ej. `3101123456`) se agrega un patrón con `%` entre
 * dígitos, que encuentra `3-101-123456` sin necesitar una columna
 * normalizada. Si lo escrito ya trae guiones (`3-101-123`) coincide tal cual.
 */
export function buildClientSearchFilter(search: string): string | null {
  if (search.trim() === "") return null;
  const term = sanitizeClientSearchTerm(search);
  if (term === "") return "";

  const like = `%${term}%`;
  const parts = [`full_name.ilike.${like}`, `identification_number.ilike.${like}`];

  const compact = term.replace(/[-\s]/g, "");
  if (/^\d{4,}$/.test(compact)) {
    parts.push(`identification_number.ilike.%${compact.split("").join("%")}%`);
  }
  return parts.join(",");
}
