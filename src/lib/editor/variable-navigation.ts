/**
 * Navegación entre variables en orden documental (edición inline en la
 * hoja de la Escritura). Pura y testeable: no depende de React ni del DOM.
 */

/**
 * Dada la lista de claves de variable en el orden en que aparecen en el
 * documento (puede tener repetidos si la misma variable aparece varias
 * veces), devuelve la clave siguiente/anterior a partir de la primera
 * ocurrencia de `currentKey`. `undefined` si no hay una siguiente/anterior
 * (el llamador decide qué hacer al llegar al límite, p. ej. salir del modo
 * edición).
 */
export type VariableOccurrence = {
  nodeId: string;
  variableKey: string;
};

export function findAdjacentVariableOccurrence(
  occurrences: readonly VariableOccurrence[],
  currentNodeId: string,
  direction: 1 | -1,
): VariableOccurrence | undefined {
  const currentIndex = occurrences.findIndex(
    (occurrence) => occurrence.nodeId === currentNodeId,
  );
  if (currentIndex === -1) return undefined;

  const currentKey = occurrences[currentIndex].variableKey;
  let index = currentIndex;
  do {
    index += direction;
  } while (
    index >= 0 &&
    index < occurrences.length &&
    occurrences[index].variableKey === currentKey
  );

  return index >= 0 && index < occurrences.length
    ? occurrences[index]
    : undefined;
}
