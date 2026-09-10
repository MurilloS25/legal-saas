"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import { hasPermission } from "@/lib/server/permissions";
import {
  DocumentIdSchema,
  DocumentOptionSelectionsSchema,
  DocumentValuesSchema,
} from "../model/document-schema";
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
 *
 * No decide `include_in_notarial_index`: ese valor ya se fijó al crear la
 * Escritura (snapshot del default del Machote, ver createDocumentDraftAction)
 * y puede corregirse aparte desde el paso Índice
 * (setNotarialIndexInclusionAction) — finalizar es un cambio de estado puro,
 * nunca vuelve a preguntar esa decisión.
 */
async function transitionDocument(
  documentId: string,
  action: DocumentAction,
): Promise<DocumentStatusState> {
  const { supabase, workspaceId, role } = await requireWorkspace();

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { message: "No se encontró la escritura." };
  }

  const { data: doc, error: documentError } = await supabase
    .from("documents")
    .select("id, status, template_id, field_values, option_selections, updated_at")
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (documentError) throwDataAccessError("load document lifecycle", documentError);
  if (!doc) return { message: "No se encontró la escritura." };

  if (!isDocumentStatus(doc.status)) {
    return { message: "El estado actual de la escritura no es válido." };
  }

  const target = ACTION_TARGET[action];
  if (!isActionAllowed(doc.status, action)) {
    return { message: "Esa transición de estado no está permitida." };
  }

  if (
    (target === "final" || action === "reopen") &&
    !hasPermission(role, "documents.finalize")
  ) {
    return {
      message:
        action === "reopen"
          ? "Solo el propietario o un administrador puede reabrir una escritura."
          : "Solo el propietario o un administrador puede finalizar una escritura.",
    };
  }

  // Finalizar exige que no queden variables sin valor.
  if (target === "final") {
    const { data: template, error: templateError } = await supabase
      .from("templates")
      .select("content_json")
      .eq("id", doc.template_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (templateError) {
      throwDataAccessError("load lifecycle template", templateError);
    }
    if (!template) {
      return { message: "El machote de esta escritura ya no está disponible." };
    }

    const values = DocumentValuesSchema.safeParse(doc.field_values ?? {});
    if (!values.success) {
      throwDataAccessError("parse lifecycle field values", {
        code: "invalid_json",
      });
    }
    const optionSelections = DocumentOptionSelectionsSchema.safeParse(
      doc.option_selections ?? {},
    );
    if (!optionSelections.success) {
      throwDataAccessError("parse lifecycle option selections", {
        code: "invalid_json",
      });
    }

    const { document } = resolveTemplateContent(template.content_json);
    const pending = findUnresolvedDocumentVariables(
      document,
      values.data,
      optionSelections.data,
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
    .eq("workspace_id", workspaceId)
    .eq("status", doc.status)
    .eq("updated_at", doc.updated_at)
    .select("id")
    .maybeSingle();

  if (error) {
    return { message: "No fue posible cambiar el estado. Intenta de nuevo." };
  }
  if (!updated) {
    return {
      message:
        "La escritura cambió en otra pestaña. Recarga y revisa la versión actual antes de finalizar.",
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
  const result = await transitionDocument(documentId, "mark_final");
  if (result.success) {
    // Finalizar avanza a "Cobro", el siguiente paso real del flujo guiado
    // (Completar → Cobro → Índice). Sin `section` explícito la página cae
    // en su default ("completar"), que parecería un retroceso justo
    // después de finalizar.
    redirect(`/dashboard/documents/${documentId}?lifecycle=finalized&section=cobro`);
  }
  return result;
}

export async function reopenDocumentAction(
  documentId: string,
  _prev: DocumentStatusState,
  _formData: FormData,
): Promise<DocumentStatusState> {
  void _prev;
  void _formData;
  const result = await transitionDocument(documentId, "reopen");
  if (result.success) {
    // Reabrir deshace la finalización y deja la Escritura editable de
    // nuevo — vuelve a "Completar" (el paso por defecto; ya no hay un
    // paso "Revisar y finalizar" separado donde aterrizar), sin viaje
    // artificial a ningún otro lado.
    redirect(`/dashboard/documents/${documentId}?lifecycle=reopened`);
  }
  return result;
}

export type NotarialIndexInclusionState = {
  message?: string;
  success?: boolean;
  includeInNotarialIndex?: boolean;
};

/**
 * Corrige después de finalizar si la Escritura pertenece o no al Índice
 * Notarial — vive junto al resto de acciones de ciclo de vida porque el
 * mismo trigger (`enforce_document_finalize_permission`) que guarda
 * finalizar/reabrir también guarda este cambio, aunque con un requisito de
 * rol propio: incluir/excluir es trabajo del Índice (`notarial_index.generate`,
 * que incluye a asistente), no una decisión de ciclo de vida como finalizar/
 * reabrir (`documents.finalize`, solo propietario/administrador) — el
 * trigger en DB aplica esa misma distinción. No depende de que exista una
 * fila de document_notarial_metadata (una Escritura puede pertenecer o no
 * al Índice sin haber guardado nunca su paso Índice).
 */
export async function setNotarialIndexInclusionAction(
  documentId: string,
  includeInNotarialIndex: boolean,
): Promise<NotarialIndexInclusionState> {
  const { supabase, workspaceId, role } = await requireWorkspace();

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { message: "No se encontró la escritura." };
  }
  if (!hasPermission(role, "notarial_index.generate")) {
    return {
      message:
        "No tienes permiso para cambiar si la escritura pertenece al Índice Notarial.",
    };
  }

  const { data: doc, error: documentError } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (documentError) throwDataAccessError("load document for index inclusion", documentError);
  if (!doc) return { message: "No se encontró la escritura." };
  if (doc.status !== "final") {
    return {
      message: "Solo una escritura finalizada puede pertenecer al Índice Notarial.",
    };
  }

  const { data: updated, error } = await supabase
    .from("documents")
    .update({ include_in_notarial_index: includeInNotarialIndex })
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .select("id, include_in_notarial_index")
    .maybeSingle();

  if (error) {
    return { message: "No fue posible actualizar el Índice Notarial. Intenta de nuevo." };
  }
  if (!updated) {
    return { message: "No se encontró la escritura." };
  }

  revalidatePath(`/dashboard/documents/${documentId}`);
  revalidatePath("/dashboard/notarial-index");

  return {
    success: true,
    includeInNotarialIndex: updated.include_in_notarial_index,
  };
}
