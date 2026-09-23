import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { TemplateIdSchema } from "../../model/templates";
import { AI_TEMPLATE_DEFAULTS } from "../../model/ai-generation/limits";
import { readAiTemplateConfig } from "./config";

export type AiTemplateGenerationAvailability = {
  available: boolean;
  /** Límites para ayudas de la UI (la validación real es server-side). */
  maxFileBytes: number;
  maxPages: number;
  maxPastedChars: number;
  maxVariantInstructionsChars: number;
};

/** Solo expone disponibilidad y límites: nunca proveedor, modelo ni claves. */
export function getAiTemplateGenerationAvailability(): AiTemplateGenerationAvailability {
  const result = readAiTemplateConfig();
  if (!result.available) {
    return {
      available: false,
      maxFileBytes: AI_TEMPLATE_DEFAULTS.maxFileBytes,
      maxPages: AI_TEMPLATE_DEFAULTS.maxPages,
      maxPastedChars: AI_TEMPLATE_DEFAULTS.maxPastedChars,
      maxVariantInstructionsChars: AI_TEMPLATE_DEFAULTS.maxVariantInstructionsChars,
    };
  }
  const { config } = result;
  return {
    available: true,
    maxFileBytes: config.maxFileBytes,
    maxPages: config.maxPages,
    maxPastedChars: config.maxPastedChars,
    maxVariantInstructionsChars: config.maxVariantInstructionsChars,
  };
}

export type TemplateAiGenerationInfo = {
  generatedAt: string;
  provider: string;
  model: string;
  reviewKeys: string[];
};

function stringArray(value: unknown, max: number): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, max)
    : [];
}

/**
 * Metadata de la generación con IA de un Machote (si la hubo), leída con
 * la sesión del usuario (RLS por Workspace). Se usa para la advertencia
 * persistente en el workspace del Machote.
 */
export async function getTemplateAiGenerationInfo(
  templateId: string,
): Promise<TemplateAiGenerationInfo | null> {
  if (!TemplateIdSchema.safeParse(templateId).success) return null;
  const { supabase, workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from("ai_template_generations")
    .select("finished_at, provider, model, review_summary")
    .eq("template_id", templateId)
    .eq("workspace_id", workspaceId)
    .eq("status", "succeeded")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // La advertencia es informativa: un error de lectura no rompe la página.
  if (error || !data || !data.finished_at) return null;
  const summary =
    data.review_summary && typeof data.review_summary === "object" && !Array.isArray(data.review_summary)
      ? (data.review_summary as Record<string, unknown>)
      : {};
  return {
    generatedAt: data.finished_at,
    provider: data.provider,
    model: data.model,
    reviewKeys: stringArray(summary.reviewKeys, 50),
  };
}
