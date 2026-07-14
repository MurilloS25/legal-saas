import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { redirect } from "next/navigation";

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

export function extractContent(row: TemplateRow): string {
  const json = row.content_json;
  if (!json || typeof json !== "object" || Array.isArray(json)) return "";
  return typeof json.text === "string" ? json.text : "";
}

export async function listTemplates(): Promise<TemplateRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("templates")
    .select("id, name, description, status, content_json, created_at, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return [];
  return data ?? [];
}

export async function getTemplateById(id: string): Promise<TemplateRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("templates")
    .select("id, name, description, status, content_json, created_at, updated_at")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  return data ?? null;
}

// ------------------------------------------------------------------ template fields

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

export async function listTemplateFields(
  templateId: string,
): Promise<TemplateFieldRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("template_fields")
    .select("id, template_id, field_key, label, field_type, required, sort_order")
    .eq("template_id", templateId)
    .eq("owner_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return [];
  return data ?? [];
}
