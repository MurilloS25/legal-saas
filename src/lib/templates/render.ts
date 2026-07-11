/**
 * Reemplazo de variables para el preview textual de un documento.
 *
 * Todo se trata como texto plano: no se interpreta HTML ni se ejecuta nada.
 * Decisión: si una variable no tiene valor (o está vacío), el placeholder se
 * deja visible en el texto — es la opción más segura porque el abogado ve
 * exactamente qué falta en el documento.
 *
 * NOTA: el patrón de placeholder y la regla de field_key también existen en
 * `feat/template-variable-inspector` (src/lib/templates/variables.ts).
 * Cuando ambas ramas estén en develop, unificar en un solo módulo.
 */

const PLACEHOLDER_PATTERN = /\{\{([^{}]*)\}\}/g;

// Misma regla de formato que field_key en template_fields.
const FIELD_KEY_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

function resolvedValue(
  key: string,
  values: Record<string, string>,
): string | null {
  const value = values[key];
  if (value === undefined || value.trim() === "") return null;
  return value;
}

/**
 * Reemplaza cada `{{field_key}}` (con espacios internos opcionales) por su
 * valor. Placeholders inválidos o sin valor quedan intactos. Los valores se
 * insertan literalmente y no se vuelven a expandir.
 */
export function renderTemplateContent(
  content: string,
  values: Record<string, string>,
): string {
  return content.replace(PLACEHOLDER_PATTERN, (placeholder, inner: string) => {
    const key = inner.trim();
    if (!FIELD_KEY_PATTERN.test(key)) return placeholder;
    return resolvedValue(key, values) ?? placeholder;
  });
}

/**
 * Variables válidas usadas en el contenido que no tienen valor (ausente o
 * vacío), sin duplicados y en orden de aparición.
 */
export function findUnresolvedVariables(
  content: string,
  values: Record<string, string>,
): string[] {
  const unresolved = new Set<string>();

  for (const match of content.matchAll(PLACEHOLDER_PATTERN)) {
    const key = match[1].trim();
    if (FIELD_KEY_PATTERN.test(key) && resolvedValue(key, values) === null) {
      unresolved.add(key);
    }
  }

  return [...unresolved];
}
