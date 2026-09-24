/**
 * Límites por defecto de "Crear con IA". Puros y client-safe: la UI los usa
 * para ayudas y validación temprana; el servidor los usa como valores por
 * defecto y los puede ajustar por variables de entorno (ver
 * `server/ai-generation/config.ts`). La validación autoritativa siempre es
 * la del servidor.
 */

export const AI_TEMPLATE_DEFAULTS = {
  /** 10 MB (decimal). Vercel limita además el cuerpo de la request. */
  maxFileBytes: 10_000_000,
  /** Páginas máximas de un archivo. */
  maxPages: 5,
  /** Texto pegado: ~3 páginas de escritura (~4.000 caracteres/página). */
  maxPastedChars: 12_000,
  /** Texto extraído de un archivo: ~5 páginas. */
  maxExtractedChars: 20_000,
  /** Campo "Variantes del documento". */
  maxVariantInstructionsChars: 1_000,
  /** Generaciones por usuario y día (hora de Costa Rica). */
  dailyLimitPerUser: 2,
  /** Timeout de cada llamada al proveedor. */
  providerTimeoutMs: 120_000,
  /** Timeout de extracción de un archivo. */
  extractionTimeoutMs: 15_000,
  /** Tope de tokens de salida pedidos al proveedor. */
  maxOutputTokens: 24_000,
} as const;

/**
 * Tokens de entrada estimados (heurística conservadora: ~3,5 caracteres por
 * token en español). Solo se usa como control de costo adicional al límite
 * de caracteres; el conteo real lo informa el proveedor.
 */
export function estimateInputTokens(chars: number): number {
  return Math.ceil(chars / 3.5);
}

/** Límites estructurales de la propuesta devuelta por el modelo. */
export const AI_PROPOSAL_LIMITS = {
  maxVariables: 150,
  maxOccurrencesPerVariable: 60,
  maxOptionBlocks: 10,
  maxAlternativeVariants: 4,
  maxVariantContentChars: 600,
  maxLabelChars: 120,
  maxNameChars: 120,
  maxDescriptionChars: 300,
  maxOccurrenceTextChars: 300,
  maxBlockSpanChars: 600,
  maxWarnings: 20,
  maxPartyKeys: 10,
  maxIdentificationTypes: 10,
  /** Tope del JSON crudo devuelto por el proveedor antes de parsearlo. */
  maxRawOutputChars: 400_000,
} as const;
