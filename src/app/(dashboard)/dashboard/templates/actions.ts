"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  parseTemplateWorkspacePayload,
  type TemplateWorkspaceVariable,
} from "@/lib/validations/template-workspace";
import { buildTemplateContentJson } from "@/lib/editor/content";
import { TemplateIdSchema } from "@/lib/validations/documents";

// ------------------------------------------------------------------ types

export type TemplateWorkspaceState = {
  errors?: {
    name?: string;
    description?: string;
    status?: string;
    document?: string;
    variables?: string;
  };
  message?: string;
  success?: boolean;
};

// Postgres unique_violation — el machote ya tiene un campo con ese field_key.
const UNIQUE_VIOLATION = "23505";

const GENERIC_SAVE_ERROR =
  "No fue posible guardar el machote. Intenta de nuevo.";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// ------------------------------------------------------------------ helpers

/**
 * Sincroniza template_fields con la configuración deseada del workspace.
 *
 * - actualiza los campos existentes (etiqueta, obligatoriedad, orden);
 * - inserta las variables nuevas;
 * - elimina solo los campos que el usuario quitó explícitamente de la
 *   configuración (la UI nunca los quita de forma automática).
 *
 * Supabase REST no ofrece transacciones multi-tabla; si una operación
 * falla a mitad, se devuelve un error visible y el usuario puede volver a
 * guardar: la reconciliación es idempotente respecto al estado deseado.
 */
async function reconcileTemplateFields(
  supabase: Supabase,
  templateId: string,
  userId: string,
  desired: TemplateWorkspaceVariable[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: existingRows, error: listError } = await supabase
    .from("template_fields")
    .select("id, field_key, label, required, sort_order")
    .eq("template_id", templateId)
    .eq("owner_id", userId);

  if (listError) return { ok: false, message: GENERIC_SAVE_ERROR };

  const existingByKey = new Map(
    (existingRows ?? []).map((row) => [row.field_key as string, row]),
  );
  const desiredKeys = new Set(desired.map((variable) => variable.field_key));

  // Eliminaciones explícitas del usuario.
  const toDelete = (existingRows ?? []).filter(
    (row) => !desiredKeys.has(row.field_key as string),
  );
  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("template_fields")
      .delete()
      .eq("template_id", templateId)
      .eq("owner_id", userId)
      .in(
        "id",
        toDelete.map((row) => row.id as string),
      );
    if (error) return { ok: false, message: GENERIC_SAVE_ERROR };
  }

  for (const [index, variable] of desired.entries()) {
    const existing = existingByKey.get(variable.field_key);

    if (existing) {
      const unchanged =
        existing.label === variable.label &&
        existing.required === variable.required &&
        existing.sort_order === index;
      if (unchanged) continue;

      const { error } = await supabase
        .from("template_fields")
        .update({
          label: variable.label,
          required: variable.required,
          sort_order: index,
          field_type: "text",
        })
        .eq("id", existing.id as string)
        .eq("template_id", templateId)
        .eq("owner_id", userId);
      if (error) return { ok: false, message: GENERIC_SAVE_ERROR };
      continue;
    }

    const { error } = await supabase.from("template_fields").insert({
      owner_id: userId,
      template_id: templateId,
      field_key: variable.field_key,
      label: variable.label,
      required: variable.required,
      sort_order: index,
      field_type: "text",
      source: "manual",
    });
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return {
          ok: false,
          message: `Ya existe un campo con la variable ${variable.field_key}.`,
        };
      }
      return { ok: false, message: GENERIC_SAVE_ERROR };
    }
  }

  return { ok: true };
}

// ------------------------------------------------------------------ create

export async function createTemplateWorkspaceAction(
  _prevState: TemplateWorkspaceState,
  formData: FormData,
): Promise<TemplateWorkspaceState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const result = parseTemplateWorkspacePayload(formData);
  if (!result.success) return { errors: result.errors };

  const { name, description, status, document, variables } = result.payload;
  const contentJson = buildTemplateContentJson(document);

  const { data: created, error: createError } = await supabase
    .from("templates")
    .insert({
      owner_id: user.id,
      name,
      description: description ?? null,
      status,
      content_json: contentJson,
      text_preview: contentJson.text.slice(0, 300),
    })
    .select("id")
    .single();

  if (createError || !created) {
    return { message: GENERIC_SAVE_ERROR };
  }

  const fieldsResult = await reconcileTemplateFields(
    supabase,
    created.id,
    user.id,
    variables,
  );

  if (!fieldsResult.ok) {
    // Compensación: Supabase REST no permite crear machote + campos en una
    // transacción, así que ante un fallo se elimina el machote recién
    // creado para no dejarlo a medias sin avisar.
    await supabase
      .from("templates")
      .delete()
      .eq("id", created.id)
      .eq("owner_id", user.id);
    return { message: fieldsResult.message };
  }

  revalidatePath("/dashboard/templates");
  redirect(`/dashboard/templates/${created.id}?created=1`);
}

// ------------------------------------------------------------------ update

export async function updateTemplateWorkspaceAction(
  templateId: string,
  _prevState: TemplateWorkspaceState,
  formData: FormData,
): Promise<TemplateWorkspaceState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!TemplateIdSchema.safeParse(templateId).success) {
    return { message: "No se encontró el machote." };
  }

  const { data: existing } = await supabase
    .from("templates")
    .select("id")
    .eq("id", templateId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!existing) {
    return { message: "No se encontró el machote." };
  }

  const result = parseTemplateWorkspacePayload(formData);
  if (!result.success) return { errors: result.errors };

  const { name, description, status, document, variables } = result.payload;
  const contentJson = buildTemplateContentJson(document);

  const { error: updateError } = await supabase
    .from("templates")
    .update({
      name,
      description: description ?? null,
      status,
      content_json: contentJson,
      text_preview: contentJson.text.slice(0, 300),
    })
    .eq("id", templateId)
    .eq("owner_id", user.id);

  if (updateError) {
    return { message: GENERIC_SAVE_ERROR };
  }

  const fieldsResult = await reconcileTemplateFields(
    supabase,
    templateId,
    user.id,
    variables,
  );
  if (!fieldsResult.ok) {
    return { message: fieldsResult.message };
  }

  revalidatePath("/dashboard/templates");
  revalidatePath(`/dashboard/templates/${templateId}`);
  return { success: true };
}
