/**
 * Parsing y validación de la paginación del listado de machotes.
 *
 * La paginación es server-side (misma estrategia que Escrituras, Clientes,
 * Cuentas por cobrar e Índice notarial): la página actual viaja en el query
 * string y se normaliza aquí con límites seguros antes de tocar la base de
 * datos.
 */

export const TEMPLATES_PAGE_SIZE = 10;

export type RawTemplatesQuery = {
  page?: string;
};

export type TemplatesQuery = {
  page: number;
};

function normalizePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 100_000);
}

export function parseTemplatesQuery(raw: RawTemplatesQuery): TemplatesQuery {
  return { page: normalizePage(raw.page) };
}

/**
 * Serializa la query a un objeto de searchParams (omitiendo el default) para
 * construir los enlaces de paginación.
 */
export function templatesQueryToParams(
  query: Partial<TemplatesQuery>,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.page && query.page > 1) params.page = String(query.page);
  return params;
}
