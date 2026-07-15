import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import { DocumentIdSchema } from "../model/document-schema";
import type { NotarialMetadata } from "../model/notarial";

const SELECT =
  "instrument_number, authorized_at, act_type, book_reference, folio_reference, appearing_parties_summary, notes";

/** Metadata notarial de una Escritura propia (o null si no existe). */
export async function getNotarialMetadata(
  documentId: string,
): Promise<NotarialMetadata | null> {
  const { supabase, user } = await requireUser();
  if (!DocumentIdSchema.safeParse(documentId).success) return null;

  const { data, error } = await supabase
    .from("document_notarial_metadata")
    .select(SELECT)
    .eq("document_id", documentId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) throwDataAccessError("get document notarial metadata", error);
  return data ?? null;
}
