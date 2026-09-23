import "server-only";

/**
 * Orquestación de una generación de Machote con IA. Dependencias explícitas
 * (sin contenedor de DI) para poder probar cada frontera con fakes.
 *
 * Flujo:
 *   consentimiento → indicaciones → extracción temporal (en memoria)
 *   → reserva de cuota (1 unidad por solicitud del usuario)
 *   → proveedor (máx. 1 retry técnico, misma unidad de cuota)
 *   → parseo + validación estricta + construcción determinista
 *   → creación del borrador con la RPC existente (sesión del usuario)
 *   → mapeo inicial del Índice (best effort) → cierre del libro + auditoría.
 *
 * El proveedor nunca recibe credenciales ni acceso a datos de LexCR; el
 * backend, no el modelo, es quien escribe en la base de datos, y solo
 * después de que la propuesta pasó todas las validaciones. No hay ruta de
 * publicación: el borrador se crea siempre con status `draft`.
 *
 * Privacidad: el documento y el texto extraído solo existen en variables
 * locales de esta solicitud. No se escriben a disco, DB, logs ni auditoría.
 */

import {
  DocumentExtractionError,
  extractPastedText,
  extractUploadedDocument,
  type ExtractedDocument,
} from "@/lib/documents/extraction";
import { normalizeExtractedText } from "@/lib/documents/extraction/normalize";
import {
  buildTemplateDraftFromProposal,
  splitSourceParagraphs,
  type AiDraftSummary,
  type AiDraftWarningCode,
  type AiTemplateDraft,
} from "../../model/ai-generation/build-draft";
import type { AiGenerationErrorCode } from "../../model/ai-generation/errors";
import { estimateInputTokens } from "../../model/ai-generation/limits";
import {
  AI_TEMPLATE_SCHEMA_VERSION,
  parseAiTemplateProposal,
} from "../../model/ai-generation/proposal";
import type { AiTemplateConfig } from "./config";
import type { AiGenerationDiagnostics, AiGenerationLogger } from "./logging";
import {
  AiProviderError,
  type AiTemplateProvider,
  type TemplateGenerationResult,
} from "./provider";

export const MAX_PROVIDER_ATTEMPTS = 2; // 1 intento + 1 retry técnico

export type GenerationSource =
  | { kind: "text"; text: string }
  | { kind: "file"; fileName: string; declaredMime: string; bytes: Uint8Array };

export type GenerationInput = {
  actor: { userId: string; workspaceId: string };
  source: GenerationSource;
  variantInstructions: string | null;
  consentAccepted: boolean;
};

export type GenerationOutcome =
  | {
      ok: true;
      templateId: string;
      summary: AiDraftSummary;
      warnings: AiDraftWarningCode[];
      indexSaved: boolean;
    }
  | { ok: false; code: AiGenerationErrorCode };

export class QuotaRejectedError extends Error {
  readonly code: "quota_exceeded" | "generation_in_progress" | "forbidden";
  constructor(code: QuotaRejectedError["code"]) {
    super(`quota_rejected:${code}`);
    this.name = "QuotaRejectedError";
    this.code = code;
  }
}

export type QuotaGateway = {
  begin(args: {
    userId: string;
    workspaceId: string;
    sourceType: ExtractedDocument["sourceType"];
    inputChars: number;
    provider: string;
    model: string;
    schemaVersion: string;
    dailyLimit: number;
  }): Promise<{ generationId: string }>;
  finish(args: {
    generationId: string;
    status: "succeeded" | "failed";
    errorCode: string | null;
    templateId: string | null;
    attempts: number;
    inputTokens: number | null;
    outputTokens: number | null;
    durationMs: number;
    reviewSummary: { reviewKeys: string[]; warnings: string[] };
    countsTowardQuota: boolean;
  }): Promise<void>;
};

export type DraftPersistence = {
  /** Crea el Machote SIEMPRE como borrador y devuelve su id. */
  createDraft(draft: AiTemplateDraft): Promise<{ templateId: string }>;
  /** Guarda el mapeo inicial del Índice; false si no pudo (no es fatal). */
  saveIndexPlan(templateId: string, draft: AiTemplateDraft): Promise<boolean>;
};

export type GenerationDeps = {
  config: AiTemplateConfig;
  provider: AiTemplateProvider;
  quota: QuotaGateway;
  persistence: DraftPersistence;
  log: AiGenerationLogger;
  now?: () => number;
};

const EXTRACTION_TO_ERROR: Record<DocumentExtractionError["code"], AiGenerationErrorCode> = {
  unsupported_type: "unsupported_type",
  mime_mismatch: "mime_mismatch",
  file_too_large: "file_too_large",
  too_many_pages: "too_many_pages",
  text_too_long: "text_too_long",
  empty_text: "empty_text",
  no_text_layer: "no_text_layer",
  encrypted_file: "encrypted_file",
  corrupt_file: "corrupt_file",
  extraction_timeout: "extraction_timeout",
};

