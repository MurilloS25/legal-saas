import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { DocumentOption } from "../model/types";

export async function listDocumentOptions(): Promise<DocumentOption[]> {
  const { supabase, workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, client_id")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) throwDataAccessError("list receivable document options", error);
  return data ?? [];
}
