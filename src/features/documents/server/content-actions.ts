"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import {
  DocumentIdSchema,
  DocumentValuesSchema,
  DocumentVersionSchema,
} from "../model/document-schema";
import { buildFillableFields, TemplateIdSchema } from "@/features/templates/domain";
import {
  toVariableAutofillSource,
  toVariableOutputTransform,
} from "@/features/templates/domain";
import { resolveTemplateContent } from "@/lib/editor/content";
import {
  createDocumentTemplateSnapshot,
  resolveDocumentTemplateSnapshot,
} from "../model/document-template-snapshot";
import { isReadOnlyStatus } from "../model/lifecycle";
import { resolveOptionalClientId } from "./client-actions";
import {
  validateDraftInput,
} from "./document-draft-validation";
import type {
  DeleteDocumentState,
  DocumentDraftState,
} from "../model/action-state";

// ------------------------------------------------------------------ helpers

type Supabase = Awaited<ReturnType<typeof requireWorkspace>>["supabase"];

/**
 * Carga el machote y sus campos, verificando que pertenezcan al Workspace
 * server-side. El contenido renderizado SIEMPRE se genera aquí a partir del
 * machote y de los valores validados — nunca se acepta desde el cliente.
 */
async function loadOwnedTemplateWithFields(
  supabase: Supabase,
  templateId: string,
  workspaceId: string,
) {
  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("id, name, status, content_json")
    .eq("id", templateId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (templateError) throwDataAccessError("load document template", templateError);
  if (!template) return null;

  const { data: fields, error } = await supabase
    .from("template_fields")
    .select(
      "field_key, label, field_type, required, autofill_source, output_transform",
    )
    .eq("template_id", templateId)
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: true });

  if (error) throwDataAccessError("load document template fields", error);

  // Capa compartida: contenido estructurado si existe, o legacy convertido.
  const { document, templateText } = resolveTemplateContent(
    template.content_json,
  );

  // Los campos llenables incluyen las variables del contenido sin campo
  // configurado: un machote sin campos ya no bloquea la creación.
  return {
    template,
    fields: buildFillableFields(
      (fields ?? []).map((field) => ({
        ...field,
        autofill_source: toVariableAutofillSource(field.autofill_source),
        output_transform: toVariableOutputTransform(field.output_transform),
      })),
      templateText,
    ),
    document,
  };
}

// ------------------------------------------------------------------ create draft

export async function createDocumentDraftAction(
  templateId: string,
  _prevState: DocumentDraftState,
  formData: FormData,
): Promise<DocumentDraftState> {
  const { supabase, user, workspaceId } = await requireWorkspace();

  if (!TemplateIdSchema.safeParse(templateId).success) {
    return { message: "No se encontró el machote." };
  }

  const loaded = await loadOwnedTemplateWithFields(supabase, templateId, workspaceId);
  if (!loaded) {
    return { message: "No se encontró el machote." };
  }
  // Solo se pueden crear escrituras nuevas desde machotes activos. Las
  // escrituras ya existentes siguen editables aunque su machote cambie de
  // estado después (ver `updateDocumentDraftAction`, que no repite este
  // chequeo): esta validación es exclusiva de la creación.
  if (loaded.template.status !== "active") {
    return {
      message: "Este machote ya no está activo. Solo se pueden crear escrituras desde machotes activos.",
    };
  }

  const result = validateDraftInput(formData, loaded.fields, loaded.document);
  if ("state" in result) return result.state;

  const client = await resolveOptionalClientId(
    supabase,
    formData.get("client_id"),
    workspaceId,
  );
  if ("error" in client) return { message: client.error };

  const { data, error } = await supabase
    .from("documents")
    .insert({
      owner_id: user.id,
      workspace_id: workspaceId,
      template_id: templateId,
      client_id: client.clientId,
      title: result.title,
      status: "draft",
      field_values: result.values,
      option_selections: result.optionSelections,
      rendered_content: result.rendered,
      template_snapshot: createDocumentTemplateSnapshot(
        loaded.document,
        loaded.fields,
      ),
      // El snapshot del default del Machote lo garantiza el trigger
      // `documents_notarial_index_snapshot` (ver 20260822090000) — cualquier
      // valor enviado aquí se descarta, así que no se envía ninguno.
      // `documents.include_in_notarial_index` sigue siendo la única fuente
      // real por Escritura una vez creada.
    })
    .select("id")
    .single();

  if (error || !data) {
    return { message: "No fue posible guardar el borrador. Intenta de nuevo." };
  }

  revalidatePath("/documents");
  // "Completar" es el único paso editable antes de que la Escritura exista
  // y también donde vive el resto del workspace (revisión del documento,
  // Finalizar) desde que "Revisar y finalizar" se retiró como paso propio
  // — así que la transición create → edit permanece ahí, sin `section`.
  redirect(`/documents/${data.id}?saved=1`);
}

