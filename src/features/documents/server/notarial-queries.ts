import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DocumentIdSchema } from "../model/document-schema";
import type { NotarialMetadata } from "../model/notarial";

const SELECT =
  "instrument_number, authorized_at, act_type, book_reference, folio_reference, appearing_parties_summary, notes";

/** Metadata notarial de una Escritura propia (o null si no existe). */
export async function getNotarialMetadata(
  documentId: string,
): Promise<NotarialMetadata | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!DocumentIdSchema.safeParse(documentId).success) return null;

  const { data } = await supabase
    .from("document_notarial_metadata")
    .select(SELECT)
    .eq("document_id", documentId)
    .eq("owner_id", user.id)
    .maybeSingle();

  return (data as NotarialMetadata | null) ?? null;
}
