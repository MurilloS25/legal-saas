/**
 * Parsing y validación de la paginación del directorio de clientes.
 *
 * La paginación es server-side (misma estrategia que Escrituras, Cuentas por
 * cobrar e Índice notarial): la página actual viaja en el query string y se
 * normaliza aquí con límites seguros antes de tocar la base de datos.
 */

export const CLIENTS_PAGE_SIZE = 10;

export type RawClientsQuery = {
  page?: string;
};

export type ClientsQuery = {
  page: number;
};

function normalizePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 100_000);
}

export function parseClientsQuery(raw: RawClientsQuery): ClientsQuery {
  return { page: normalizePage(raw.page) };
}

/**
 * Serializa la query a un objeto de searchParams (omitiendo el default) para
 * construir los enlaces de paginación.
 */
export function clientsQueryToParams(
  query: Partial<ClientsQuery>,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.page && query.page > 1) params.page = String(query.page);
  return params;
}
