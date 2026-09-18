"use server";

import { revalidatePath } from "next/cache";
import { ResourceIdSchema as TemplateIdSchema } from "@/lib/validation/resource-id";
import { requireUser } from "@/lib/server/auth";
import type { Database } from "@/lib/supabase/database.types";
import { TemplateIndexConfigurationSchema } from "../model/template-index-configuration";
import type { TemplateIndexConfigurationState } from "../model/action-state";

export async function saveTemplateIndexConfigurationAction(
  templateId: string,
  _previousState: TemplateIndexConfigurationState,
  formData: FormData,
): Promise<TemplateIndexConfigurationState> {
  const { supabase } = await requireUser();
  if (!TemplateIdSchema.safeParse(templateId).success) {
    return { message: "No se encontró el machote." };
  }
  const authorizedTimeSource = String(
    formData.get("authorized_time_source") ?? "",
  );
  const parsed = TemplateIndexConfigurationSchema.safeParse({
    party_separator: String(formData.get("party_separator") ?? ""),
    fixed_suffix: String(formData.get("fixed_suffix") ?? ""),
    allow_empty: formData.get("allow_empty") === "on",
    simple_fields: {
      instrument_number: fieldId(formData, "instrument_number"),
      authorized_date: fieldId(formData, "authorized_date"),
      authorized_time: authorizedTimeSource.startsWith("field:")
        ? authorizedTimeSource.slice("field:".length)
        : null,
      protocol_book: fieldId(formData, "protocol_book"),
      initial_folio: fieldId(formData, "initial_folio"),
      final_folio: fieldId(formData, "final_folio"),
    },
    authorized_time_option_block_id: authorizedTimeSource.startsWith("block:")
      ? authorizedTimeSource.slice("block:".length)
      : null,
    template_field_ids: formData
      .getAll("selected_field")
      .map((value) => String(value)),
  });
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      errors: Object.fromEntries(
        Object.entries(flattened).flatMap(([key, messages]) =>
          messages?.[0] ? [[key, messages[0]]] : [],
        ),
      ),
    };
  }

  type Args =
    Database["public"]["Functions"]["save_template_index_mapping_with_block_source"]["Args"];
  const args = {
    p_template_id: templateId,
    p_simple_fields: parsed.data.simple_fields,
    p_authorized_time_option_block_id:
      parsed.data.authorized_time_option_block_id,
    p_party_separator: parsed.data.party_separator,
    p_fixed_suffix: parsed.data.fixed_suffix,
    p_allow_empty: parsed.data.allow_empty,
    p_party_fields: parsed.data.template_field_ids.map((templateFieldId, order) => ({
      template_field_id: templateFieldId,
      sort_order: order,
    })),
  };
  const { error } = await supabase.rpc(
    "save_template_index_mapping_with_block_source",
    args as unknown as Args,
  );
  if (error) {
    const knownMessage =
      error.message === "template_field_not_found"
        ? "Uno de los campos ya no pertenece al machote. Recarga e intenta de nuevo."
        : error.message === "option_block_not_found"
          ? "El Bloque de Hora ya no está disponible. Guarda el machote y vuelve a intentarlo."
        : "No fue posible guardar la configuración. Intenta de nuevo.";
    return { message: knownMessage };
  }

  revalidatePath(`/templates/${templateId}`);
  revalidatePath("/documents", "layout");
  return { success: true };
}

function fieldId(formData: FormData, key: string): string | null {
  const value = String(formData.get(`${key}_field_id`) ?? "").trim();
  return value || null;
}

export type TemplateNotarialIndexDefaultState = {
  message?: string;
  success?: boolean;
  includeByDefault?: boolean;
  updatedAt?: string;
};

/**
 * Preferencia del Machote — no una decisión por Escritura. Cada Escritura
 * nueva toma un snapshot de este valor al crearse
 * (createDocumentDraftAction); cambiar el Machote después nunca modifica
 * Escrituras ya creadas. `templates.write` (propietario/administrador/
 * asistente) — mismo permiso que ya gobierna el resto del paso Índice del
 * Machote.
 */
export async function setTemplateNotarialIndexDefaultAction(
  templateId: string,
  includeByDefault: boolean,
): Promise<TemplateNotarialIndexDefaultState> {
  const { supabase } = await requireUser();
  if (!TemplateIdSchema.safeParse(templateId).success) {
    return { message: "No se encontró el machote." };
  }

  const { data: updatedAt, error } = await supabase.rpc(
    "set_template_notarial_index_default",
    {
      p_template_id: templateId,
      p_include_by_default: includeByDefault,
    },
  );
  if (error) {
    return {
      message:
        "No fue posible actualizar la configuración del Índice Notarial. Intenta de nuevo.",
    };
  }

  revalidatePath(`/templates/${templateId}`);
  return { success: true, includeByDefault, updatedAt: updatedAt ?? undefined };
}
