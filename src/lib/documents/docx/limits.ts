/**
 * Límites del generador DOCX.
 *
 * Coherentes con (y nunca más estrictos que) los del editor y el snapshot
 * de escrituras: el documento estructurado ya está validado en ≤5 000
 * párrafos y ≤200 000 caracteres de plantilla (TEMPLATE_DOC_LIMITS), y los
 * valores en ≤200 entradas de ≤20 000 caracteres (DocumentValues). Aquí se
 * acota además el tamaño total tras sustituir valores y el buffer final,
 * para evitar consumo excesivo de memoria en la ruta de descarga.
 */

import type { DocumentModel } from "@/lib/editor/render";

export const DOCX_LIMITS = {
  /** Igual que TEMPLATE_DOC_LIMITS.maxParagraphs. */
  maxParagraphs: 5_000,
  /** Runs totales (texto, variables y saltos) en todo el documento. */
  maxRuns: 60_000,
  /** Caracteres totales tras sustituir field_values. */
  maxTotalTextLength: 1_000_000,
  /** Tamaño máximo del .docx generado, en bytes (~10 MB). */
  maxBufferBytes: 10 * 1024 * 1024,
} as const;

export type DocxLimitCode =
  | "too_many_paragraphs"
  | "too_many_runs"
  | "text_too_long"
  | "buffer_too_large";

/**
 * Verifica el modelo contra los límites antes de generar. Devuelve un código
 * técnico (no sensible) o null si está dentro de rango.
 */
export function checkDocumentModelLimits(
  model: DocumentModel,
): DocxLimitCode | null {
  if (model.length > DOCX_LIMITS.maxParagraphs) return "too_many_paragraphs";

  let runs = 0;
  let textLength = 0;
  for (const paragraph of model) {
    runs += paragraph.runs.length;
    if (runs > DOCX_LIMITS.maxRuns) return "too_many_runs";
    for (const run of paragraph.runs) {
      if (run.kind === "text") {
        textLength += run.text.length;
      } else if (run.kind === "variable") {
        textLength += run.resolved ? run.value.length : run.key.length + 4;
      }
      if (textLength > DOCX_LIMITS.maxTotalTextLength) return "text_too_long";
    }
  }

  return null;
}
