/**
 * Extracción de texto de un PDF con capa de texto, usando `unpdf` (build
 * serverless de PDF.js, sin dependencias nativas).
 *
 * Defensas:
 * - la build de PDF.js incluida ya no compila fuentes con `eval`/`Function`
 *   (la clase de CVE-2024-4367 no aplica) y XFA queda desactivado;
 * - sin rango/streaming/autofetch: el documento se procesa solo desde los
 *   bytes en memoria, sin peticiones de red (no hay SSRF);
 * - el número de páginas se valida ANTES de extraer texto, y el texto se
 *   corta en cuanto supera el máximo de caracteres;
 * - un PDF escaneado (sin capa de texto) se rechaza: no se hace OCR.
 */

import { normalizeExtractedText, visibleCharCount } from "./normalize";
import {
  DocumentExtractionError,
  type ExtractedDocument,
  type ExtractionLimits,
} from "./types";

/**
 * Mínimo de caracteres visibles para considerar que el PDF tiene una capa
 * de texto utilizable. Un escaneo típico produce 0; un número de folio o
 * sello suelto produce muy pocos.
 */
const MIN_VISIBLE_CHARS = 40;

type TextItem = { str?: unknown; hasEOL?: unknown };

function isPasswordError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "PasswordException"
  );
}

export async function extractPdfText(
  bytes: Uint8Array,
  limits: ExtractionLimits,
): Promise<ExtractedDocument> {
  if (bytes.byteLength > limits.maxFileBytes) {
    throw new DocumentExtractionError("file_too_large");
  }

  const { getDocumentProxy } = await import("unpdf");

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // PDF.js transfiere/muta el buffer: se le pasa una copia.
    pdf = await getDocumentProxy(new Uint8Array(bytes), {
      enableXfa: false,
      disableAutoFetch: true,
      disableStream: true,
      disableRange: true,
      stopAtErrors: false,
      verbosity: 0,
    });
  } catch (error) {
    if (isPasswordError(error)) {
      throw new DocumentExtractionError("encrypted_file");
    }
    throw new DocumentExtractionError("corrupt_file");
  }

  try {
    const pageCount = pdf.numPages;
    if (pageCount > limits.maxPages) {
      throw new DocumentExtractionError("too_many_pages");
    }

    const pages: string[] = [];
    let rawLength = 0;
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = "";
      for (const item of content.items as TextItem[]) {
        if (typeof item.str === "string") pageText += item.str;
        if (item.hasEOL === true) pageText += "\n";
      }
      page.cleanup();
      pages.push(pageText);
      rawLength += pageText.length;
      // Margen para espacios que la normalización luego recorta.
      if (rawLength > limits.maxChars * 2) {
        throw new DocumentExtractionError("text_too_long");
      }
    }

    const text = normalizeExtractedText(pages.join("\n\n"));
    if (visibleCharCount(text) < MIN_VISIBLE_CHARS) {
      throw new DocumentExtractionError("no_text_layer");
    }
    if (text.length > limits.maxChars) {
      throw new DocumentExtractionError("text_too_long");
    }

    return { sourceType: "pdf", text, pageCount, charCount: text.length };
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error;
    throw new DocumentExtractionError("corrupt_file");
  } finally {
    // Libera el documento y su "worker" en proceso; nunca debe tapar el
    // error original de extracción.
    await pdf.loadingTask.destroy().catch(() => undefined);
  }
}
