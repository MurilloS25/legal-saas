/**
 * Extracción de variables del documento estructurado.
 *
 * Misma semántica que `extractTemplateVariables` (texto legacy): claves sin
 * llaves, sin duplicados y en orden de aparición.
 */

import type {
  TemplateDocument,
  TemplateInlineNode,
  TemplateParagraphNode,
} from "./types";
import type { OptionSelectionsMap } from "./render";

/**
 * Todas las variables usadas en cualquier variante de un Bloque de
 * opciones también cuentan como usadas por el machote — no solo las de la
 * variante predeterminada — así siguen disponibles como campos llenables
 * sin importar qué variante se elija después en la Escritura.
 */
function collectAllVariableKeys(node: TemplateInlineNode, seen: Set<string>) {
  if (node.type === "templateVariable") {
    seen.add(node.attrs.key);
  } else if (node.type === "optionBlock") {
    for (const variant of node.attrs.variants) {
      for (const child of variant.content) {
        collectAllVariableKeys(child, seen);
      }
    }
  }
}

export function extractTemplateVariablesFromDocument(
  document: TemplateDocument,
): string[] {
  const seen = new Set<string>();

  for (const paragraph of document.content) {
    for (const node of paragraph.content ?? []) {
      collectAllVariableKeys(node, seen);
    }
  }

  return [...seen];
}

/**
 * Igual que `extractTemplateVariablesFromDocument`, pero para una Escritura:
 * de cada Bloque de opciones solo recorre la variante seleccionada (o la
 * predeterminada del Machote si no hay selección para ese `blockId`) — las
 * variables de las otras variantes no cuentan como activas.
 */
function collectActiveVariableKeys(
  node: TemplateInlineNode,
  seen: Set<string>,
  optionSelections: OptionSelectionsMap,
) {
  if (node.type === "templateVariable") {
    seen.add(node.attrs.key);
    return;
  }
  if (node.type !== "optionBlock") return;

  const selectedId = optionSelections[node.attrs.blockId];
  const variant =
    node.attrs.variants.find((v) => v.id === selectedId) ??
    node.attrs.variants.find((v) => v.id === node.attrs.defaultVariantId) ??
    node.attrs.variants[0];
  if (!variant) return;
  for (const child of variant.content) {
    collectActiveVariableKeys(child, seen, optionSelections);
  }
}

export function extractActiveDocumentVariables(
  document: TemplateDocument,
  optionSelections: OptionSelectionsMap = {},
): string[] {
  const seen = new Set<string>();

  for (const paragraph of document.content) {
    for (const node of paragraph.content ?? []) {
      collectActiveVariableKeys(node, seen, optionSelections);
    }
  }

  return [...seen];
}

function applyLabelToNode(
  node: TemplateInlineNode,
  labels: Record<string, string>,
): TemplateInlineNode {
  if (node.type === "templateVariable") {
    if (node.attrs.label) return node;
    const label = labels[node.attrs.key];
    return label === undefined ? node : { ...node, attrs: { ...node.attrs, label } };
  }
  if (node.type === "optionBlock") {
    return {
      ...node,
      attrs: {
        ...node.attrs,
        variants: node.attrs.variants.map((variant) => ({
          ...variant,
          content: variant.content.map(
            (child) => applyLabelToNode(child, labels) as (typeof variant.content)[number],
          ),
        })),
      },
    };
  }
  return node;
}

/**
 * Devuelve una copia del documento con las etiquetas configuradas aplicadas
 * a las variables. Útil al cargar machotes legacy, cuya conversión conoce
 * las claves pero no las etiquetas de los campos configurados. Las
 * etiquetas ya presentes en el documento no se sobreescriben. Recorre
 * también el contenido de cada variante de los Bloques de opciones.
 */
export function applyVariableLabels(
  document: TemplateDocument,
  labels: Record<string, string>,
): TemplateDocument {
  const content: TemplateParagraphNode[] = document.content.map((paragraph) => {
    if (!paragraph.content) return paragraph;
    return {
      ...paragraph,
      content: paragraph.content.map((node) => applyLabelToNode(node, labels)),
    };
  });

  return { type: "doc", content };
}

/**
 * Variables activas de una Escritura (ver `extractActiveDocumentVariables`)
 * sin valor —ausente o en blanco—, sin duplicados y en orden de aparición.
 */
export function findUnresolvedDocumentVariables(
  document: TemplateDocument,
  values: Record<string, string>,
  optionSelections?: OptionSelectionsMap,
): string[] {
  return extractActiveDocumentVariables(document, optionSelections).filter((key) => {
    const value = values[key];
    return value === undefined || value.trim() === "";
  });
}
