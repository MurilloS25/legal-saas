/**
 * Capa compartida de carga y guardado del contenido de un machote.
 *
 * Persistencia en `templates.content_json` (jsonb existente):
 *
 * - legacy:      `{ "text": "…{{key}}…" }`
 * - estructurado: `{ "text": "…{{key}}…", "doc": { "type": "doc", … } }`
 *
 * `text` se mantiene SIEMPRE como texto de compatibilidad derivado del
 * documento, de modo que los lectores legacy (`extractContent`,
 * `text_preview`, utilidades textuales) siguen funcionando sin cambios y
 * ningún registro existente se rompe. Los machotes legacy se convierten al
 * cargar; solo se persiste `doc` cuando el usuario guarda desde el editor.
 */

import { legacyTextToDocument, serializeDocumentToTemplateText } from "./convert";
import { validateTemplateDocument } from "./validate";
import type { TemplateDocument } from "./types";

export type ResolvedTemplateContent = {
  document: TemplateDocument;
  /** Texto de compatibilidad con la sintaxis `{{key}}`. */
  templateText: string;
  /** true si el contenido provino del formato estructurado. */
  structured: boolean;
};

function legacyTextFrom(contentJson: unknown): string {
  if (
    typeof contentJson === "object" &&
    contentJson !== null &&
    !Array.isArray(contentJson) &&
    typeof (contentJson as { text?: unknown }).text === "string"
  ) {
    return (contentJson as { text: string }).text;
  }
  return "";
}

/**
 * Resuelve el contenido de `content_json` al documento estructurado.
 * Si `doc` existe y es válido se usa; si no, se convierte el texto legacy.
 */
export function resolveTemplateContent(
  contentJson: unknown,
): ResolvedTemplateContent {
  if (
    typeof contentJson === "object" &&
    contentJson !== null &&
    !Array.isArray(contentJson) &&
    "doc" in contentJson
  ) {
    const validation = validateTemplateDocument(
      (contentJson as { doc: unknown }).doc,
    );
    if (validation.ok) {
      return {
        document: validation.document,
        templateText: serializeDocumentToTemplateText(validation.document),
        structured: true,
      };
    }
    // Documento estructurado inválido: se cae al texto de compatibilidad en
    // lugar de perder el machote.
  }

  const text = legacyTextFrom(contentJson);
  const document = legacyTextToDocument(text);
  return { document, templateText: text, structured: false };
}

/**
 * Construye el valor a persistir en `content_json` desde el documento
 * estructurado, manteniendo el texto de compatibilidad sincronizado.
 */
export function buildTemplateContentJson(document: TemplateDocument): {
  text: string;
  doc: TemplateDocument;
} {
  return {
    text: serializeDocumentToTemplateText(document),
    doc: document,
  };
}