// ------------------------------------------------------------------ update draft

export async function updateDocumentDraftAction(
  documentId: string,
  _prevState: DocumentDraftState,
  formData: FormData,
): Promise<DocumentDraftState> {
  const { supabase, workspaceId } = await requireWorkspace();

  const version = DocumentVersionSchema.safeParse(formData.get("expected_updated_at"));
  if (!version.success) {
    return { message: "No se pudo comprobar la versión. Recarga la escritura antes de guardar." };
  }

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { message: "No se encontró la escritura." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("documents")
    .select("id, field_values, status, rendered_content, template_snapshot")
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existingError) throwDataAccessError("load document for update", existingError);
  if (!existing) {
    return { message: "No se encontró la escritura." };
  }
  if (isReadOnlyStatus(existing.status)) {
    return {
      message: "Esta escritura está finalizada. Reábrela antes de editarla.",
    };
  }

  let snapshot;
  try {
    snapshot = resolveDocumentTemplateSnapshot(
      existing.template_snapshot,
      existing.rendered_content,
    );
  } catch {
    return { message: "No fue posible leer la versión documental guardada." };
  }

  const existingValuesResult = DocumentValuesSchema.safeParse(
    existing.field_values ?? {},
  );
  if (!existingValuesResult.success) {
    return { message: "No fue posible guardar el borrador. Intenta de nuevo." };
  }

  const result = validateDraftInput(
    formData,
    snapshot.fields,
    snapshot.document,
    existingValuesResult.data,
  );
  if ("state" in result) return result.state;

  const client = await resolveOptionalClientId(
    supabase,
    formData.get("client_id"),
    workspaceId,
  );
  if ("error" in client) return { message: client.error };

  const { data: updated, error } = await supabase
    .from("documents")
    .update({
      client_id: client.clientId,
      title: result.title,
      field_values: result.values,
      option_selections: result.optionSelections,
      rendered_content: result.rendered,
    })
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .neq("status", "final")
    .eq("updated_at", version.data)
    .select("id, updated_at")
    .maybeSingle();

  if (error) {
    return { message: "No fue posible guardar el borrador. Intenta de nuevo." };
  }
  if (!updated) {
    const { data: current } = await supabase
      .from("documents")
      .select("updated_at, status")
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    return {
      message: "La escritura cambió desde que la abriste. Tus cambios siguen en esta pestaña. Revisa la versión guardada antes de reintentar: el reintento reemplazará su contenido con tus cambios.",
      conflictUpdatedAt: current && !isReadOnlyStatus(current.status) ? current.updated_at : undefined,
    };
  }

  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
  return { success: true, updatedAt: updated.updated_at };
}

// ------------------------------------------------------------------ delete draft

export async function deleteDocumentDraftAction(
  documentId: string,
  _prevState: DeleteDocumentState,
  _formData: FormData,
): Promise<DeleteDocumentState> {
  void _prevState;
  void _formData;

  const { supabase, workspaceId } = await requireWorkspace();

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { message: "No se encontró la escritura." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existingError) throwDataAccessError("load document for delete", existingError);
  if (!existing) {
    return { message: "No se encontró la escritura." };
  }
  if (isReadOnlyStatus(existing.status)) {
    return {
      message: "Esta escritura está finalizada. Reábrela antes de eliminarla.",
    };
  }

  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { message: "No se pudo eliminar el borrador. Intenta de nuevo." };
  }

  revalidatePath("/documents");
  return { success: true };
}
