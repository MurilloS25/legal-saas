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
import { listTemplateFields } from "./detail-queries";
import type { Database } from "@/lib/supabase/database.types";
import type { TemplateWorkspaceState } from "../model/action-state";

// Mínima copia del orden del stepper — usada solo para calcular a qué paso
// avanzar tras el primer guardado (create → edit). `TemplateWorkspace.tsx`
// mantiene la copia autoritativa para la navegación en modo edición; ambas
// deben coincidir si el orden de pasos cambia alguna vez.
const TEMPLATE_STEP_ORDER = [
  "information",
  "document",
  "variables",
  "notarial",
  "publish",
] as const;

function nextTemplateSection(current: string): string {
  const index = TEMPLATE_STEP_ORDER.indexOf(
    current as (typeof TEMPLATE_STEP_ORDER)[number],
  );
  return index >= 0 && index < TEMPLATE_STEP_ORDER.length - 1
    ? TEMPLATE_STEP_ORDER[index + 1]
    : current;
}

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

  revalidatePath("/templates");
  // "Guardar y continuar" avanza al siguiente paso del flujo guiado, no
  // preserva el paso activo — el único botón que dispara este primer
  // guardado siempre implica "continuar". "notarial" nunca es el destino
  // aquí porque justo acaba de dejar de estar bloqueado (dependía de que
  // el machote ya existiera).
  const section = String(formData.get("section") ?? "information");
  const next = nextTemplateSection(section);
  const sectionParam = next && next !== "information" ? `&section=${next}` : "";
  redirect(`/templates/${created.template_id}?created=1${sectionParam}`);
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

  revalidatePath("/templates");
  revalidatePath(`/templates/${templateId}`);
  return { success: true, updatedAt: saved.updated_at };
}

// ------------------------------------------------------------------ fresh field list (for Índice, after a workspace save)

export type TemplateIndexFieldOption = {
  id: string;
  fieldKey: string;
  label: string;
};

/**
 * Lista fresca de `template_fields` (con `id` real) para el selector de
 * Partes del Índice — una variable configurada en la misma sesión (todavía
 * sin guardar cuando se cargó la página) no tiene ese `id` hasta que el
 * guardado único del machote la persiste. El guardado coordinado
 * (`TemplateWorkspace`) llama esto justo después de guardar el machote y
 * antes de guardar la configuración del Índice, para que ese guardado
 * pueda referenciar variables recién creadas en el mismo click de
 * "Guardar" — sin esto, solo aparecerían tras recargar la página.
 */
export async function getTemplateIndexFieldOptionsAction(
  templateId: string,
): Promise<TemplateIndexFieldOption[]> {
  if (!TemplateIdSchema.safeParse(templateId).success) return [];
  const fields = await listTemplateFields(templateId);
  return fields.map((field) => ({
    id: field.id,
    fieldKey: field.field_key,
    label: field.label,
  }));
}
