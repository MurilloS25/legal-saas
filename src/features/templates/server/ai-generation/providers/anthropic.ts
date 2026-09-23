import "server-only";

/**
 * Adapter de Anthropic (Claude Messages API, `POST /v1/messages`) con salida
 * estructurada (`output_config.format = { type: "json_schema" }`, GA, sin
 * header beta). Usa el SDK oficial `@anthropic-ai/sdk` para tener errores
 * tipados; sus reintentos automáticos se desactivan (`maxRetries: 0`)
 * porque el único retry técnico lo decide `runTemplateGeneration`.
 *
 * Decisiones de seguridad/privacidad (equivalentes al adapter de OpenAI):
 * - sin `tools` ni `tool_choice`: el modelo no puede llamar funciones;
 * - sin `metadata`, sin IDs de usuario/Workspace;
 * - el mismo prompt neutral (`buildTemplateGenerationPrompt`): reglas en
 *   `system`, documento e indicaciones no confiables en el mensaje `user`;
 * - la Messages API es sin estado y no tiene un flag `store` por request: la
 *   retención del lado de Anthropic la define la configuración de la
 *   organización (p. ej. Zero Data Retention); LexCR no afirma más;
 * - timeout por llamada con la misma configuración (`AI_TEMPLATE_TIMEOUT_MS`);
 * - errores normalizados a `AiProviderError`, sin cuerpo, cabeceras ni
 *   request IDs del proveedor.
 *
 * El modelo viene SIEMPRE de configuración (`ANTHROPIC_MODEL`).
 *
 * Diferencia con OpenAI: la salida estructurada de Anthropic no admite
 * `pattern` ni uniones de tipo (`["string", "null"]`). Se envía una copia del
 * MISMO schema `lexcr.template_generation.v1` adaptada a esas limitaciones
 * (`toAnthropicJsonSchema`); la validación Zod server-side sigue aplicando el
 * contrato completo, incluidos los patrones de clave.
 */

import Anthropic from "@anthropic-ai/sdk";
import { AI_TEMPLATE_PROPOSAL_JSON_SCHEMA } from "../../../model/ai-generation/proposal";
import { buildTemplateGenerationPrompt } from "../prompt";
import {
  AiProviderError,
  type AiTemplateProvider,
  type TemplateGenerationRequest,
  type TemplateGenerationResult,
} from "../provider";

export const ANTHROPIC_EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type AnthropicEffort = (typeof ANTHROPIC_EFFORT_LEVELS)[number];

export type AnthropicProviderConfig = {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  /** Esfuerzo/razonamiento del modelo. `null` omite el parámetro (modelos
   * sin soporte de effort). Default de LexCR: `low` — la tarea es de
   * extracción estructurada; ver docs/AI_TEMPLATE_GENERATION.md §3.3. */
  effort?: AnthropicEffort | null;
  /** Solo para API keys de organización no asociadas a un workspace:
   * se envía como cabecera `anthropic-workspace-id`. */
  workspaceId?: string | null;
};

type JsonSchemaNode = Record<string, unknown>;

/**
 * Adapta un JSON Schema a las limitaciones documentadas de la salida
 * estructurada de Anthropic, sin cambiar su forma:
 * - elimina `pattern` (no soportado; Zod lo valida después);
 * - convierte `type: [T, "null"]` en `anyOf: [{ type: T, ... }, { type: "null" }]`.
 * Exportada para pruebas.
 */
export function toAnthropicJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toAnthropicJsonSchema);
  if (node === null || typeof node !== "object") return node;

  const source = node as JsonSchemaNode;
  const out: JsonSchemaNode = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "pattern") continue;
    out[key] = toAnthropicJsonSchema(value);
  }

  if (Array.isArray(out.type)) {
    const types = out.type as unknown[];
    const { type: _type, ...rest } = out;
    void _type;
    return {
      anyOf: types.map((type) =>
        type === "null" ? { type: "null" } : { ...rest, type },
      ),
    };
  }
  return out;
}

export const ANTHROPIC_TEMPLATE_PROPOSAL_SCHEMA = toAnthropicJsonSchema(
  AI_TEMPLATE_PROPOSAL_JSON_SCHEMA,
) as JsonSchemaNode;

/** Construye el cuerpo de la request. Exportada para pruebas. */
export function buildAnthropicRequestBody(
  config: Pick<AnthropicProviderConfig, "model" | "maxOutputTokens" | "workspaceId" | "effort">,
  request: TemplateGenerationRequest,
): Anthropic.MessageCreateParamsNonStreaming {
  const prompt = buildTemplateGenerationPrompt(request);
  return {
    // El SDK lo retira del cuerpo y lo envía como cabecera.
    ...(config.workspaceId ? { workspace_id: config.workspaceId } : {}),
    model: config.model,
    max_tokens: config.maxOutputTokens,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
    output_config: {
      format: { type: "json_schema", schema: ANTHROPIC_TEMPLATE_PROPOSAL_SCHEMA },
      ...(config.effort !== null ? { effort: config.effort ?? "low" } : {}),
    },
  };
}

