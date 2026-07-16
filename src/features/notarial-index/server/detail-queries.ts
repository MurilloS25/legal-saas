import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import { DocumentIdSchema } from "@/features/documents";
import type {
  NotarialMetadata,
  NotarialMetadataSuggestions,
} from "../model/notarial";
import { currentCostaRicaFortnight } from "../model/fortnight";
import { costaRicaDayEndIso, costaRicaDayStartIso } from "../model/datetime";
import { requiresNotarialReview } from "../model/review-state";

const SELECT =
  "instrument_number, authorized_at, protocol_book, initial_folio, final_folio, act_name_snapshot, act_name_override, generated_parties, parties_override, notes, version, updated_at";

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

/**
 * Deriva la advertencia sin mutar metadata ni regenerar overrides. La consulta
 * usa actividad owner-scoped protegida por RLS y solo considera cambios reales
 * del snapshot de contenido.
 */
export async function getNotarialMetadataReviewRequired(
  documentId: string,
  metadataUpdatedAt: string,
): Promise<boolean> {
  const { supabase, user } = await requireUser();
  if (!DocumentIdSchema.safeParse(documentId).success) return false;

  const { data, error } = await supabase
    .from("document_activity")
    .select("created_at")
    .eq("document_id", documentId)
    .eq("owner_id", user.id)
    .eq("event_type", "document_content_updated")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throwDataAccessError("load notarial review state", error);
  return requiresNotarialReview(data?.created_at ?? null, metadataUpdatedAt);
}

export async function getNotarialMetadataSuggestions(): Promise<NotarialMetadataSuggestions> {
  const { supabase, user } = await requireUser();
  const currentYear = currentCostaRicaFortnight().year;
  const fromIso = costaRicaDayStartIso(`${currentYear}-01-01`);
  const toIso = costaRicaDayEndIso(`${currentYear}-12-31`);

  const [latestResult, instrumentsResult] = await Promise.all([
    supabase
      .from("document_notarial_metadata")
      .select("protocol_book, final_folio")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("document_notarial_metadata")
      .select("instrument_number")
      .eq("owner_id", user.id)
      .gte("authorized_at", fromIso as string)
      .lte("authorized_at", toIso as string)
      .not("instrument_number", "is", null),
  ]);
  if (latestResult.error) {
    throwDataAccessError("load notarial capture suggestions", latestResult.error);
  }
  if (instrumentsResult.error) {
    throwDataAccessError("load notarial instrument suggestion", instrumentsResult.error);
  }
  const highestInstrument = Math.max(
    0,
    ...(instrumentsResult.data ?? []).map(
      (row) => row.instrument_number ?? 0,
    ),
  );
  return {
    instrumentNumber: highestInstrument > 0 ? highestInstrument + 1 : 1,
    protocolBook: latestResult.data?.protocol_book ?? null,
    initialFolio: latestResult.data?.final_folio ?? null,
  };
}
