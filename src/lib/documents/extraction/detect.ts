/**
 * Detección del tipo real de un archivo subido. No confía en el nombre ni
 * en el MIME declarado por el navegador por separado: la extensión, el MIME
 * declarado y la firma binaria (magic bytes) deben ser coherentes.
 *
 * El nombre del archivo solo se usa para leer su extensión; nunca se usa
 * como ruta ni se persiste (no hay riesgo de path traversal porque nada se
 * escribe en disco).
 */

import { DocumentExtractionError } from "./types";

export type UploadedDocumentType = "docx" | "pdf";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

/**
 * MIME declarados aceptados por tipo. Algunos navegadores/sistemas envían
 * `application/octet-stream` o vacío; en ese caso decide la firma binaria.
 */
const ACCEPTED_DECLARED_MIME: Record<UploadedDocumentType, readonly string[]> = {
  docx: [DOCX_MIME, "application/octet-stream", "application/zip", ""],
  pdf: [PDF_MIME, "application/x-pdf", "application/octet-stream", ""],
};

export const ACCEPTED_UPLOAD_EXTENSIONS = [".docx", ".pdf"] as const;
export const ACCEPTED_UPLOAD_MIME_TYPES = [DOCX_MIME, PDF_MIME] as const;

function extensionOf(fileName: string): string {
  // Solo el último segmento después de cualquier separador de ruta.
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot).toLowerCase() : "";
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // .doc

/**
 * Devuelve el tipo real del archivo o lanza `DocumentExtractionError`:
 * - `unsupported_type`: extensión no permitida (.doc, imágenes, etc.) o
 *   firma de un formato no soportado (p. ej. Word 97-2003).
 * - `mime_mismatch`: extensión, MIME declarado y firma no coinciden.
 */
export function detectUploadedDocumentType(input: {
  fileName: string;
  declaredMime: string;
  bytes: Uint8Array;
}): UploadedDocumentType {
  const extension = extensionOf(input.fileName);
  const declaredMime = input.declaredMime.trim().toLowerCase();

  if (startsWith(input.bytes, OLE_SIGNATURE)) {
    throw new DocumentExtractionError("unsupported_type");
  }

  let type: UploadedDocumentType;
  if (extension === ".pdf") type = "pdf";
  else if (extension === ".docx") type = "docx";
  else throw new DocumentExtractionError("unsupported_type");

  if (!ACCEPTED_DECLARED_MIME[type].includes(declaredMime)) {
    throw new DocumentExtractionError("mime_mismatch");
  }

  const signatureMatches =
    type === "pdf"
      ? startsWith(input.bytes, PDF_SIGNATURE)
      : startsWith(input.bytes, ZIP_SIGNATURE);
  if (!signatureMatches) {
    throw new DocumentExtractionError("mime_mismatch");
  }

  return type;
}
