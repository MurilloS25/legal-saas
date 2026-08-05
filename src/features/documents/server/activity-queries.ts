import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { Database } from "@/lib/supabase/database.types";
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
  "id" | "event_type" | "summary" | "metadata" | "created_at" | "actor_user_id"
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
 * El actor se resuelve solo como "Tú" vs. "Otro miembro del equipo" —
 * `lawyer_profiles` es la identidad profesional del Workspace (una sola
 * fila compartida, no un perfil por miembro), así que no sirve para
 * distinguir QUIÉN de varios miembros hizo cada acción. Resolver un nombre
 * real por actor (`actor_name_snapshot`) es trabajo explícito de la
 * Iteración 6 (identidad notarial y auditoría de actores).
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
    .select("id, event_type, summary, metadata, created_at, actor_user_id")
    .eq("document_id", documentId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(safeOffset, safeOffset + ACTIVITY_PAGE_SIZE);

  if (error) throwDataAccessError("list document activity", error);

  const rows: ActivityEvent[] = (data ?? []).map((row) => ({
    ...row,
    metadata: activityMetadata(row.metadata),
  }));
  const hasMore = rows.length > ACTIVITY_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, ACTIVITY_PAGE_SIZE) : rows;

  const items: ActivityListItem[] = pageRows.map((row) => ({
    ...row,
    actorName: row.actor_user_id === user.id ? "Tú" : "Otro miembro del equipo",
  }));

  return {
    items,
    hasMore,
    nextOffset: safeOffset + pageRows.length,
  };
}
