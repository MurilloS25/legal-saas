import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { Database } from "@/lib/supabase/database.types";
import { ROLE_LABELS, type WorkspaceRole } from "@/lib/server/permissions";
import { DocumentIdSchema } from "../model/document-schema";
import type { ActivityEvent } from "../model/activity-format";

export const ACTIVITY_PAGE_SIZE = 10;

export type ActivityListItem = ActivityEvent & {
  /** Nombre legible del actor (nunca su UUID). */
  actorName: string;
};

export type DocumentActivityPage = {
  items: ActivityListItem[];
  hasMore: boolean;
  nextOffset: number;
};

type ActivityRow = Pick<
  Database["public"]["Tables"]["document_activity"]["Row"],
  | "id"
  | "event_type"
  | "summary"
  | "metadata"
  | "created_at"
  | "actor_user_id"
  | "actor_name_snapshot"
  | "actor_role_snapshot"
>;

function activityMetadata(value: ActivityRow["metadata"]): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

/**
 * Página de actividad de una Escritura, más reciente primero. `workspace_id`
 * se filtra explícitamente en la query (defensa en profundidad, igual que
 * el resto de las consultas del feature) además de estar cubierto por RLS;
 * el `document_id` acota a la escritura. Paginación por offset con
 * `hasMore` (se pide una fila extra para detectarlo).
 *
 * El actor se muestra con `actor_name_snapshot`/`actor_role_snapshot`
 * (Iteración 6) — el nombre y rol que tenía la persona AL MOMENTO del
 * evento, fijados por la base de datos y nunca recalculados en lectura. No
 * cambian si esa persona cambia de rol después o incluso si ya no es
 * miembro del Workspace.
 */
export async function listDocumentActivity(
  documentId: string,
  offset = 0,
): Promise<DocumentActivityPage> {
  const { supabase, user, workspaceId } = await requireWorkspace();

  const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { items: [], hasMore: false, nextOffset: safeOffset };
  }

  const { data, error } = await supabase
    .from("document_activity")
    .select(
      "id, event_type, summary, metadata, created_at, actor_user_id, actor_name_snapshot, actor_role_snapshot",
    )
    .eq("document_id", documentId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(safeOffset, safeOffset + ACTIVITY_PAGE_SIZE);

  if (error) throwDataAccessError("list document activity", error);

  const rows: (Omit<ActivityRow, "metadata"> & { metadata: Record<string, unknown> })[] = (
    data ?? []
  ).map((row) => ({
    ...row,
    metadata: activityMetadata(row.metadata),
  }));
  const hasMore = rows.length > ACTIVITY_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, ACTIVITY_PAGE_SIZE) : rows;

  const items: ActivityListItem[] = pageRows.map((row) => {
    const roleLabel =
      ROLE_LABELS[row.actor_role_snapshot as WorkspaceRole] ?? row.actor_role_snapshot;
    return {
      ...row,
      actorName:
        row.actor_user_id === user.id
          ? "Tú"
          : `${row.actor_name_snapshot} (${roleLabel})`,
    };
  });

  return {
    items,
    hasMore,
    nextOffset: safeOffset + pageRows.length,
  };
}
