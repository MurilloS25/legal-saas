"use server";

import { revalidatePath } from "next/cache";
import { DocumentIdSchema } from "@/features/documents";
import { TemplateIdSchema } from "@/features/templates";
import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { Database } from "@/lib/supabase/database.types";
import { TemplateIndexConfigurationSchema } from "../model/template-index-configuration";

export type TemplateIndexConfigurationState = {
  errors?: Partial<Record<string, string>>;
  message?: string;
  success?: boolean;
};

export async function saveTemplateIndexConfigurationAction(
  templateId: string,
  documentId: string,
  _previousState: TemplateIndexConfigurationState,
  formData: FormData,
): Promise<TemplateIndexConfigurationState> {
  const { supabase, user } = await requireUser();
  if (!TemplateIdSchema.safeParse(templateId).success) {
    return { message: "No se encontró el machote." };
  }
  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { message: "No se encontró la escritura." };
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("template_id", templateId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (documentError) {
    throwDataAccessError("authorize template index configuration", documentError);
  }
  if (!document) return { message: "No se encontró la escritura." };

  const parsed = TemplateIndexConfigurationSchema.safeParse({
    party_separator: String(formData.get("party_separator") ?? ""),
    fixed_suffix: String(formData.get("fixed_suffix") ?? ""),
    allow_empty: formData.get("allow_empty") === "on",
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
    Database["public"]["Functions"]["save_template_index_configuration"]["Args"];
  const args = {
    p_template_id: templateId,
    p_party_separator: parsed.data.party_separator,
    p_fixed_suffix: parsed.data.fixed_suffix,
    p_allow_empty: parsed.data.allow_empty,
    p_fields: parsed.data.template_field_ids.map((templateFieldId, order) => ({
      template_field_id: templateFieldId,
      sort_order: order,
    })),
  };
  const { error } = await supabase.rpc(
    "save_template_index_configuration",
    args as unknown as Args,
  );
  if (error) {
    const knownMessage =
      error.message === "template_field_not_found"
        ? "Uno de los campos ya no pertenece al machote. Recarga e intenta de nuevo."
        : "No fue posible guardar la configuración. Intenta de nuevo.";
    return { message: knownMessage };
  }

  revalidatePath(`/dashboard/documents/${documentId}`);
  return { success: true };
}
