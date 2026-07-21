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
export function findAdjacentVariableKey(
  keys: string[],
  currentKey: string,
  direction: 1 | -1,
): string | undefined {
  const currentIndex = keys.indexOf(currentKey);
  if (currentIndex === -1) return undefined;

  let index = currentIndex;
  do {
    index += direction;
  } while (index >= 0 && index < keys.length && keys[index] === currentKey);

  return index >= 0 && index < keys.length ? keys[index] : undefined;
}
