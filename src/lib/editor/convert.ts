/**
 * Conversión entre el contenido legacy (texto plano con `{{key}}`) y el
 * documento estructurado.
 *
 * Decisiones:
 *
 * - Cada línea del texto legacy se convierte en un párrafo. Los saltos de
 *   línea CRLF/CR se normalizan a LF antes de convertir.
 * - Los placeholders con clave válida se convierten al nodo estructurado
 *   `templateVariable`; los inválidos permanecen como texto literal.
 * - `{{ key }}` con espacios internos se normaliza a `{{key}}` (misma
 *   semántica que ya aplicaban el extractor y el renderer legacy).
 * - La serialización inversa une párrafos con `\n` y emite las variables en
 *   la sintaxis de compatibilidad `{{key}}`, de modo que
 *   `serializeDocumentToTemplateText(legacyTextToDocument(text)) === text`
 *   para texto canónico (LF y placeholders sin espacios).
 */

import { FIELD_KEY_PATTERN } from "@/lib/validations/template-fields";
import { PLACEHOLDER_PATTERN } from "@/lib/templates/variables";
import type {
  TemplateDocument,
  TemplateInlineNode,
  TemplateParagraphNode,
} from "./types";
import { emptyTemplateDocument } from "./types";

function lineToInlineNodes(line: string): TemplateInlineNode[] {
  const nodes: TemplateInlineNode[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(PLACEHOLDER_PATTERN)) {
    const key = match[1].trim();
    if (!FIELD_KEY_PATTERN.test(key)) continue;

    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: line.slice(lastIndex, match.index) });
    }
    nodes.push({ type: "templateVariable", attrs: { key } });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    nodes.push({ type: "text", text: line.slice(lastIndex) });
  }

  return nodes;
}

export function legacyTextToDocument(text: string): TemplateDocument {
  const normalized = text.replace(/\r\n?/g, "\n");
  if (normalized === "") return emptyTemplateDocument();

  const paragraphs: TemplateParagraphNode[] = normalized
    .split("\n")
    .map((line) => {
      const content = lineToInlineNodes(line);
      return content.length > 0
        ? { type: "paragraph" as const, content }
        : { type: "paragraph" as const };
    });

  return { type: "doc", content: paragraphs };
}

/**
 * Serializa el documento a la sintaxis de compatibilidad con `{{key}}`.
 * Es el texto que se guarda como respaldo legacy y el que consumen las
 * utilidades textuales existentes.
 */
export function serializeDocumentToTemplateText(
  document: TemplateDocument,
): string {
  return document.content
    .map((paragraph) =>
      (paragraph.content ?? [])
        .map((node) => {
          switch (node.type) {
            case "text":
              return node.text;
            case "templateVariable":
              return `{{${node.attrs.key}}}`;
            case "hardBreak":
              return "\n";
          }
        })
        .join(""),
    )
    .join("\n");
}

/**
 * Texto plano para búsquedas o previews cortos: las variables se muestran
 * por su etiqueta (o su clave) sin llaves.
 */
export function documentToPlainText(document: TemplateDocument): string {
  return document.content
    .map((paragraph) =>
      (paragraph.content ?? [])
        .map((node) => {
          switch (node.type) {
            case "text":
              return node.text;
            case "templateVariable":
              return node.attrs.label?.trim() || node.attrs.key;
            case "hardBreak":
              return "\n";
          }
        })
        .join(""),
    )
    .join("\n");
}
