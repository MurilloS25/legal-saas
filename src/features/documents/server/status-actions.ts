"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentIdSchema } from "../model/document-schema";
import {
  ACTION_TARGET,
  isActionAllowed,
  isDocumentStatus,
  type DocumentAction,
} from "../model/lifecycle";
import { resolveTemplateContent } from "@/lib/editor/content";
import { findUnresolvedDocumentVariables } from "@/lib/editor/variables";

export type DocumentStatusState = {
  message?: string;
  success?: boolean;
  /** Cantidad de variables pendientes cuando bloquean finalizar. */
  pendingCount?: number;
};

/**
 * Transición de estado del ciclo de vida. No acepta un estado arbitrario del
 * cliente: la acción determina el destino y se valida contra la máquina de
 * estados. Finalizar exige que no queden variables pendientes (validado en
 * servidor sobre el snapshot persistido).
 */
async function transitionDocument(
  documentId: string,
  action: DocumentAction,
): Promise<DocumentStatusState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { message: "No se encontró la escritura." };
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id, status, template_id, field_values")
    .eq("id", documentId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!doc) return { message: "No se encontró la escritura." };

  if (!isDocumentStatus(doc.status)) {
    return { message: "El estado actual de la escritura no es válido." };
  }

  const target = ACTION_TARGET[action];
  if (!isActionAllowed(doc.status, action)) {
    return { message: "Esa transición de estado no está permitida." };
  }

  // Finalizar exige que no queden variables sin valor.
  if (target === "final") {
    const { data: template } = await supabase
      .from("templates")
      .select("content_json")
      .eq("id", doc.template_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!template) {
      return { message: "El machote de esta escritura ya no está disponible." };
    }

    const { document } = resolveTemplateContent(template.content_json);
    const pending = findUnresolvedDocumentVariables(
      document,
      (doc.field_values ?? {}) as Record<string, string>,
    );
    if (pending.length > 0) {
      return {
        message:
          pending.length === 1
            ? "Queda 1 variable sin completar. Complétala antes de finalizar."
            : `Quedan ${pending.length} variables sin completar. Complétalas antes de finalizar.`,
        pendingCount: pending.length,
      };
    }
  }

  const { data: updated, error } = await supabase
    .from("documents")
    .update({ status: target })
    .eq("id", documentId)
    .eq("owner_id", user.id)
    .eq("status", doc.status)
    .select("id")
    .maybeSingle();

  if (error) {
    return { message: "No fue posible cambiar el estado. Intenta de nuevo." };
  }
  if (!updated) {
    return {
      message:
        "El estado cambió en otra pestaña. Recarga la escritura e intenta de nuevo.",
    };
  }

  revalidatePath("/dashboard/documents");
  revalidatePath(`/dashboard/documents/${documentId}`);
  return { success: true };
}

export async function markDocumentReadyAction(
  documentId: string,
  _prev: DocumentStatusState,
  _formData: FormData,
): Promise<DocumentStatusState> {
  void _prev;
  void _formData;
  return transitionDocument(documentId, "mark_ready");
}

export async function returnDocumentToDraftAction(
  documentId: string,
  _prev: DocumentStatusState,
  _formData: FormData,
): Promise<DocumentStatusState> {
  void _prev;
  void _formData;
  return transitionDocument(documentId, "return_to_draft");
}

export async function markDocumentFinalAction(
  documentId: string,
  _prev: DocumentStatusState,
  _formData: FormData,
): Promise<DocumentStatusState> {
  void _prev;
  void _formData;
  return transitionDocument(documentId, "mark_final");
}

export async function reopenDocumentAction(
  documentId: string,
  _prev: DocumentStatusState,
  _formData: FormData,
): Promise<DocumentStatusState> {
  void _prev;
  void _formData;
  return transitionDocument(documentId, "reopen");
}
