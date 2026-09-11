import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { TemplateStatus } from "../model/templates";
import {
  AUXILIARY_QUERY_LIMIT,
  ensureWithinResultLimit,
} from "@/lib/server/bounded-results";

export type TemplateOption = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updated_at: string;
};

export type ListTemplateOptionsFilter = {
  /** Si se indica, solo devuelve machotes con ese estado exacto. */
  status?: TemplateStatus;
};

export async function listTemplateOptions(
  filter: ListTemplateOptionsFilter = {},
): Promise<TemplateOption[]> {
  const { supabase, workspaceId } = await requireWorkspace();
  let request = supabase
    .from("templates")
    .select("id, name, description, status, updated_at")
    .eq("workspace_id", workspaceId);

  if (filter.status) request = request.eq("status", filter.status);

  const { data, error } = await request
    .order("updated_at", { ascending: false })
    .limit(AUXILIARY_QUERY_LIMIT + 1);

  if (error) throwDataAccessError("list template options", error);
  return ensureWithinResultLimit(
    data ?? [],
    AUXILIARY_QUERY_LIMIT,
    "machotes",
  );
}
