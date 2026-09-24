import "server-only";

/**
 * Log operativo de "Crear con IA". Solo acepta campos de una lista cerrada
 * de metadata (ids, proveedor, modelo, tiempos, tokens, tamaños, códigos):
 * no hay forma de pasarle el documento, el texto extraído, el prompt, la
 * respuesta del modelo, errores crudos del proveedor ni secretos.
 */

/**
 * Diagnóstico numérico seguro: tamaños, estimaciones, límites efectivos y el
 * guard que rechazó la solicitud. Nunca contenido.
 */
export type AiGenerationDiagnostics = {
  documentChars: number | null;
  instructionsChars: number | null;
  estimatedInputTokens: number | null;
  maxDocumentChars: number | null;
  maxInputTokens: number | null;
  fileBytes: number | null;
  pages: number | null;
  /** Identificador del guard (p. ej. `extraction:text_too_long`,
   * `input_token_estimate`, `provider:input_rejected`). */
  rejectedBy: string | null;
  /** Tipo de error del proveedor (p. ej. `invalid_request_error`) o
   * origen del timeout (`client_timeout` = AI_TEMPLATE_TIMEOUT_MS de LexCR,
   * `http_408` = el proveedor). */
  providerErrorType: string | null;
  /** Tiempo total esperando al proveedor (todas las llamadas). */
  providerDurationMs: number | null;
  /** true si se hizo el único retry de reparación de la salida. */
  repairAttempted: boolean | null;
  /** Códigos de incidencias de parseo/semántica (solo códigos, nunca
   * contenido), separados por coma, p. ej. `variable_invalid,time_block_incoherent`. */
  issueCodes: string | null;
};

export type AiGenerationLogEntry = AiGenerationDiagnostics & {
  outcome: "succeeded" | "failed" | "rejected";
  errorCode: string | null;
  userId: string;
  workspaceId: string;
  provider: string;
  model: string;
  sourceType: "text" | "docx" | "pdf" | null;
  inputChars: number | null;
  durationMs: number;
  attempts: number;
  inputTokens: number | null;
  outputTokens: number | null;
  providerErrorKind: string | null;
  providerHttpStatus: number | null;
};

export type AiGenerationLogger = (entry: AiGenerationLogEntry) => void;

const ALLOWED_KEYS: ReadonlyArray<keyof AiGenerationLogEntry> = [
  "outcome",
  "errorCode",
  "userId",
  "workspaceId",
  "provider",
  "model",
  "sourceType",
  "inputChars",
  "durationMs",
  "attempts",
  "inputTokens",
  "outputTokens",
  "providerErrorKind",
  "providerHttpStatus",
  "providerErrorType",
  "rejectedBy",
  "documentChars",
  "instructionsChars",
  "estimatedInputTokens",
  "maxDocumentChars",
  "maxInputTokens",
  "fileBytes",
  "pages",
  "providerDurationMs",
  "repairAttempted",
  "issueCodes",
];

/** Serializa solo las claves permitidas (defensa ante objetos ampliados). */
export function serializeAiGenerationLog(entry: AiGenerationLogEntry): string {
  const safe: Record<string, unknown> = { event: "ai_template_generation" };
  for (const key of ALLOWED_KEYS) safe[key] = entry[key];
  return JSON.stringify(safe);
}

export const consoleAiGenerationLogger: AiGenerationLogger = (entry) => {
  const line = serializeAiGenerationLog(entry);
  if (entry.outcome === "succeeded") console.info(line);
  else console.warn(line);
};
