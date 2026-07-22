const COPY_TITLE_PREFIX = "Copia de ";

/**
 * Título de la copia de una escritura duplicada: "Copia de {título}".
 *
 * Evita títulos encadenados ("Copia de Copia de..."): si el título original
 * ya es una copia, la nueva copia reusa el mismo prefijo en vez de apilarlo.
 */
export function buildDuplicateDocumentTitle(originalTitle: string): string {
  return originalTitle.startsWith(COPY_TITLE_PREFIX)
    ? originalTitle
    : `${COPY_TITLE_PREFIX}${originalTitle}`;
}
