import "server-only";

/**
 * Configuración server-only de "Crear con IA", leída de variables de
 * entorno SIN prefijo `NEXT_PUBLIC_` (nunca llegan al navegador).
 *
 *   AI_PROVIDER=openai            # proveedor activo; vacío = feature apagada
 *   OPENAI_API_KEY=...            # secreto; solo servidor
 *   OPENAI_MODEL=...              # obligatorio; no hay modelo por defecto
 *   AI_TEMPLATE_MAX_FILE_BYTES=   # opcional, <= 10 MB
 *   AI_TEMPLATE_MAX_PAGES=        # opcional, <= 5
 *   AI_TEMPLATE_DAILY_LIMIT=      # opcional, default 2 por usuario/día
 *   AI_TEMPLATE_TIMEOUT_MS=       # opcional, timeout por llamada al proveedor
 *
 * La cuota se registra con la service role (RPCs que el usuario no puede
 * invocar), así que también se requiere `SUPABASE_SERVICE_ROLE_KEY`.
 *
 * Si falta algo, la feature queda "no disponible" de forma controlada y el
 * resto de Machotes (creación manual incluida) sigue funcionando.
 *
 * Para agregar Anthropic u otro proveedor: añadir su id a
 * `SUPPORTED_PROVIDERS`, leer sus variables aquí y crear su adapter en
 * `providers/`. Nada fuera de esta carpeta cambia.
 */

import { AI_TEMPLATE_DEFAULTS } from "../../model/ai-generation/limits";

export const SUPPORTED_PROVIDERS = ["openai", "fake"] as const;
export type AiProviderId = (typeof SUPPORTED_PROVIDERS)[number];

export type AiTemplateConfig = {
  provider: AiProviderId;
  model: string;
  apiKey: string | null;
  maxFileBytes: number;
  maxPages: number;
  maxPastedChars: number;
  maxExtractedChars: number;
  maxVariantInstructionsChars: number;
  dailyLimitPerUser: number;
  providerTimeoutMs: number;
  extractionTimeoutMs: number;
  maxOutputTokens: number;
};

export type AiTemplateConfigResult =
  | { available: true; config: AiTemplateConfig }
  | { available: false; reason: "disabled" | "missing_credentials" | "invalid" };

type Env = Record<string, string | undefined>;

function boundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (raw === undefined || raw.trim() === "") return fallback;
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return value >= min && value <= max ? value : null;
}

export function readAiTemplateConfig(env: Env = process.env): AiTemplateConfigResult {
  const provider = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (provider === "") return { available: false, reason: "disabled" };
  if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(provider)) {
    return { available: false, reason: "invalid" };
  }
  // El proveedor simulado jamás en producción (incluye Vercel Preview).
  if (provider === "fake" && env.NODE_ENV === "production") {
    return { available: false, reason: "invalid" };
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.NEXT_PUBLIC_SUPABASE_URL) {
    return { available: false, reason: "missing_credentials" };
  }

  let model: string;
  let apiKey: string | null = null;
  if (provider === "openai") {
    apiKey = env.OPENAI_API_KEY?.trim() || null;
    model = env.OPENAI_MODEL?.trim() ?? "";
    if (!apiKey || model === "") {
      return { available: false, reason: "missing_credentials" };
    }
    if (!/^[A-Za-z0-9._:-]{1,120}$/.test(model)) {
      return { available: false, reason: "invalid" };
    }
  } else {
    model = "fake-deterministic";
  }

  const maxFileBytes = boundedInt(
    env.AI_TEMPLATE_MAX_FILE_BYTES,
    AI_TEMPLATE_DEFAULTS.maxFileBytes,
    1_000,
    AI_TEMPLATE_DEFAULTS.maxFileBytes,
  );
  const maxPages = boundedInt(env.AI_TEMPLATE_MAX_PAGES, AI_TEMPLATE_DEFAULTS.maxPages, 1, AI_TEMPLATE_DEFAULTS.maxPages);
  const dailyLimit = boundedInt(
    env.AI_TEMPLATE_DAILY_LIMIT,
    AI_TEMPLATE_DEFAULTS.dailyLimitPerUser,
    0,
    1000,
  );
  const timeoutMs = boundedInt(
    env.AI_TEMPLATE_TIMEOUT_MS,
    AI_TEMPLATE_DEFAULTS.providerTimeoutMs,
    5_000,
    240_000,
  );
  if (maxFileBytes === null || maxPages === null || dailyLimit === null || timeoutMs === null) {
    return { available: false, reason: "invalid" };
  }

  return {
    available: true,
    config: {
      provider: provider as AiProviderId,
      model,
      apiKey,
      maxFileBytes,
      maxPages,
      maxPastedChars: AI_TEMPLATE_DEFAULTS.maxPastedChars,
      // Proporcional a las páginas permitidas (~4.000 caracteres por página).
      maxExtractedChars: Math.min(AI_TEMPLATE_DEFAULTS.maxExtractedChars, maxPages * 4_000),
      maxVariantInstructionsChars: AI_TEMPLATE_DEFAULTS.maxVariantInstructionsChars,
      dailyLimitPerUser: dailyLimit,
      providerTimeoutMs: timeoutMs,
      extractionTimeoutMs: AI_TEMPLATE_DEFAULTS.extractionTimeoutMs,
      maxOutputTokens: AI_TEMPLATE_DEFAULTS.maxOutputTokens,
    },
  };
}
