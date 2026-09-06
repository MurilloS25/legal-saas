"use server";

/**
 * Lectura bajo demanda para la expansión inline del Índice Notarial.
 *
 * El listado (`NOTARIAL_INDEX_SELECT`) ya trae todo lo que se muestra en la
 * tabla, incluidos los valores YA RESUELTOS de acto/partes (override si
 * existe, si no snapshot/generado — ver la vista `notarial_index_entries`).
 * Para editar hace falta además el valor RAW del override (distinto del
 * resuelto) y las notas internas, que el listado no trae para no cargar esos
 * campos en cada fila cuando la mayoría nunca se expande. Se piden aquí,
 * una sola fila a la vez, cuando el usuario realmente expande esa fila.
 */

import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import { DocumentIdSchema } from "@/features/documents";

export type NotarialRowDetail = {
  act_name_override: string | null;
  act_name_snapshot: string | null;
  parties_override: string | null;
  generated_parties: string | null;
  notes: string | null;
};

export type NotarialRowDetailResult =
  | { success: true; detail: NotarialRowDetail }
  | { success: false; message: string };

export async function getNotarialRowDetailAction(
  documentId: string,
): Promise<NotarialRowDetailResult> {
  const { supabase, workspaceId } = await requireWorkspace();

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { success: false, message: "No se encontró la escritura." };
  }

  const { data, error } = await supabase
    .from("document_notarial_metadata")
    .select("act_name_override, act_name_snapshot, parties_override, generated_parties, notes")
    .eq("document_id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throwDataAccessError("load notarial row detail", error);

  return {
    success: true,
    detail: data ?? {
      act_name_override: null,
      act_name_snapshot: null,
      parties_override: null,
      generated_parties: null,
      notes: null,
    },
  };
}
