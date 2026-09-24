import "server-only";

/**
 * Abstracción de proveedor de IA para generar Machotes.
 *
 * Interfaz orientada al DOMINIO: no expone nombres, objetos de respuesta,
 * formatos de tool calling ni identificadores de ningún SDK. Cada adapter
 * (OpenAI hoy; Anthropic u otro mañana) traduce su API a este contrato.
 *
 * Mínimo privilegio: el contrato no tiene herramientas, callbacks ni acceso
 * a nada fuera del texto del documento y las indicaciones. Un adapter recibe
 * texto y devuelve texto (JSON crudo); el parseo, la validación y cualquier
 * escritura en base de datos ocurren FUERA del adapter, en LexCR.
 */

export type TemplateGenerationRequest = {
  /** Párrafos del texto extraído; el prompt los numera desde 1. */
  paragraphs: string[];
  /** Indicaciones opcionales del abogado ("Variantes del documento"). */
  variantInstructions: string | null;
  /**
   * Solo en el ÚNICO retry de reparación: la salida anterior del propio
   * modelo (si era JSON utilizable) y las incidencias que LexCR encontró
   * (códigos y rutas estructurales, nunca texto nuevo). Se pide corregir
   * esas incidencias, no rehacer el análisis.
   */
  repair?: { previousOutput: string | null; issues: string[] } | null;
};

export type TemplateGenerationResult = {
  /** JSON crudo devuelto por el modelo; se valida en LexCR. */
  rawOutput: string;
  usage: { inputTokens: number | null; outputTokens: number | null };
};

export const AI_PROVIDER_ERROR_KINDS = [
  "unavailable",
  "misconfigured",
  "timeout",
  "rate_limited",
  "refused",
  /** El proveedor indicó explícitamente que la entrada excede su límite. */
  "input_too_large",
  /** El proveedor rechazó la solicitud (400) por otro motivo: configuración
   * de la cuenta, parámetros o schema. NO significa que el documento sea
   * demasiado largo. */
  "input_rejected",
  "invalid_output",
] as const;
export type AiProviderErrorKind = (typeof AI_PROVIDER_ERROR_KINDS)[number];

/**
 * Error normalizado de proveedor. Nunca lleva el cuerpo de la respuesta del
 * proveedor, cabeceras, IDs de request ni la API key: solo una categoría,
 * si es recuperable con un retry técnico y el estado HTTP (si hubo).
 */
export class AiProviderError extends Error {
  readonly kind: AiProviderErrorKind;
  readonly retryable: boolean;
  readonly httpStatus: number | null;
  /** true si el proveedor seguramente no facturó (p. ej. no alcanzable). */
  readonly billable: boolean;
  /** Código de tipo de error del proveedor (p. ej. `invalid_request_error`),
   * solo si es un identificador seguro; nunca su mensaje. Para diagnóstico. */
  readonly providerErrorType: string | null;

  constructor(
    kind: AiProviderErrorKind,
    options: {
      retryable: boolean;
      httpStatus?: number | null;
      billable?: boolean;
      providerErrorType?: unknown;
    },
  ) {
    super(`ai_provider_error:${kind}`);
    this.name = "AiProviderError";
    this.kind = kind;
    this.retryable = options.retryable;
    this.httpStatus = options.httpStatus ?? null;
    this.billable = options.billable ?? true;
    this.providerErrorType =
      typeof options.providerErrorType === "string" &&
      /^[a-z_]{1,60}$/.test(options.providerErrorType)
        ? options.providerErrorType
        : null;
  }
}

export interface AiTemplateProvider {
  /** Identificador estable del proveedor para trazabilidad (`openai`). */
  readonly id: string;
  /** Modelo configurado (viene de variables de entorno, nunca hardcodeado). */
  readonly model: string;
  generateTemplate(
    request: TemplateGenerationRequest,
  ): Promise<TemplateGenerationResult>;
}
