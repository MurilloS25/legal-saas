/**
 * Localización de referencias del modelo en el texto original: la posición
 * de la n-ésima aparición literal de `needle` dentro de un párrafo, o -1.
 * Compartida por la validación semántica y la reconstrucción determinista,
 * para que ambas juzguen una referencia exactamente igual.
 */
export function findNth(haystack: string, needle: string, n: number): number {
  let from = 0;
  for (let i = 1; i <= n; i += 1) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) return -1;
    if (i === n) return index;
    from = index + needle.length;
  }
  return -1;
}

export type SourceReference = { paragraph: number; text: string; occurrence: number };

/** Rango [start, end) de una referencia en su párrafo (1-based), o null. */
export function locateReference(
  paragraphs: readonly string[],
  ref: SourceReference,
): { paragraphIndex: number; start: number; end: number } | null {
  const paragraphIndex = ref.paragraph - 1;
  const paragraph = paragraphs[paragraphIndex];
  if (paragraph === undefined || ref.text.trim() === "") return null;
  const start = findNth(paragraph, ref.text, ref.occurrence);
  return start < 0 ? null : { paragraphIndex, start, end: start + ref.text.length };
}
