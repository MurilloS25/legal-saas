/**
 * Modelo de render del documento y sustitución de variables.
 *
 * `buildDocumentModel` produce una estructura neutra (sin React, sin HTML)
 * que consumen los previews de la UI y, en el futuro, la exportación DOCX.
 * `renderStructuredTemplate` genera el snapshot textual persistido.
 *
 * Semántica de variables (idéntica al renderer legacy): una variable sin
 * valor —o con valor en blanco— permanece visible como `{{key}}`; nunca
 * desaparece silenciosamente.
 */

import type { TemplateDocument } from "./types";

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

export type DocumentRun = TextRun | VariableRun | LineBreakRun;

export type DocumentParagraph = {
  kind: "paragraph";
  runs: DocumentRun[];
};

export type DocumentModel = DocumentParagraph[];

const NO_MARKS: RunMarks = { bold: false, italic: false, underline: false };

function resolveValue(
  key: string,
  values: Record<string, string> | undefined,
): string | null {
  const value = values?.[key];
  if (value === undefined || value.trim() === "") return null;
  return value;
}

/**
 * Convierte el documento en párrafos y runs listos para renderizar.
 * Sin `values` (preview de machote) toda variable queda pendiente.
 */
export function buildDocumentModel(
  document: TemplateDocument,
  values?: Record<string, string>,
): DocumentModel {
  return document.content.map((paragraph) => ({
    kind: "paragraph",
    runs: (paragraph.content ?? []).map((node): DocumentRun => {
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
          const value = resolveValue(node.attrs.key, values);
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
    }),
  }));
}

/**
 * Snapshot textual del documento con los valores sustituidos. Las variables
 * sin valor permanecen como `{{key}}`. Los párrafos se unen con `\n`.
 */
export function renderStructuredTemplate(
  document: TemplateDocument,
  values: Record<string, string>,
): string {
  return buildDocumentModel(document, values)
    .map((paragraph) =>
      paragraph.runs
        .map((run) => {
          switch (run.kind) {
            case "text":
              return run.text;
            case "variable":
              return run.resolved ? run.value : `{{${run.key}}}`;
            case "break":
              return "\n";
          }
        })
        .join(""),
    )
    .join("\n");
}

/** Marcas por defecto (sin formato), útil para composición en la UI. */
export { NO_MARKS };
