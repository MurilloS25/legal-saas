import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { Tables } from "@/lib/supabase/database.types";

export type TemplateListRow = Pick<
  Tables<"templates">,
  | "id"
  | "name"
  | "description"
  | "status"
  | "content_json"
  | "created_at"
  | "updated_at"
>;

export async function listTemplates(): Promise<TemplateListRow[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("templates")
    .select("id, name, description, status, content_json, created_at, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throwDataAccessError("list templates", error);
  return data ?? [];
}
