import "server-only";

/**
 * Punto de entrada de la capa de extracción (server-only). Tres extractores
 * independientes — texto pegado, DOCX y PDF — detrás de dos funciones:
 *
 * - `extractPastedText`: valida y normaliza texto pegado;
 * - `extractUploadedDocument`: detecta el tipo real del archivo (extensión +
 *   MIME + firma) y delega en el extractor correspondiente, con timeout.
 *
 * No depende de ningún proveedor de IA ni de Machotes.
 */

import { detectUploadedDocumentType } from "./detect";
import { extractDocxText } from "./docx";
import { normalizeExtractedText, visibleCharCount } from "./normalize";
import { extractPdfText } from "./pdf";
import {
  DocumentExtractionError,
  type ExtractedDocument,
  type ExtractionLimits,
} from "./types";

export {
  ACCEPTED_UPLOAD_EXTENSIONS,
  ACCEPTED_UPLOAD_MIME_TYPES,
} from "./detect";
export {
  DocumentExtractionError,
  EXTRACTION_ERROR_CODES,
  type ExtractedDocument,
  type ExtractionErrorCode,
  type ExtractionLimits,
  type ExtractionSourceType,
} from "./types";

export function extractPastedText(
  raw: string,
  limits: Pick<ExtractionLimits, "maxChars">,
): ExtractedDocument {
  // Corte temprano sobre el texto crudo antes de normalizar (evita trabajo
  // proporcional a un input gigante).
  if (raw.length > limits.maxChars * 2) {
    throw new DocumentExtractionError("text_too_long");
  }
  const text = normalizeExtractedText(raw);
  if (visibleCharCount(text) === 0) {
    throw new DocumentExtractionError("empty_text");
  }
  if (text.length > limits.maxChars) {
    throw new DocumentExtractionError("text_too_long");
  }
  return { sourceType: "text", text, pageCount: null, charCount: text.length };
}

async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new DocumentExtractionError("extraction_timeout")),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function extractUploadedDocument(
  input: { fileName: string; declaredMime: string; bytes: Uint8Array },
  limits: ExtractionLimits,
): Promise<ExtractedDocument> {
  if (input.bytes.byteLength === 0) {
    throw new DocumentExtractionError("empty_text");
  }
  if (input.bytes.byteLength > limits.maxFileBytes) {
    throw new DocumentExtractionError("file_too_large");
  }
  const type = detectUploadedDocumentType(input);
  const work =
    type === "pdf"
      ? extractPdfText(input.bytes, limits)
      : extractDocxText(input.bytes, limits);
  return withTimeout(work, limits.timeoutMs);
}
