import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { isRangeNotSatisfiable, throwDataAccessError } from "@/lib/server/errors";
import type { Tables } from "@/lib/supabase/database.types";
import type { TemplatesQuery } from "../model/workspace-query";
import {
  AUXILIARY_QUERY_LIMIT,
  ensureWithinResultLimit,
} from "@/lib/server/bounded-results";

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

const TEMPLATE_COLUMNS =
  "id, name, description, status, content_json, created_at, updated_at";

/** Todos los machotes del dueño, sin paginar (para resúmenes/selectores). */
export async function listTemplates(): Promise<TemplateListRow[]> {
  const { supabase, workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from("templates")
    .select(TEMPLATE_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(AUXILIARY_QUERY_LIMIT + 1);

  if (error) throwDataAccessError("list templates", error);
  return ensureWithinResultLimit(
    data ?? [],
    AUXILIARY_QUERY_LIMIT,
    "machotes",
  );
}

export type TemplatesPage = {
  rows: TemplateListRow[];
  total: number;
  pageCount: number;
};

export async function getTemplateDashboardCounts(): Promise<{
  total: number;
  active: number;
}> {
  const { supabase, workspaceId } = await requireWorkspace();
  const [all, active] = await Promise.all([
    supabase
      .from("templates")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("templates")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "active"),
  ]);
  if (all.error) throwDataAccessError("count dashboard templates", all.error);
  if (active.error) {
    throwDataAccessError("count active dashboard templates", active.error);
  }
  return { total: all.count ?? 0, active: active.count ?? 0 };
}

/** Página del listado de machotes para el listado principal (server-paginado). */
export async function listTemplatesPage(
  query: TemplatesQuery,
): Promise<TemplatesPage> {
  const { supabase, workspaceId } = await requireWorkspace();
  const from = (query.page - 1) * query.pageSize;
  const { data, count, error } = await supabase
    .from("templates")
    .select(TEMPLATE_COLUMNS, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .range(from, from + query.pageSize - 1);

  if (error && !isRangeNotSatisfiable(error)) {
    throwDataAccessError("list templates page", error);
  }

  if (error) {
    // El offset pedido quedó más allá de las filas disponibles (p. ej. una
    // página vieja tras borrar machotes): la página está vacía, no es un
    // error real.
    const { count: totalOnly, error: countError } = await supabase
      .from("templates")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);
    if (countError) throwDataAccessError("count templates page", countError);
    const total = totalOnly ?? 0;
    return { rows: [], total, pageCount: Math.max(1, Math.ceil(total / query.pageSize)) };
  }

  const total = count ?? 0;

  return {
    rows: data ?? [],
    total,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
