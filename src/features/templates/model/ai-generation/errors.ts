/**
 * Códigos de error de "Crear con IA" y sus mensajes para la persona.
 * Client-safe. Los mensajes nunca incluyen detalles del proveedor, trazas,
 * identificadores de request, prompts ni contenido del documento.
 */

export const AI_GENERATION_ERROR_CODES = [
  "not_configured",
  "unauthorized",
  "forbidden",
  "quota_exceeded",
  "generation_in_progress",
  "consent_required",
  "invalid_input",
  "instructions_too_long",
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
  "provider_unavailable",
  "provider_timeout",
  "provider_rate_limited",
  "provider_refused",
  "invalid_output",
  "no_variables",
  "internal_error",
] as const;
export type AiGenerationErrorCode = (typeof AI_GENERATION_ERROR_CODES)[number];

export const AI_GENERATION_ERROR_MESSAGES: Record<AiGenerationErrorCode, string> = {
  not_configured:
    "La creación con IA no está disponible en este momento. Puedes crear el machote manualmente.",
  unauthorized: "Tu sesión expiró. Inicia sesión de nuevo.",
  forbidden: "No tienes permiso para crear machotes en este despacho.",
  quota_exceeded:
    "Alcanzaste el límite diario de generaciones con IA. Podrás intentarlo de nuevo mañana o crear el machote manualmente.",
  generation_in_progress:
    "Ya hay una generación con IA en curso. Espera a que termine antes de iniciar otra.",
  consent_required:
    "Confirma que entiendes cómo se procesará el documento antes de continuar.",
  invalid_input: "Pega el texto del documento o adjunta un único archivo.",
  instructions_too_long: "Las indicaciones sobre variantes son demasiado largas.",
  unsupported_type:
    "Formato no admitido. Usa un archivo .docx o un PDF con texto seleccionable.",
  mime_mismatch:
    "El archivo no corresponde a su extensión o está dañado. Usa un .docx o un PDF válido.",
  file_too_large: "El archivo es demasiado grande.",
  too_many_pages: "El documento tiene demasiadas páginas.",
  text_too_long: "El texto del documento es demasiado largo.",
  empty_text: "El documento no contiene texto.",
  no_text_layer:
    "El PDF no contiene texto seleccionable (parece escaneado). LexCR no aplica OCR: usa un PDF con texto o un .docx.",
  encrypted_file: "El PDF está protegido con contraseña.",
  corrupt_file: "No fue posible leer el archivo. Verifica que no esté dañado.",
  extraction_timeout: "El archivo tardó demasiado en procesarse.",
  provider_unavailable:
    "El servicio de IA no está disponible en este momento. Intenta más tarde o crea el machote manualmente.",
  provider_timeout:
    "El servicio de IA tardó demasiado en responder. Intenta de nuevo más tarde.",
  provider_rate_limited:
    "El servicio de IA está recibiendo demasiadas solicitudes. Intenta de nuevo en unos minutos.",
  provider_refused: "El servicio de IA no pudo procesar este documento.",
  invalid_output:
    "La IA devolvió una propuesta que LexCR no pudo validar. No se creó ningún machote. Puedes intentarlo de nuevo.",
  no_variables:
    "No se detectaron datos variables en el documento. No se creó ningún machote.",
  internal_error: "Ocurrió un error inesperado. No se creó ningún machote.",
};

export function aiGenerationErrorMessage(code: string): string {
  return (
    AI_GENERATION_ERROR_MESSAGES[code as AiGenerationErrorCode] ??
    AI_GENERATION_ERROR_MESSAGES.internal_error
  );
}

/** Estado HTTP de cada código, para el Route Handler. */
export const AI_GENERATION_ERROR_STATUS: Record<AiGenerationErrorCode, number> = {
  not_configured: 503,
  unauthorized: 401,
  forbidden: 403,
  quota_exceeded: 429,
  generation_in_progress: 409,
  consent_required: 400,
  invalid_input: 400,
  instructions_too_long: 400,
  unsupported_type: 415,
  mime_mismatch: 415,
  file_too_large: 413,
  too_many_pages: 422,
  text_too_long: 413,
  empty_text: 422,
  no_text_layer: 422,
  encrypted_file: 422,
  corrupt_file: 422,
  extraction_timeout: 422,
  provider_unavailable: 503,
  provider_timeout: 504,
  provider_rate_limited: 503,
  provider_refused: 422,
  invalid_output: 502,
  no_variables: 422,
  internal_error: 500,
};
