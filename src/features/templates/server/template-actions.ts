"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/auth";
import {
  parseTemplateWorkspacePayload,
  type TemplateWorkspaceVariable,
} from "../model/template-workspace";
import { buildTemplateContentJson } from "@/lib/editor/content";
import { TemplateIdSchema } from "../model/templates";
import type { Database } from "@/lib/supabase/database.types";

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
  updatedAt?: string;
};

const GENERIC_SAVE_ERROR =
  "No fue posible guardar el machote. Intenta de nuevo.";

type SaveTemplateArgs =
  Database["public"]["Functions"]["save_template_workspace"]["Args"];

function rpcFields(variables: TemplateWorkspaceVariable[]) {
  return variables.map(
    ({ field_key, label, required, autofill_source, output_transform }) => ({
      field_key,
      label,
      required,
      autofill_source,
      output_transform,
    }),
  );
}

function saveError(code: string | undefined): string {
  if (code === "40001") {
    return "El machote cambió en otra pestaña. Recarga la página antes de guardar.";
  }
  if (code === "P0002") return "No se encontró el machote.";
  return GENERIC_SAVE_ERROR;
}

// ------------------------------------------------------------------ create

export async function createTemplateWorkspaceAction(
  _prevState: TemplateWorkspaceState,
  formData: FormData,
): Promise<TemplateWorkspaceState> {
  const { supabase } = await requireUser();

  const result = parseTemplateWorkspacePayload(formData);
  if (!result.success) return { errors: result.errors };

  const { name, description, status, document, variables } = result.payload;
  const contentJson = buildTemplateContentJson(document);

  const args = {
    p_template_id: null,
    p_expected_updated_at: null,
    p_name: name,
    p_description: description ?? null,
    p_status: status,
    p_content_json: contentJson,
    p_text_preview: contentJson.text.slice(0, 300),
    p_fields: rpcFields(variables),
  };
  // Generated function args do not encode nullable PostgreSQL parameters.
  const { data: created, error } = await supabase
    .rpc("save_template_workspace", args as unknown as SaveTemplateArgs)
    .single();

  if (error || !created) return { message: saveError(error?.code) };

  revalidatePath("/dashboard/templates");
  redirect(`/dashboard/templates/${created.template_id}?created=1`);
}

// ------------------------------------------------------------------ update

export async function updateTemplateWorkspaceAction(
  templateId: string,
  _prevState: TemplateWorkspaceState,
  formData: FormData,
): Promise<TemplateWorkspaceState> {
  const { supabase } = await requireUser();

  if (!TemplateIdSchema.safeParse(templateId).success) {
    return { message: "No se encontró el machote." };
  }

  const result = parseTemplateWorkspacePayload(formData);
  if (!result.success) return { errors: result.errors };

  const { name, description, status, document, variables } = result.payload;
  const contentJson = buildTemplateContentJson(document);

  const args = {
    p_template_id: templateId,
    p_expected_updated_at: String(
      formData.get("expected_updated_at") ?? "",
    ),
    p_name: name,
    p_description: description ?? null,
    p_status: status,
    p_content_json: contentJson,
    p_text_preview: contentJson.text.slice(0, 300),
    p_fields: rpcFields(variables),
  };
  // Generated function args do not encode nullable PostgreSQL parameters.
  const { data: saved, error } = await supabase
    .rpc("save_template_workspace", args as unknown as SaveTemplateArgs)
    .single();

  if (error || !saved) return { message: saveError(error?.code) };

  revalidatePath("/dashboard/templates");
  revalidatePath(`/dashboard/templates/${templateId}`);
  return { success: true, updatedAt: saved.updated_at };
}