/** Mapea una respuesta exitosa al contrato de dominio. */
export function mapAnthropicMessage(message: {
  stop_reason?: string | null;
  content?: ReadonlyArray<{ type: string; text?: unknown }>;
  usage?: { input_tokens?: unknown; output_tokens?: unknown } | null;
}): TemplateGenerationResult {
  if (message.stop_reason === "refusal") {
    throw new AiProviderError("refused", { retryable: false });
  }
  if (message.stop_reason === "max_tokens") {
    // Salida truncada: repetir daría el mismo resultado.
    throw new AiProviderError("invalid_output", { retryable: false });
  }

  // Solo bloques de texto: bloques `thinking` (razonamiento) se ignoran y
  // nunca se registran ni se muestran.
  let text = "";
  for (const block of message.content ?? []) {
    if (block.type === "text" && typeof block.text === "string") text += block.text;
  }
  if (text.trim() === "") {
    throw new AiProviderError("invalid_output", { retryable: true });
  }

  const count = (value: unknown) =>
    typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
  return {
    rawOutput: text,
    usage: {
      inputTokens: count(message.usage?.input_tokens),
      outputTokens: count(message.usage?.output_tokens),
    },
  };
}

/** Normaliza errores del SDK sin conservar su mensaje ni su cuerpo. */
export function anthropicErrorToProviderError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  // Timeout propio: el SDK aborta la solicitud al cumplirse
  // AI_TEMPLATE_TIMEOUT_MS. Anthropic pudo haber procesado (y facturado) la
  // generación: no se reintenta, para no duplicar costo.
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AiProviderError("timeout", { retryable: false, providerErrorType: "client_timeout" });
  }
  if (error instanceof Anthropic.APIUserAbortError) {
    return new AiProviderError("timeout", { retryable: false, providerErrorType: "client_abort" });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AiProviderError("unavailable", { retryable: true, billable: false });
  }
  if (error instanceof Anthropic.APIError) {
    const status = typeof error.status === "number" ? error.status : null;
    // Solo el TIPO de error (identificador), nunca su mensaje.
    const body = error.error as { error?: { type?: unknown } } | undefined;
    const providerErrorType = body?.error?.type;
    if (status === 429) {
      return new AiProviderError("rate_limited", { retryable: false, httpStatus: status, billable: false, providerErrorType });
    }
    if (status === 401 || status === 402 || status === 403 || status === 404) {
      // Clave inválida, sin saldo, sin permiso o modelo inexistente:
      // configuración, no culpa del usuario.
      return new AiProviderError("misconfigured", { retryable: false, httpStatus: status, billable: false, providerErrorType });
    }
    if (status === 408) {
      return new AiProviderError("timeout", { retryable: false, httpStatus: status, providerErrorType: "http_408" });
    }
    if (status !== null && status >= 500) {
      // 500 api_error y 529 overloaded_error.
      return new AiProviderError("unavailable", { retryable: true, httpStatus: status, billable: false, providerErrorType });
    }
    if (status === 413) {
      return new AiProviderError("input_too_large", { retryable: false, httpStatus: status, billable: false, providerErrorType });
    }
    // 400 invalid_request_error y otros 4xx: la solicitud fue rechazada por
    // configuración de la cuenta, parámetros o schema — NO por el tamaño del
    // documento (p. ej. API key de organización sin workspace).
    return new AiProviderError("input_rejected", { retryable: false, httpStatus: status, billable: false, providerErrorType });
  }
  return new AiProviderError("unavailable", { retryable: false });
}

export function createAnthropicTemplateProvider(
  config: AnthropicProviderConfig,
  options: { fetch?: typeof fetch } = {},
): AiTemplateProvider {
  const client = new Anthropic({
    apiKey: config.apiKey,
    // Evita que el SDK use ANTHROPIC_AUTH_TOKEN u otra credencial ambiental.
    authToken: null,
    maxRetries: 0,
    timeout: config.timeoutMs,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });

  return {
    id: "anthropic",
    model: config.model,
    async generateTemplate(request) {
      try {
        const message = await client.messages.create(
          buildAnthropicRequestBody(config, request),
          { timeout: config.timeoutMs, maxRetries: 0 },
        );
        return mapAnthropicMessage(message);
      } catch (error) {
        throw anthropicErrorToProviderError(error);
      }
    },
  };
}
