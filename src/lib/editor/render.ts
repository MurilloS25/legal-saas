/**
 * Modelo de render del documento y sustitución de variables.
 *
 * `buildDocumentModel` produce una estructura neutra (sin React, sin HTML)
 * que consumen los previews de la UI y la exportación DOCX.
 * `renderStructuredTemplate` genera el snapshot textual persistido.
 *
 * Semántica de variables (idéntica al renderer legacy): una variable sin
 * valor —o con valor en blanco— permanece visible como `{{key}}`; nunca
 * desaparece silenciosamente.
 */

import type { TemplateDocument, TemplateInlineNode, TemplateVariantContentNode } from "./types";
import {
  applyVariableTransform,
  type VariableOutputTransform,
} from "./text-transforms";

export type RunMarks = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

export type TextRun = {
  kind: "text";
  text: string;
  marks: RunMarks;
};

export type VariableRun =
  | {
      kind: "variable";
      key: string;
      label?: string;
      resolved: true;
      /** Valor resuelto de la variable. */
      value: string;
    }
  | {
      kind: "variable";
      key: string;
      label?: string;
      resolved: false;
    };

export type LineBreakRun = {
  kind: "break";
};

/**
 * Bloque de opciones ya resuelto a la variante elegida (o predeterminada si
 * no hay selección para este `blockId`). `runs` son los runs normales de
 * esa variante — nunca contienen otro `OptionBlockRun` (los bloques no se
 * anidan). `variants` solo lleva `id`/`label` (no el contenido de cada una):
 * lo necesario para pintar el selector, sin duplicar el documento entero.
 */
export type OptionBlockRun = {
  kind: "optionBlock";
  blockId: string;
  name: string;
  variants: { id: string; label: string }[];
  selectedVariantId: string;
  runs: DocumentRun[];
};

export type DocumentRun = TextRun | VariableRun | LineBreakRun | OptionBlockRun;

export type DocumentParagraph = {
  kind: "paragraph";
  runs: DocumentRun[];
};

export type DocumentModel = DocumentParagraph[];

const NO_MARKS: RunMarks = { bold: false, italic: false, underline: false };

/** Transformación de salida configurada por variable, indexada por `field_key`. */
export type VariableTransformsMap = Record<string, VariableOutputTransform>;

/** Variante elegida por Bloque de opciones en una Escritura, indexada por `blockId`. */
export type OptionSelectionsMap = Record<string, string>;

function resolveValue(
  key: string,
  values: Record<string, string> | undefined,
  transforms: VariableTransformsMap | undefined,
): string | null {
  const value = values?.[key];
  if (value === undefined || value.trim() === "") return null;
  const transform = transforms?.[key] ?? "none";
  return applyVariableTransform(value, transform);
}

function resolveSimpleNode(
  node: TemplateVariantContentNode,
  values: Record<string, string> | undefined,
  transforms: VariableTransformsMap | undefined,
): DocumentRun {
  switch (node.type) {
    case "text": {
      const marks = node.marks ?? [];
      return {
        kind: "text",
        text: node.text,
        marks: {
          bold: marks.some((mark) => mark.type === "bold"),
          italic: marks.some((mark) => mark.type === "italic"),
          underline: marks.some((mark) => mark.type === "underline"),
        },
      };
    }
    case "templateVariable": {
      const value = resolveValue(node.attrs.key, values, transforms);
      return value === null
        ? {
            kind: "variable",
            key: node.attrs.key,
            label: node.attrs.label,
            resolved: false,
          }
        : {
            kind: "variable",
            key: node.attrs.key,
            label: node.attrs.label,
            value,
            resolved: true,
          };
    }
    case "hardBreak":
      return { kind: "break" };
  }
}

function resolveParagraphNode(
  node: TemplateInlineNode,
  values: Record<string, string> | undefined,
  transforms: VariableTransformsMap | undefined,
  optionSelections: OptionSelectionsMap | undefined,
): DocumentRun {
  if (node.type !== "optionBlock") {
    return resolveSimpleNode(node, values, transforms);
  }

  const selectedId = optionSelections?.[node.attrs.blockId];
  const variant =
    node.attrs.variants.find((v) => v.id === selectedId) ??
    node.attrs.variants.find((v) => v.id === node.attrs.defaultVariantId) ??
    node.attrs.variants[0];

  return {
    kind: "optionBlock",
    blockId: node.attrs.blockId,
    name: node.attrs.name,
    variants: node.attrs.variants.map((v) => ({ id: v.id, label: v.label })),
    selectedVariantId: variant?.id ?? node.attrs.defaultVariantId,
    runs: variant
      ? variant.content.map((child) => resolveSimpleNode(child, values, transforms))
      : [],
  };
}

/**
 * Convierte el documento en párrafos y runs listos para renderizar.
 * Sin `values` (preview de machote) toda variable queda pendiente.
 * `transforms` es opcional: mapea `field_key` a la transformación de salida
 * configurada para esa variable (ver `text-transforms.ts`). `optionSelections`
 * es opcional: mapea `blockId` a la variante elegida en la Escritura; sin
 * selección (o preview de Machote) se usa la variante predeterminada del
 * propio Bloque. Este es el único punto donde se aplican transformaciones y
 * se resuelven Bloques de opciones, para que la previsualización, el
 * `rendered_content` guardado y el DOCX nunca diverjan.
 */
export function buildDocumentModel(
  document: TemplateDocument,
  values?: Record<string, string>,
  transforms?: VariableTransformsMap,
  optionSelections?: OptionSelectionsMap,
): DocumentModel {
  return document.content.map((paragraph) => ({
    kind: "paragraph",
    runs: (paragraph.content ?? []).map((node) =>
      resolveParagraphNode(node, values, transforms, optionSelections),
    ),
  }));
}

function runToText(run: DocumentRun): string {
  switch (run.kind) {
    case "text":
      return run.text;
    case "variable":
      return run.resolved ? run.value : `{{${run.key}}}`;
    case "break":
      return "\n";
    case "optionBlock":
      return run.runs.map(runToText).join("");
  }
}

/**
 * Snapshot textual del documento con los valores sustituidos. Las variables
 * sin valor permanecen como `{{key}}`. Los párrafos se unen con `\n`. Un
 * Bloque de opciones se reemplaza por el texto de su variante resuelta.
 */
export function renderStructuredTemplate(
  document: TemplateDocument,
  values: Record<string, string>,
  transforms?: VariableTransformsMap,
  optionSelections?: OptionSelectionsMap,
): string {
  return buildDocumentModel(document, values, transforms, optionSelections)
    .map((paragraph) => paragraph.runs.map(runToText).join(""))
    .join("\n");
}

/** Marcas por defecto (sin formato), útil para composición en la UI. */
export { NO_MARKS };
