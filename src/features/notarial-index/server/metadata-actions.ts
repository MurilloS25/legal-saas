"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import { DocumentIdSchema } from "@/features/documents";
import { parseNotarialFormData } from "../model/notarial-schema";
import { generateConfiguredParties } from "./parties-generation";
import { isNotarialComplete } from "../model/notarial";
import { notarialSaveErrorMessage } from "./notarial-save-error";

export type NotarialMetadataState = {
  errors?: Partial<Record<string, string>>;
  message?: string;
  success?: boolean;
  successMessage?: string;
  resetParties?: boolean;
};

/**
 * Guarda (crea o actualiza) la metadata del índice notarial de una Escritura.
 * La metadata sigue siendo corregible después de finalizar la Escritura. El
 * registro de actividad, la versión y la completitud se derivan en base de
 * datos.
 */
export async function saveNotarialMetadataAction(
  documentId: string,
  _prevState: NotarialMetadataState,
  formData: FormData,
): Promise<NotarialMetadataState> {
  const { supabase, user, workspaceId } = await requireWorkspace();

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { message: "No se encontró la escritura." };
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, template_id, field_values, templates(name)")
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (documentError) {
    throwDataAccessError("load document for notarial metadata", documentError);
  }
  if (!document) return { message: "No se encontró la escritura." };

  const { data: existing, error: existingError } = await supabase
    .from("document_notarial_metadata")
    .select("id, version, act_name_snapshot, generated_parties")
    .eq("document_id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existingError) {
    throwDataAccessError("load existing notarial metadata", existingError);
  }

  const generated = await generateConfiguredParties(
    supabase,
    workspaceId,
    document.template_id,
    document.field_values,
  );
  if (formData.get("intent") === "reset-parties") {
    if (!existing) {
      return { message: "Guarda primero los datos del índice." };
    }
    if (generated.status !== "ready") {
      return {
        message:
          "La configuración de Partes no está lista. Revísala antes de restablecer.",
      };
    }
    const submittedVersion = Number(formData.get("version"));
    if (!Number.isInteger(submittedVersion) || submittedVersion < 1) {
      return { message: "Recarga la página antes de restablecer las Partes." };
    }
    const { data: reset, error: resetError } = await supabase
      .from("document_notarial_metadata")
      .update({
        generated_parties: generated.value,
        parties_override: null,
      })
      .eq("document_id", documentId)
      .eq("workspace_id", workspaceId)
      .eq("version", submittedVersion)
      .select("id")
      .maybeSingle();
    if (resetError) {
      return { message: "No fue posible restablecer las Partes." };
    }
    if (!reset) {
      return {
        message:
          "Los datos cambiaron en otra sesión. Recarga la página antes de continuar.",
      };
    }
    revalidatePath(`/dashboard/documents/${documentId}`);
    return {
      success: true,
      successMessage: "Partes restablecidas desde el machote.",
      resetParties: true,
    };
  }

  const parsed = parseNotarialFormData(formData);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [key, messages] of Object.entries(fieldErrors)) {
      if (messages && messages[0]) errors[key] = messages[0];
    }
    return { errors };
  }

  const { version, ...values } = parsed.data;
  const actNameSnapshot =
    existing?.act_name_snapshot ?? document.templates?.name ?? null;
  const generatedParties =
    generated.status === "ready"
      ? generated.value
      : (existing?.generated_parties ?? null);
  const normalizedValues = {
    ...values,
    act_name_override:
      values.act_name_override === actNameSnapshot
        ? null
        : values.act_name_override,
    parties_override:
      values.parties_override === generatedParties
        ? null
        : values.parties_override,
  };

  const result = existing
    ? await supabase
        .from("document_notarial_metadata")
        .update({
          ...normalizedValues,
          act_name_snapshot: actNameSnapshot,
          generated_parties: generatedParties,
        })
        .eq("document_id", documentId)
        .eq("workspace_id", workspaceId)
        .eq("version", version)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("document_notarial_metadata")
        .insert({
          owner_id: user.id,
          workspace_id: workspaceId,
          document_id: documentId,
          act_name_snapshot: actNameSnapshot,
          generated_parties: generatedParties,
          ...normalizedValues,
        })
        .select("id")
        .single();

  if (result.error) {
    return { message: notarialSaveErrorMessage(result.error) };
  }
  if (!result.data) {
    return {
      message:
        "Los datos cambiaron en otra sesión. Recarga la página antes de guardar.",
    };
  }

  revalidatePath(`/dashboard/documents/${documentId}`);

  // El mismo guardado nunca debe leerse como "la Escritura ya quedó
  // agregada al Índice" si todavía faltan campos — el Índice se deriva de
  // esta misma fila (ver `notarial_index_entries`), así que "completo" aquí
  // es exactamente la condición real bajo la que aparecerá sin advertencia.
  const complete = isNotarialComplete({
    ...normalizedValues,
    act_name_snapshot: actNameSnapshot,
    generated_parties: generatedParties,
  });

  return {
    success: true,
    successMessage: complete
      ? "Datos del índice completos."
      : "Cambios del índice guardados.",
  };
}
