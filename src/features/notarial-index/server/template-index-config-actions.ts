"use server";

import { revalidatePath } from "next/cache";
import { TemplateIdSchema } from "@/features/templates";
import { requireUser } from "@/lib/server/auth";
import type { Database } from "@/lib/supabase/database.types";
import { TemplateIndexConfigurationSchema } from "../model/template-index-configuration";

export type TemplateIndexConfigurationState = {
  errors?: Partial<Record<string, string>>;
  message?: string;
  success?: boolean;
};

export async function saveTemplateIndexConfigurationAction(
  templateId: string,
  _previousState: TemplateIndexConfigurationState,
  formData: FormData,
): Promise<TemplateIndexConfigurationState> {
  const { supabase } = await requireUser();
  if (!TemplateIdSchema.safeParse(templateId).success) {
    return { message: "No se encontró el machote." };
  }
  const parsed = TemplateIndexConfigurationSchema.safeParse({
    party_separator: String(formData.get("party_separator") ?? ""),
    fixed_suffix: String(formData.get("fixed_suffix") ?? ""),
    allow_empty: formData.get("allow_empty") === "on",
    simple_fields: {
      instrument_number: fieldId(formData, "instrument_number"),
      authorized_date: fieldId(formData, "authorized_date"),
      authorized_time: fieldId(formData, "authorized_time"),
      protocol_book: fieldId(formData, "protocol_book"),
      initial_folio: fieldId(formData, "initial_folio"),
      final_folio: fieldId(formData, "final_folio"),
    },
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
    Database["public"]["Functions"]["save_template_index_mapping"]["Args"];
  const args = {
    p_template_id: templateId,
    p_simple_fields: parsed.data.simple_fields,
    p_party_separator: parsed.data.party_separator,
    p_fixed_suffix: parsed.data.fixed_suffix,
    p_allow_empty: parsed.data.allow_empty,
    p_party_fields: parsed.data.template_field_ids.map((templateFieldId, order) => ({
      template_field_id: templateFieldId,
      sort_order: order,
    })),
  };
  const { error } = await supabase.rpc(
    "save_template_index_mapping",
    args as unknown as Args,
  );
  if (error) {
    const knownMessage =
      error.message === "template_field_not_found"
        ? "Uno de los campos ya no pertenece al machote. Recarga e intenta de nuevo."
        : "No fue posible guardar la configuración. Intenta de nuevo.";
    return { message: knownMessage };
  }

  revalidatePath(`/dashboard/templates/${templateId}`);
  revalidatePath("/dashboard/documents", "layout");
  return { success: true };
}

function fieldId(formData: FormData, key: string): string | null {
  const value = String(formData.get(`${key}_field_id`) ?? "").trim();
  return value || null;
}
