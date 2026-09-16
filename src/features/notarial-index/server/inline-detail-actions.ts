"use server";

import { ResourceIdSchema as DocumentIdSchema } from "@/lib/validation/resource-id";
import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { NotarialMetadata } from "../model/notarial";

const INLINE_METADATA_SELECT =
  "instrument_number, authorized_at, protocol_book, initial_folio, final_folio, act_name_snapshot, act_name_override, generated_parties, parties_override, notes, version, updated_at, notarial_confirmed_at, notarial_confirmed_by, notarial_review_required, instrument_number_derived_snapshot, authorized_date_derived_snapshot, authorized_time_derived_snapshot, protocol_book_derived_snapshot, initial_folio_derived_snapshot, final_folio_derived_snapshot";

export type NotarialInlineDetailResult =
  | { success: true; metadata: NotarialMetadata | null }
  | { success: false; message: string };

/** Loads the exact persisted snapshot only when a row is expanded. */
export async function getNotarialInlineDetailAction(
  documentId: string,
): Promise<NotarialInlineDetailResult> {
  const { supabase, workspaceId } = await requireWorkspace();

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { success: false, message: "No se encontró la escritura." };
  }

  const { data, error } = await supabase
    .from("document_notarial_metadata")
    .select(INLINE_METADATA_SELECT)
    .eq("document_id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throwDataAccessError("load inline notarial metadata", error);
  return { success: true, metadata: data ?? null };
}
