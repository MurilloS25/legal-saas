import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { DocumentOption } from "../model/types";
import {
  AUXILIARY_QUERY_LIMIT,
  ensureWithinResultLimit,
} from "@/lib/server/bounded-results";

export async function listDocumentOptions(): Promise<DocumentOption[]> {
  const { supabase, workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, client_id")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(AUXILIARY_QUERY_LIMIT + 1);

  if (error) throwDataAccessError("list receivable document options", error);
  return ensureWithinResultLimit(
    data ?? [],
    AUXILIARY_QUERY_LIMIT,
    "escrituras",
  );
}
