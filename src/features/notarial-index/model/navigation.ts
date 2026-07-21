import type { FortnightSelection } from "./fortnight";

export type NotarialNavigationChanges = {
  search?: string;
  completeness?: string | null;
  actType?: string | null;
  selection?: FortnightSelection;
};

/**
 * Actualiza solo los filtros indicados, conserva el resto de la URL y siempre
 * vuelve a la primera página cuando cambia el conjunto de resultados.
 */
export function applyNotarialNavigationChanges(
  current: URLSearchParams,
  changes: NotarialNavigationChanges,
): URLSearchParams {
  const params = new URLSearchParams(current);

  if (changes.selection) {
    params.set("year", String(changes.selection.year));
    params.set("month", String(changes.selection.month));
    params.set("half", changes.selection.half);
  }

  if (changes.search !== undefined) {
    const search = changes.search.trim();
    if (search) params.set("search", search);
    else params.delete("search");
  }

  if (changes.completeness !== undefined) {
    if (changes.completeness) {
      params.set("completeness", changes.completeness);
    } else {
      params.delete("completeness");
    }
  }

  if (changes.actType !== undefined) {
    if (changes.actType) params.set("act_type", changes.actType);
    else params.delete("act_type");
  }

  params.delete("page");
  return params;
}
