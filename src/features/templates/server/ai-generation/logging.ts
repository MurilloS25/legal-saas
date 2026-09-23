import "server-only";

/**
 * Log operativo de "Crear con IA". Solo acepta campos de una lista cerrada
 * de metadata (ids, proveedor, modelo, tiempos, tokens, tamaños, códigos):
 * no hay forma de pasarle el documento, el texto extraído, el prompt, la
 * respuesta del modelo, errores crudos del proveedor ni secretos.
 */

export type AiGenerationLogEntry = {
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
