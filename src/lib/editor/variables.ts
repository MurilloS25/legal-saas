/**
 * Extracción de variables del documento estructurado.
 *
 * Misma semántica que `extractTemplateVariables` (texto legacy): claves sin
 * llaves, sin duplicados y en orden de aparición.
 */

import type { TemplateDocument } from "./types";

export function extractTemplateVariablesFromDocument(
  document: TemplateDocument,
): string[] {
  const seen = new Set<string>();

  for (const paragraph of document.content) {
    for (const node of paragraph.content ?? []) {
      if (node.type === "templateVariable") {
        seen.add(node.attrs.key);
      }
    }
  }

  return [...seen];
}

/**
 * Variables del documento sin valor (ausente o en blanco), sin duplicados y
 * en orden de aparición.
 */
export function findUnresolvedDocumentVariables(
  document: TemplateDocument,
  values: Record<string, string>,
): string[] {
  return extractTemplateVariablesFromDocument(document).filter((key) => {
    const value = values[key];
    return value === undefined || value.trim() === "";
  });
}