function providerErrorCode(error: AiProviderError): AiGenerationErrorCode {
  switch (error.kind) {
    case "timeout":
      return "provider_timeout";
    case "rate_limited":
      return "provider_rate_limited";
    case "refused":
      return "provider_refused";
    case "invalid_output":
      return "invalid_output";
    case "input_too_large":
      return "text_too_long";
    case "input_rejected":
      // Rechazo del proveedor por configuración/parámetros: nunca se atribuye
      // al tamaño del documento.
      return "provider_rejected";
    case "misconfigured":
    case "unavailable":
      return "provider_unavailable";
  }
}

type AttemptResult =
  | { ok: true; draft: AiTemplateDraft }
  | { ok: false; code: AiGenerationErrorCode; retryable: boolean; billable: boolean; providerError?: AiProviderError };

export async function runTemplateGeneration(
  input: GenerationInput,
  deps: GenerationDeps,
): Promise<GenerationOutcome> {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const { config, provider } = deps;
  const logBase = {
    userId: input.actor.userId,
    workspaceId: input.actor.workspaceId,
    provider: provider.id,
    model: provider.model,
  };

  // Diagnóstico seguro (solo números y nombres de guard, nunca contenido).
  const diagnostics: AiGenerationDiagnostics = {
    documentChars: null,
    instructionsChars: null,
    estimatedInputTokens: null,
    maxDocumentChars: input.source.kind === "text" ? config.maxPastedChars : config.maxExtractedChars,
    maxInputTokens: null,
    fileBytes: input.source.kind === "file" ? input.source.bytes.byteLength : null,
    pages: null,
    rejectedBy: null,
    providerErrorType: null,
  };

  const reject = (
    code: AiGenerationErrorCode,
    guard: string,
    extra: { sourceType?: ExtractedDocument["sourceType"] | null; inputChars?: number | null } = {},
  ): GenerationOutcome => {
    diagnostics.rejectedBy = guard;
    deps.log({
      ...logBase,
      ...diagnostics,
      outcome: "rejected",
      errorCode: code,
      sourceType: extra.sourceType ?? null,
      inputChars: extra.inputChars ?? null,
      durationMs: now() - startedAt,
      attempts: 0,
      inputTokens: null,
      outputTokens: null,
      providerErrorKind: null,
      providerHttpStatus: null,
    });
    return { ok: false, code };
  };

  // ---- 1. consentimiento e indicaciones
  if (!input.consentAccepted) return reject("consent_required", "consent");
  const instructionsRaw = input.variantInstructions ?? "";
  if (instructionsRaw.length > config.maxVariantInstructionsChars * 2) {
    return reject("instructions_too_long", "instructions_raw_length");
  }
  const instructions = normalizeExtractedText(instructionsRaw);
  diagnostics.instructionsChars = instructions.length;
  if (instructions.length > config.maxVariantInstructionsChars) {
    return reject("instructions_too_long", "instructions_length");
  }

  // ---- 2. extracción temporal, en memoria
  let extracted: ExtractedDocument;
  try {
    extracted =
      input.source.kind === "text"
        ? extractPastedText(input.source.text, { maxChars: config.maxPastedChars })
        : await extractUploadedDocument(
            {
              fileName: input.source.fileName,
              declaredMime: input.source.declaredMime,
              bytes: input.source.bytes,
            },
            {
              maxFileBytes: config.maxFileBytes,
              maxPages: config.maxPages,
              maxChars: config.maxExtractedChars,
              maxDocxXmlBytes: 5_000_000,
              maxZipEntries: 1_000,
              timeoutMs: config.extractionTimeoutMs,
            },
          );
  } catch (error) {
    if (error instanceof DocumentExtractionError) {
      return reject(EXTRACTION_TO_ERROR[error.code], `extraction:${error.code}`, {
        sourceType: input.source.kind === "text" ? "text" : null,
      });
    }
    return reject("corrupt_file", "extraction:unexpected");
  }

  const sourceType = extracted.sourceType;
  const inputChars = extracted.charCount + instructions.length;
  diagnostics.documentChars = extracted.charCount;
  diagnostics.pages = extracted.pageCount;
  // Tope determinista adicional de tokens estimados (control de costo). Se
  // calcula SOLO sobre lo que aporta el usuario (documento + indicaciones),
  // con el mismo máximo de caracteres de la fuente usada: el prompt de
  // sistema y el schema son fijos y no cuentan contra el documento.
  diagnostics.estimatedInputTokens = estimateInputTokens(inputChars);
  diagnostics.maxInputTokens = estimateInputTokens(
    (diagnostics.maxDocumentChars ?? 0) + config.maxVariantInstructionsChars,
  );
  if (diagnostics.estimatedInputTokens > diagnostics.maxInputTokens) {
    return reject("text_too_long", "input_token_estimate", { sourceType, inputChars });
  }

  // ---- 3. reserva de cuota (una unidad por solicitud del usuario)
  let generationId: string;
  try {
    ({ generationId } = await deps.quota.begin({
      userId: input.actor.userId,
      workspaceId: input.actor.workspaceId,
      sourceType,
      inputChars,
      provider: provider.id,
      model: provider.model,
      schemaVersion: AI_TEMPLATE_SCHEMA_VERSION,
      dailyLimit: config.dailyLimitPerUser,
    }));
  } catch (error) {
    if (error instanceof QuotaRejectedError) {
      return reject(error.code, `quota:${error.code}`, { sourceType, inputChars });
    }
    return reject("internal_error", "quota:begin_failed", { sourceType, inputChars });
  }

  // ---- 4. proveedor + validación (máximo 1 retry técnico)
  const paragraphs = splitSourceParagraphs(extracted.text);
  let attempts = 0;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let last: AttemptResult | null = null;
  let anyBillableAttempt = false;

  while (attempts < MAX_PROVIDER_ATTEMPTS) {
    attempts += 1;
    let result: TemplateGenerationResult;
    try {
      result = await provider.generateTemplate({
        paragraphs,
        variantInstructions: instructions === "" ? null : instructions,
      });
    } catch (error) {
      const providerError =
        error instanceof AiProviderError
          ? error
          : new AiProviderError("unavailable", { retryable: false });
      if (providerError.billable) anyBillableAttempt = true;
      last = {
        ok: false,
        code: providerErrorCode(providerError),
        retryable: providerError.retryable,
        billable: providerError.billable,
        providerError,
      };
      if (last.retryable) continue;
      break;
    }

    // Cualquier respuesta del proveedor ya tuvo costo, aunque luego falle
    // la validación: la unidad de cuota no se devuelve.
    anyBillableAttempt = true;
    if (result.usage.inputTokens !== null) {
      inputTokens = (inputTokens ?? 0) + result.usage.inputTokens;
    }
    if (result.usage.outputTokens !== null) {
      outputTokens = (outputTokens ?? 0) + result.usage.outputTokens;
    }

    const parsed = parseAiTemplateProposal(result.rawOutput);
    if (!parsed.ok) {
      last = { ok: false, code: "invalid_output", retryable: true, billable: true };
      continue;
    }
    const built = buildTemplateDraftFromProposal({
      sourceText: extracted.text,
      proposal: parsed.proposal,
      instructionsProvided: instructions !== "",
    });
    if (!built.ok) {
      last = {
        ok: false,
        code: built.code,
        retryable: built.code === "invalid_output",
        billable: true,
      };
      if (last.retryable) continue;
      break;
    }
    last = { ok: true, draft: built.draft };
    break;
  }

  const finishFailure = async (
    code: AiGenerationErrorCode,
    billable: boolean,
    providerError?: AiProviderError,
  ): Promise<GenerationOutcome> => {
    const durationMs = now() - startedAt;
    try {
      await deps.quota.finish({
        generationId,
        status: "failed",
        errorCode: code,
        templateId: null,
        attempts,
        inputTokens,
        outputTokens,
        durationMs,
        reviewSummary: { reviewKeys: [], warnings: [] },
        countsTowardQuota: billable,
      });
    } catch {
      // La fila queda "running" y se cierra como abandonada más tarde.
    }
    diagnostics.rejectedBy = providerError
      ? `provider:${providerError.kind}`
      : code === "invalid_output" || code === "no_variables"
        ? `proposal:${code}`
        : code;
    diagnostics.providerErrorType = providerError?.providerErrorType ?? null;
    deps.log({
      ...logBase,
      ...diagnostics,
      outcome: "failed",
      errorCode: code,
      sourceType,
      inputChars,
      durationMs,
      attempts,
      inputTokens,
      outputTokens,
      providerErrorKind: providerError?.kind ?? null,
      providerHttpStatus: providerError?.httpStatus ?? null,
    });
    return { ok: false, code };
  };

  if (!last || !last.ok) {
    const failure = last ?? { code: "internal_error" as const, providerError: undefined };
    return finishFailure(failure.code, anyBillableAttempt, failure.providerError);
  }

  // ---- 5. persistencia (solo tras validar) — siempre borrador
  const draft = last.draft;
  let templateId: string;
  try {
    ({ templateId } = await deps.persistence.createDraft(draft));
  } catch {
    return finishFailure("internal_error", true);
  }
  let indexSaved = true;
  try {
    indexSaved = await deps.persistence.saveIndexPlan(templateId, draft);
  } catch {
    indexSaved = false;
  }

  const durationMs = now() - startedAt;
  try {
    await deps.quota.finish({
      generationId,
      status: "succeeded",
      errorCode: null,
      templateId,
      attempts,
      inputTokens,
      outputTokens,
      durationMs,
      reviewSummary: {
        reviewKeys: draft.reviewKeys,
        warnings: indexSaved ? draft.warnings : [...draft.warnings, "index_mapping_not_saved"],
      },
      countsTowardQuota: true,
    });
  } catch {
    // El Machote ya existe como borrador; la fila se cerrará como abandonada.
  }
  deps.log({
    ...logBase,
    ...diagnostics,
    outcome: "succeeded",
    errorCode: null,
    sourceType,
    inputChars,
    durationMs,
    attempts,
    inputTokens,
    outputTokens,
    providerErrorKind: null,
    providerHttpStatus: null,
  });

  return {
    ok: true,
    templateId,
    summary: indexSaved ? draft.summary : { ...draft.summary, indexMappingCount: 0 },
    warnings: draft.warnings,
    indexSaved,
  };
}
