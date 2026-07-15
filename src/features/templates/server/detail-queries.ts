import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { Tables } from "@/lib/supabase/database.types";
import { TemplateIdSchema } from "../model/templates";

export type TemplateRow = Pick<
  Tables<"templates">,
  | "id"
  | "name"
  | "description"
  | "status"
  | "content_json"
  | "created_at"
  | "updated_at"
>;

export type TemplateFieldRow = Pick<
  Tables<"template_fields">,
  | "id"
  | "template_id"
  | "field_key"
  | "label"
  | "field_type"
  | "required"
  | "sort_order"
>;

export async function getTemplateById(id: string): Promise<TemplateRow | null> {
  if (!TemplateIdSchema.safeParse(id).success) return null;

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("templates")
    .select("id, name, description, status, content_json, created_at, updated_at")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) throwDataAccessError("get template detail", error);
  return data;
}

export async function listTemplateFields(
  templateId: string,
): Promise<TemplateFieldRow[]> {
  if (!TemplateIdSchema.safeParse(templateId).success) return [];

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("template_fields")
    .select("id, template_id, field_key, label, field_type, required, sort_order")
    .eq("template_id", templateId)
    .eq("owner_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throwDataAccessError("list template fields", error);
  return data ?? [];
}
