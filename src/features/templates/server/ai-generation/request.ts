import "server-only";

/**
 * Entrada HTTP-agnóstica de "Crear con IA": recibe el FormData ya leído y
 * el contexto autenticado (resuelto por el Route Handler con la sesión del
 * usuario) y ejecuta la generación con las dependencias reales.
 *
 * Campos del formulario (todo lo demás se ignora):
 * - `source_kind`: "text" | "file";
 * - `text`: texto pegado (si `source_kind=text`);
 * - `file`: un único archivo (si `source_kind=file`);
 * - `variant_instructions`: "Variantes del documento" (opcional);
 * - `consent`: "on" si la persona aceptó el aviso de procesamiento.
 */

import type { createClient } from "@/lib/supabase/server";
import type { AiGenerationErrorCode } from "../../model/ai-generation/errors";
import { createDraftPersistence, createQuotaGateway } from "./adapters";
import type { AiTemplateConfig } from "./config";
import {
  runTemplateGeneration,
  type GenerationOutcome,
  type GenerationSource,
} from "./generation-service";
import { consoleAiGenerationLogger } from "./logging";
import { createAiTemplateProvider } from "./providers";

type UserSupabase = Awaited<ReturnType<typeof createClient>>;

export type AiGenerationRequestContext = {
  supabase: UserSupabase;
  userId: string;
  workspaceId: string;
  config: AiTemplateConfig;
};

export async function parseGenerationSource(
  formData: FormData,
  config: Pick<AiTemplateConfig, "maxFileBytes" | "maxPastedChars">,
): Promise<{ ok: true; source: GenerationSource } | { ok: false; code: AiGenerationErrorCode }> {
  const invalid = { ok: false as const, code: "invalid_input" as const };
  const kind = formData.get("source_kind");
  const files = formData.getAll("file").filter((value) => value instanceof File);
  const text = formData.get("text");

  if (kind === "text") {
    if (files.some((file) => (file as File).size > 0)) return invalid;
    if (typeof text !== "string") return invalid;
    return { ok: true, source: { kind: "text", text } };
  }
  if (kind === "file") {
    if (typeof text === "string" && text.trim() !== "") return invalid;
    // Exactamente un archivo por generación.
    if (files.length !== 1) return invalid;
    const file = files[0] as File;
    if (file.size === 0) return { ok: false, code: "empty_text" };
    // Antes de leer el contenido en memoria.
    if (file.size > config.maxFileBytes) return { ok: false, code: "file_too_large" };
    return {
      ok: true,
      source: {
        kind: "file",
        fileName: file.name,
        declaredMime: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      },
    };
  }
  return invalid;
}

export async function generateTemplateFromFormData(
  formData: FormData,
  context: AiGenerationRequestContext,
): Promise<GenerationOutcome> {
  const parsed = await parseGenerationSource(formData, context.config);
  if (!parsed.ok) return parsed;
  const source = parsed.source;

  const instructions = formData.get("variant_instructions");
  return runTemplateGeneration(
    {
      actor: { userId: context.userId, workspaceId: context.workspaceId },
      source,
      variantInstructions: typeof instructions === "string" ? instructions : null,
      consentAccepted: formData.get("consent") === "on",
    },
    {
      config: context.config,
      provider: createAiTemplateProvider(context.config),
      quota: createQuotaGateway(),
      persistence: createDraftPersistence(context.supabase, context.workspaceId),
      log: consoleAiGenerationLogger,
    },
  );
}
