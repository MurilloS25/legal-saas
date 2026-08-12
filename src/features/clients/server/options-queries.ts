import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";

export type ClientOption = { id: string; full_name: string };

export async function listClientOptions(): Promise<ClientOption[]> {
  const { supabase, workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("workspace_id", workspaceId)
    .order("full_name", { ascending: true });

  if (error) throwDataAccessError("list client options", error);
  return data ?? [];
}
