import "server-only";

/**
 * Implementaciones reales de las fronteras de `runTemplateGeneration`:
 *
 * - `createDraftPersistence`: usa la SESIÓN DEL USUARIO (RLS + permisos
 *   actuales) y las RPCs existentes `save_template_workspace` y
 *   `save_template_index_mapping_with_block_source`. El status es siempre
 *   `draft` y no es configurable desde fuera.
 * - `createQuotaGateway`: usa la service role SOLO para las dos RPCs del
 *   libro de generaciones (el usuario no puede invocarlas). Nunca se usa
 *   para escribir Machotes.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";
import type { AiTemplateDraft } from "../../model/ai-generation/build-draft";
import { buildSaveTemplateWorkspaceArgs } from "../template-workspace-rpc";
import {
  QuotaRejectedError,
  type DraftPersistence,
  type QuotaGateway,
} from "./generation-service";

type UserSupabase = Awaited<ReturnType<typeof createClient>>;
type Functions = Database["public"]["Functions"];
type IndexMappingArgs = Functions["save_template_index_mapping_with_block_source"]["Args"];
type FinishArgs = Functions["finish_ai_template_generation"]["Args"];

/** Status fijo de todo Machote generado con IA. */
export const AI_GENERATED_TEMPLATE_STATUS = "draft";

const DEFAULT_PARTY_SEPARATOR = " Y ";

export function createDraftPersistence(
  supabase: UserSupabase,
  workspaceId: string,
): DraftPersistence {
  return {
    async createDraft(draft) {
      const args = buildSaveTemplateWorkspaceArgs({
        templateId: null,
        expectedUpdatedAt: null,
        name: draft.name,
        description: draft.description,
        status: AI_GENERATED_TEMPLATE_STATUS,
        document: draft.document,
        variables: draft.variables,
      });
      const { data, error } = await supabase
        .rpc("save_template_workspace", args)
        .single();
      if (error || !data) throw new Error("template_draft_not_saved");
      return { templateId: data.template_id };
    },

    async saveIndexPlan(templateId: string, draft: AiTemplateDraft) {
      const plan = draft.indexPlan;
      const hasSimple = Object.values(plan.simpleFieldKeys).some((key) => key !== null);
      if (!hasSimple && !plan.authorizedTimeOptionBlockId && plan.partyKeys.length === 0) {
        return true; // Nada que mapear: el Índice queda pendiente para el abogado.
      }

      const { data: fields, error: fieldsError } = await supabase
        .from("template_fields")
        .select("id, field_key")
        .eq("template_id", templateId)
        .eq("workspace_id", workspaceId);
      if (fieldsError || !fields) return false;
      const idByKey = new Map(fields.map((field) => [field.field_key, field.id]));
      const idOf = (key: string | null) => (key ? (idByKey.get(key) ?? null) : null);
      const partyIds = plan.partyKeys
        .map((key) => idByKey.get(key))
        .filter((id): id is string => typeof id === "string");

      const args = {
        p_template_id: templateId,
        p_simple_fields: {
          instrument_number: idOf(plan.simpleFieldKeys.instrument_number),
          authorized_date: idOf(plan.simpleFieldKeys.authorized_date),
          authorized_time: idOf(plan.simpleFieldKeys.authorized_time),
          protocol_book: idOf(plan.simpleFieldKeys.protocol_book),
          initial_folio: idOf(plan.simpleFieldKeys.initial_folio),
          // Nunca inferido: depende de cómo termine impresa la escritura.
          final_folio: null,
        },
        p_authorized_time_option_block_id: plan.authorizedTimeOptionBlockId,
        p_party_separator: DEFAULT_PARTY_SEPARATOR,
        p_fixed_suffix: null,
        // Sin partes detectadas: queda "Pendiente de definir", no "No requiere".
        p_allow_empty: false,
        p_party_fields: partyIds.map((id, order) => ({
          template_field_id: id,
          sort_order: order,
        })),
      };
      const { error } = await supabase.rpc(
        "save_template_index_mapping_with_block_source",
        // Generated function args do not encode nullable PostgreSQL parameters.
        args as unknown as IndexMappingArgs,
      );
      return !error;
    },
  };
}

function quotaErrorFrom(message: string | undefined): QuotaRejectedError | null {
  if (!message) return null;
  if (message.includes("ai_quota_exceeded")) return new QuotaRejectedError("quota_exceeded");
  if (message.includes("ai_generation_in_progress")) {
    return new QuotaRejectedError("generation_in_progress");
  }
  if (message.includes("workspace_membership_required")) {
    return new QuotaRejectedError("forbidden");
  }
  return null;
}

/** Segundos tras los cuales una generación "running" se considera huérfana. */
const STALE_AFTER_SECONDS = 600;

export function createQuotaGateway(): QuotaGateway {
  const admin = createAdminClient();
  return {
    async begin(args) {
      const { data, error } = await admin.rpc("begin_ai_template_generation", {
        p_workspace_id: args.workspaceId,
        p_actor_user_id: args.userId,
        p_source_type: args.sourceType,
        p_input_chars: args.inputChars,
        p_provider: args.provider,
        p_model: args.model,
        p_schema_version: args.schemaVersion,
        p_default_daily_limit: args.dailyLimit,
        p_stale_after_seconds: STALE_AFTER_SECONDS,
      });
      if (error || typeof data !== "string") {
        throw quotaErrorFrom(error?.message) ?? new Error("quota_begin_failed");
      }
      return { generationId: data };
    },

    async finish(args) {
      const payload = {
        p_generation_id: args.generationId,
        p_status: args.status,
        p_error_code: args.errorCode,
        p_template_id: args.templateId,
        p_attempts: args.attempts,
        p_input_tokens: args.inputTokens,
        p_output_tokens: args.outputTokens,
        p_duration_ms: args.durationMs,
        p_review_summary: args.reviewSummary,
        p_counts_toward_quota: args.countsTowardQuota,
      };
      const { error } = await admin.rpc(
        "finish_ai_template_generation",
        // Generated function args do not encode nullable PostgreSQL parameters.
        payload as unknown as FinishArgs,
      );
      if (error) throw new Error("quota_finish_failed");
    },
  };
}
