import { FIELD_KEY_PATTERN } from "@/lib/validations/template-fields";

/**
 * Placeholder de machote: `{{field_key}}`, con espacios opcionales alrededor
 * del key. El contenido interno se valida aparte contra FIELD_KEY_PATTERN,
 * la misma regla de formato que usa `field_key` en template_fields.
 */
export const PLACEHOLDER_PATTERN = /\{\{([^{}]*)\}\}/g;

/**
 * Extrae las variables válidas usadas en el contenido de un machote,
 * sin llaves, sin duplicados y en orden de aparición. Los placeholders
 * con formato inválido se ignoran.
 */
export function extractTemplateVariables(content: string): string[] {
  const seen = new Set<string>();

  for (const match of content.matchAll(PLACEHOLDER_PATTERN)) {
    const key = match[1].trim();
    if (FIELD_KEY_PATTERN.test(key)) {
      seen.add(key);
    }
  }

  return [...seen];
}

/** Variables usadas en el contenido que no están definidas como campos. */
export function findMissingTemplateFields(
  variables: string[],
  definedFields: string[],
): string[] {
  const defined = new Set(definedFields);
  return variables.filter((variable) => !defined.has(variable));
}

/** Campos definidos que no se usan en el contenido. */
export function findUnusedTemplateFields(
  variables: string[],
  definedFields: string[],
): string[] {
  const used = new Set(variables);
  return definedFields.filter((field) => !used.has(field));
}
