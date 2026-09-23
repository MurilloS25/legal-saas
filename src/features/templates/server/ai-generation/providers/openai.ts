import "server-only";

/**
 * Adapter de OpenAI (Responses API, `POST /v1/responses`) con salida
 * estructurada estricta (`text.format.type = "json_schema"`, `strict`).
 *
 * Se usa `fetch` directo en lugar del SDK: la integración es una sola
 * llamada HTTP, así se evita una dependencia nueva y se controla con
 * precisión qué se envía. Decisiones de seguridad/privacidad:
 *
 * - sin `tools`: el modelo no puede llamar funciones de ningún tipo;
 * - `store: false`: la respuesta no se guarda como objeto reutilizable en
 *   la cuenta del proveedor (la retención propia del proveedor para abuso
 *   se rige por sus políticas; LexCR no afirma más de lo que controla);
 * - no se envían IDs de usuario/Workspace ni metadata;
 * - timeout con AbortController;
 * - los errores se normalizan a `AiProviderError` sin cuerpo, cabeceras ni
 *   request IDs del proveedor.
 *
 * El modelo viene SIEMPRE de configuración (`OPENAI_MODEL`).
 */

import { AI_TEMPLATE_PROPOSAL_JSON_SCHEMA } from "../../../model/ai-generation/proposal";
import { buildTemplateGenerationPrompt } from "../prompt";
import {
  AiProviderError,
  type AiTemplateProvider,
  type TemplateGenerationRequest,
  type TemplateGenerationResult,
} from "../provider";

export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export type OpenAiProviderConfig = {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
};

type ResponsesContentPart = {
  type?: unknown;
  text?: unknown;
  refusal?: unknown;
};
type ResponsesOutputItem = { type?: unknown; content?: unknown };
type ResponsesBody = {
  status?: unknown;
  incomplete_details?: { reason?: unknown } | null;
  output?: unknown;
  usage?: { input_tokens?: unknown; output_tokens?: unknown } | null;
  error?: { code?: unknown } | null;
};

function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

/** Construye el cuerpo de la request. Exportada para pruebas. */
export function buildOpenAiRequestBody(
  config: Pick<OpenAiProviderConfig, "model" | "maxOutputTokens">,
  request: TemplateGenerationRequest,
) {
  const prompt = buildTemplateGenerationPrompt(request);
  return {
    model: config.model,
    instructions: prompt.system,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt.user }],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "lexcr_template_proposal",
        schema: AI_TEMPLATE_PROPOSAL_JSON_SCHEMA,
        strict: true,
      },
    },
    max_output_tokens: config.maxOutputTokens,
    store: false,
  };
}

function errorFromStatus(status: number, body: ResponsesBody | null): AiProviderError {
  if (status === 401 || status === 403) {
    return new AiProviderError("misconfigured", { retryable: false, httpStatus: status, billable: false });
  }
  if (status === 429) {
    return new AiProviderError("rate_limited", { retryable: false, httpStatus: status, billable: false });
  }
  if (status === 408) {
    return new AiProviderError("timeout", { retryable: true, httpStatus: status });
  }
  if (status >= 500) {
    return new AiProviderError("unavailable", { retryable: true, httpStatus: status, billable: false });
  }
  const code = typeof body?.error?.code === "string" ? body.error.code : "";
  if (code === "context_length_exceeded") {
    return new AiProviderError("input_rejected", { retryable: false, httpStatus: status, billable: false });
  }
  if (status === 404) {
    // Modelo inexistente o sin acceso: configuración, no culpa del usuario.
    return new AiProviderError("misconfigured", { retryable: false, httpStatus: status, billable: false });
  }
  return new AiProviderError("input_rejected", { retryable: false, httpStatus: status, billable: false });
}

/** Mapea el cuerpo de una respuesta 200 al contrato de dominio. */
export function mapOpenAiResponse(body: ResponsesBody): TemplateGenerationResult {
  const usage = {
    inputTokens: tokenCount(body.usage?.input_tokens),
    outputTokens: tokenCount(body.usage?.output_tokens),
  };

  if (body.status === "incomplete") {
    const reason = body.incomplete_details?.reason;
    if (reason === "content_filter") {
      throw new AiProviderError("refused", { retryable: false });
    }
    // Truncado por max_output_tokens: repetir daría el mismo resultado.
    throw new AiProviderError("invalid_output", { retryable: false });
  }
  if (body.status !== undefined && body.status !== "completed") {
    throw new AiProviderError("unavailable", { retryable: true });
  }

  const items = Array.isArray(body.output) ? (body.output as ResponsesOutputItem[]) : [];
  let text = "";
  for (const item of items) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content as ResponsesContentPart[]) {
      if (part.type === "refusal") {
        throw new AiProviderError("refused", { retryable: false });
      }
      if (part.type === "output_text" && typeof part.text === "string") {
        text += part.text;
      }
    }
  }
  if (text.trim() === "") {
    throw new AiProviderError("invalid_output", { retryable: true });
  }
  return { rawOutput: text, usage };
}

export function createOpenAiTemplateProvider(
  config: OpenAiProviderConfig,
  fetchImpl: typeof fetch = fetch,
): AiTemplateProvider {
  return {
    id: "openai",
    model: config.model,
    async generateTemplate(request) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(OPENAI_RESPONSES_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildOpenAiRequestBody(config, request)),
          signal: controller.signal,
          cache: "no-store",
        });
      } catch {
        clearTimeout(timer);
        if (controller.signal.aborted) {
          throw new AiProviderError("timeout", { retryable: true });
        }
        throw new AiProviderError("unavailable", { retryable: true, billable: false });
      }

      try {
        let body: ResponsesBody | null = null;
        try {
          body = (await response.json()) as ResponsesBody;
        } catch {
          body = null;
        }
        if (!response.ok) throw errorFromStatus(response.status, body);
        if (!body || typeof body !== "object") {
          throw new AiProviderError("invalid_output", { retryable: true });
        }
        return mapOpenAiResponse(body);
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        if (controller.signal.aborted) {
          throw new AiProviderError("timeout", { retryable: true });
        }
        throw new AiProviderError("unavailable", { retryable: true });
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
