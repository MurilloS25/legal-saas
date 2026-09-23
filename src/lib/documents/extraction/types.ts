/**
 * Contratos de la capa de extracción de texto de documentos subidos o
 * pegados. Es genérica (no sabe nada de Machotes ni de IA): recibe bytes o
 * texto, aplica límites deterministas y devuelve texto plano normalizado.
 *
 * El texto extraído vive solo en memoria durante la solicitud: esta capa no
 * escribe archivos temporales, no persiste nada y nunca registra contenido.
 */

export const EXTRACTION_SOURCE_TYPES = ["text", "docx", "pdf"] as const;
export type ExtractionSourceType = (typeof EXTRACTION_SOURCE_TYPES)[number];

export const EXTRACTION_ERROR_CODES = [
  "unsupported_type",
  "mime_mismatch",
  "file_too_large",
  "too_many_pages",
  "text_too_long",
  "empty_text",
  "no_text_layer",
  "encrypted_file",
  "corrupt_file",
  "extraction_timeout",
] as const;
export type ExtractionErrorCode = (typeof EXTRACTION_ERROR_CODES)[number];

/**
 * Error tipado de extracción. El mensaje es un código estable, nunca
 * contenido del documento ni detalles del parser, para que pueda
 * registrarse o propagarse sin filtrar texto del archivo.
 */
export class DocumentExtractionError extends Error {
  readonly code: ExtractionErrorCode;

  constructor(code: ExtractionErrorCode) {
    super(`document_extraction_failed:${code}`);
    this.name = "DocumentExtractionError";
    this.code = code;
  }
}

export type ExtractionLimits = {
  /** Tamaño máximo del archivo subido, en bytes. */
  maxFileBytes: number;
  /** Páginas máximas (PDF: exacto; DOCX: metadato `Pages` si existe). */
  maxPages: number;
  /** Caracteres máximos del texto resultante. */
  maxChars: number;
  /** Tope de bytes descomprimidos de `word/document.xml` (anti zip bomb). */
  maxDocxXmlBytes: number;
  /** Entradas máximas del contenedor ZIP de un DOCX. */
  maxZipEntries: number;
  /** Tiempo máximo de extracción de un archivo, en milisegundos. */
  timeoutMs: number;
};

export type ExtractedDocument = {
  sourceType: ExtractionSourceType;
  text: string;
  /** Páginas conocidas del archivo; `null` si el formato no lo informa. */
  pageCount: number | null;
  charCount: number;
};
