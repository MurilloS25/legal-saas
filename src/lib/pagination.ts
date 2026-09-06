/**
 * Utilidades compartidas de paginación server-side (URL como source of
 * truth), reutilizadas por Clientes, Machotes, Escrituras, Cuentas por
 * cobrar e Índice Notarial — todos siguen el mismo patrón: `page`/`pageSize`
 * llegan por query string, se normalizan aquí con límites seguros, y la
 * consulta real vive en cada módulo (columnas y filtros son propios de cada
 * uno).
 */

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

const MAX_PAGE = 100_000;

export function normalizePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, MAX_PAGE);
}

/**
 * Normaliza `pageSize` contra la lista blanca de opciones — cualquier valor
 * fuera de `PAGE_SIZE_OPTIONS` (incluida basura o ausencia) cae al default
 * del módulo en vez de permitir un tamaño de página arbitrario.
 */
export function normalizePageSize(
  value: string | undefined,
  fallback: PageSizeOption,
): PageSizeOption {
  const parsed = Number.parseInt(value ?? "", 10);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as PageSizeOption)
    : fallback;
}

/**
 * Resuelve, en el servidor, la URL de cada opción de tamaño de página —
 * `TablePagination`/`PageSizeSelect` solo reciben esta lista ya calculada
 * (datos planos), nunca la función `hrefFor` en sí: pasar una función a
 * `PageSizeSelect` (Client Component) rompería la serialización RSC.
 */
export function buildPageSizeOptions(
  hrefFor: (pageSize: PageSizeOption) => string,
): { value: PageSizeOption; href: string }[] {
  return PAGE_SIZE_OPTIONS.map((value) => ({ value, href: hrefFor(value) }));
}
