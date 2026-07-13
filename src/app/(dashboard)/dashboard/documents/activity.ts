import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DocumentIdSchema } from "@/lib/validations/documents";
import type { ActivityEvent } from "@/lib/documents/activity-format";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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

  if (error) return { items: [], hasMore: false, nextOffset: safeOffset };

  const rows = (data ?? []) as unknown as ActivityEvent[];
  const hasMore = rows.length > ACTIVITY_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, ACTIVITY_PAGE_SIZE) : rows;

  // Nombre del actor. En el MVP el actor es siempre el propio usuario; se
  // resuelve una sola vez desde su perfil (fallback si no lo tiene).
  const { data: profile } = await supabase
    .from("lawyer_profiles")
    .select("full_name")
    .eq("owner_id", user.id)
    .maybeSingle();
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
