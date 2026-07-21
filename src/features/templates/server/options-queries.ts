import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";

export type TemplateOption = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updated_at: string;
};

export async function listTemplateOptions(): Promise<TemplateOption[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("templates")
    .select("id, name, description, status, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throwDataAccessError("list template options", error);
  return data ?? [];
}
