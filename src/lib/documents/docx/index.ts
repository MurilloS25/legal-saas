/**
 * API pública server-only de la exportación de escrituras a `.docx`.
 * Debe importarse solo desde código de servidor (Route Handlers), nunca
 * desde Client Components.
 */

export { buildEscrituraDocx } from "./document";
export type { EscrituraDocxInput, EscrituraDocxResult } from "./document";
export { generateDocumentDocx, DocxGenerationError } from "./generate";
export type { DocxErrorCode } from "./generate";
export { buildDocxFilename } from "./filename";
export { DOCX_LIMITS } from "./limits";
export { DOCX_MIME, contentDispositionAttachment } from "./http";
