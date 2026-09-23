import "server-only";

import type { AiTemplateConfig } from "../config";
import type { AiTemplateProvider } from "../provider";
import { createAnthropicTemplateProvider } from "./anthropic";
import { createFakeTemplateProvider } from "./fake";
import { createOpenAiTemplateProvider } from "./openai";

/**
 * Único punto donde se elige el adapter. El resto de la feature solo
 * conoce `AiTemplateProvider`.
 */
export function createAiTemplateProvider(config: AiTemplateConfig): AiTemplateProvider {
  switch (config.provider) {
    case "openai":
      if (!config.apiKey) throw new Error("ai_provider_misconfigured");
      return createOpenAiTemplateProvider({
        apiKey: config.apiKey,
        model: config.model,
        timeoutMs: config.providerTimeoutMs,
        maxOutputTokens: config.maxOutputTokens,
      });
    case "anthropic":
      if (!config.apiKey) throw new Error("ai_provider_misconfigured");
      return createAnthropicTemplateProvider({
        apiKey: config.apiKey,
        model: config.model,
        timeoutMs: config.providerTimeoutMs,
        maxOutputTokens: config.maxOutputTokens,
        workspaceId: config.workspaceId,
        effort: config.anthropicEffort,
      });
    case "fake":
      return createFakeTemplateProvider({ delayMs: 600 });
  }
}
