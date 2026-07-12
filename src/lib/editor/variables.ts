/**
 * Extracción de variables del documento estructurado.
 *
 * Misma semántica que `extractTemplateVariables` (texto legacy): claves sin
 * llaves, sin duplicados y en orden de aparición.
 */

import type { TemplateDocument, TemplateParagraphNode } from "./types";

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
 * Devuelve una copia del documento con las etiquetas configuradas aplicadas
 * a las variables. Útil al cargar machotes legacy, cuya conversión conoce
 * las claves pero no las etiquetas de los campos configurados. Las
 * etiquetas ya presentes en el documento no se sobreescriben.
 */
export function applyVariableLabels(
  document: TemplateDocument,
  labels: Record<string, string>,
): TemplateDocument {
  const content: TemplateParagraphNode[] = document.content.map((paragraph) => {
    if (!paragraph.content) return paragraph;
    return {
      ...paragraph,
      content: paragraph.content.map((node) => {
        if (node.type !== "templateVariable" || node.attrs.label) return node;
        const label = labels[node.attrs.key];
        return label === undefined
          ? node
          : { ...node, attrs: { ...node.attrs, label } };
      }),
    };
  });

  return { type: "doc", content };
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
