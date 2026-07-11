import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  content_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export function extractContent(row: TemplateRow): string {
  if (!row.content_json) return "";
  const json = row.content_json as { text?: string };
  return json.text ?? "";
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
  return (data ?? []) as TemplateRow[];
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

  return (data as TemplateRow | null) ?? null;
}

// ------------------------------------------------------------------ template fields

export type TemplateFieldRow = {
  id: string;
  template_id: string;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  sort_order: number;
};

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
  return (data ?? []) as TemplateFieldRow[];
}
