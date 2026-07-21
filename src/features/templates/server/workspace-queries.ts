import "server-only";

import { requireUser } from "@/lib/server/auth";
import { isRangeNotSatisfiable, throwDataAccessError } from "@/lib/server/errors";
import type { Tables } from "@/lib/supabase/database.types";
import { TEMPLATES_PAGE_SIZE, type TemplatesQuery } from "../model/workspace-query";

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
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("templates")
    .select(TEMPLATE_COLUMNS)
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throwDataAccessError("list templates", error);
  return data ?? [];
}

export type TemplatesPage = {
  rows: TemplateListRow[];
  total: number;
  pageCount: number;
};

/** Página del listado de machotes para el listado principal (server-paginado). */
export async function listTemplatesPage(
  query: TemplatesQuery,
): Promise<TemplatesPage> {
  const { supabase, user } = await requireUser();
  const from = (query.page - 1) * TEMPLATES_PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("templates")
    .select(TEMPLATE_COLUMNS, { count: "exact" })
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .range(from, from + TEMPLATES_PAGE_SIZE - 1);

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
      .eq("owner_id", user.id);
    if (countError) throwDataAccessError("count templates page", countError);
    const total = totalOnly ?? 0;
    return { rows: [], total, pageCount: Math.max(1, Math.ceil(total / TEMPLATES_PAGE_SIZE)) };
  }

  const total = count ?? 0;

  return {
    rows: data ?? [],
    total,
    pageCount: Math.max(1, Math.ceil(total / TEMPLATES_PAGE_SIZE)),
  };
}
