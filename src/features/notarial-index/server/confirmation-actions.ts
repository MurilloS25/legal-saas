"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import { hasPermission } from "@/lib/server/permissions";
import { DocumentIdSchema } from "@/features/documents";
import { isNotarialComplete } from "../model/notarial";

export type NotarialConfirmationActionState = {
  message?: string;
  success?: boolean;
};

/**
 * Confirmar y Corregir son decisiones distintas de Guardar (metadata-actions.ts)
 * y de Finalizar/Reabrir (documents/server/lifecycle-actions.ts) — viven
 * aparte para no mezclar los tres conceptos en un mismo archivo.
 *
 * `notarial_index.generate` (propietario/administrador/asistente — trabajar
 * el Índice, decisión de producto explícita): confirmar o corregir es la
 * misma clase de decisión sobre estos datos que ya gobierna exportar el
 * Índice a Word — no `documents.edit` (guardar contenido) ni
 * `documents.finalize` (ciclo de vida del documento, un concepto distinto
 * que sigue reservado a propietario/administrador).
 *
 * La base de datos es la autoridad real (trigger
 * enforce_notarial_metadata_editable): estas comprobaciones son solo UX —
 * un mensaje más útil que el error crudo de Postgres si de todos modos se
 * llega a violar la regla (carrera, bypass directo).
 */
async function loadMetadataForConfirmation(
  documentId: string,
  workspaceId: string,
  supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"],
) {
  return supabase
    .from("document_notarial_metadata")
    .select(
      "instrument_number, authorized_at, protocol_book, initial_folio, final_folio, act_name_snapshot, act_name_override, generated_parties, parties_override, version, notarial_confirmed_at",
    )
    .eq("document_id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
}

export async function confirmNotarialMetadataAction(
  documentId: string,
  expectedVersion: number,
): Promise<NotarialConfirmationActionState> {
  const { supabase, user, workspaceId, role } = await requireWorkspace();

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { message: "No se encontró la escritura." };
  }
  if (!hasPermission(role, "notarial_index.generate")) {
    return {
      message: "No tienes permiso para confirmar los datos del Índice.",
    };
  }

  const { data: existing, error: loadError } = await loadMetadataForConfirmation(
    documentId,
    workspaceId,
    supabase,
  );
  if (loadError) throwDataAccessError("load metadata for confirmation", loadError);
  if (!existing) {
    return { message: "Guarda primero los datos del índice." };
  }
  if (existing.notarial_confirmed_at) {
    return { message: "Estos datos ya fueron confirmados." };
  }
  if (!isNotarialComplete(existing)) {
    return {
      message: "Completa todos los campos requeridos antes de confirmar.",
    };
  }

  const { data: updated, error } = await supabase
    .from("document_notarial_metadata")
    .update({
      notarial_confirmed_at: new Date().toISOString(),
      notarial_confirmed_by: user.id,
      notarial_review_required: false,
    })
    .eq("document_id", documentId)
    .eq("workspace_id", workspaceId)
    .eq("version", expectedVersion)
    .is("notarial_confirmed_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      message: "No fue posible confirmar los datos del índice. Intenta de nuevo.",
    };
  }
  if (!updated) {
    return {
      message:
        "Los datos cambiaron en otra sesión. Recarga la página antes de confirmar.",
    };
  }

  revalidatePath(`/dashboard/documents/${documentId}`);
  revalidatePath("/dashboard/notarial-index");
  return { success: true };
}

export async function startNotarialCorrectionAction(
  documentId: string,
  expectedVersion: number,
): Promise<NotarialConfirmationActionState> {
  const { supabase, workspaceId, role } = await requireWorkspace();

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { message: "No se encontró la escritura." };
  }
  if (!hasPermission(role, "notarial_index.generate")) {
    return {
      message: "No tienes permiso para corregir datos ya confirmados del Índice.",
    };
  }

  const { data: existing, error: loadError } = await supabase
    .from("document_notarial_metadata")
    .select("version, notarial_confirmed_at")
    .eq("document_id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (loadError) throwDataAccessError("load metadata for correction", loadError);
  if (!existing) {
    return { message: "No se encontró la metadata del índice." };
  }
  if (!existing.notarial_confirmed_at) {
    return { message: "Estos datos no están confirmados." };
  }

  const { data: updated, error } = await supabase
    .from("document_notarial_metadata")
    .update({
      notarial_confirmed_at: null,
      notarial_confirmed_by: null,
      notarial_review_required: true,
    })
    .eq("document_id", documentId)
    .eq("workspace_id", workspaceId)
    .eq("version", expectedVersion)
    .not("notarial_confirmed_at", "is", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      message: "No fue posible iniciar la corrección. Intenta de nuevo.",
    };
  }
  if (!updated) {
    return {
      message:
        "Los datos cambiaron en otra sesión. Recarga la página antes de corregir.",
    };
  }

  revalidatePath(`/dashboard/documents/${documentId}`);
  revalidatePath("/dashboard/notarial-index");
  return { success: true };
}
