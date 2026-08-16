/**
 * Quita parámetros de una query string y devuelve la ruta resultante.
 * Función pura (sin `window`/DOM) para poder probarla con vitest; el
 * llamador es quien decide qué hacer con el resultado (típicamente
 * `history.replaceState`, ver `DocumentLifecycleToast` y los efectos de
 * montaje de toast en `DocumentComposer`/`TemplateWorkspace`/
 * `ReceivableWorkspace`).
 *
 * Se usa para que un indicador efímero de éxito (`?created=1`,
 * `?lifecycle=finalized`, ...) desaparezca de la URL después de leerse una
 * vez, y así no reaparezca al recargar o volver atrás.
 */
export function stripSearchParams(
  pathname: string,
  search: string,
  params: string[],
): string {
  const query = new URLSearchParams(search);
  let changed = false;
  for (const param of params) {
    if (query.has(param)) {
      query.delete(param);
      changed = true;
    }
  }
  if (!changed) return `${pathname}${search}`;

  const next = query.toString();
  return next ? `${pathname}?${next}` : pathname;
}
