import "server-only";

import { requireUser } from "@/lib/server/auth";
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
 * Página de actividad de una Escritura, más reciente primero. RLS restringe a
 * la actividad propia; el `document_id` acota a la escritura. Paginación por
 * offset con `hasMore` (se pide una fila extra para detectarlo). El actor se
 * resuelve a un nombre legible vía lawyer_profiles.
 */
export async function listDocumentActivity(
  documentId: string,
  offset = 0,
): Promise<DocumentActivityPage> {
  const { supabase, user } = await requireUser();

  const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { items: [], hasMore: false, nextOffset: safeOffset };
  }

  const { data, error } = await supabase
    .from("document_activity")
    .select("id, event_type, summary, metadata, created_at, actor_user_id")
    .eq("document_id", documentId)
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

  // Nombre del actor. En el MVP el actor es siempre el propio usuario; se
  // resuelve una sola vez desde su perfil (fallback si no lo tiene).
  const { data: profile, error: profileError } = await supabase
    .from("lawyer_profiles")
    .select("full_name")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (profileError) throwDataAccessError("load document activity actor", profileError);
  const ownName = profile?.full_name?.trim() || "Tú";

  const items: ActivityListItem[] = pageRows.map((row) => ({
    ...row,
    actorName: row.actor_user_id === user.id ? ownName : "Otro usuario",
  }));

  return {
    items,
    hasMore,
    nextOffset: safeOffset + pageRows.length,
  };
}
