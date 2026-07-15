"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import {
  DocumentIdSchema,
  DocumentRenderedContentSchema,
  DocumentTitleSchema,
  DocumentValuesSchema,
  mergeDocumentDraftValues,
  TemplateIdSchema,
} from "../model/document-schema";
import { validateDocumentFill } from "../model/document-fill";
import {
  buildFillableFields,
  type FillableTemplateField,
} from "@/lib/templates/fillable-fields";
import { resolveTemplateContent } from "@/lib/editor/content";
import { renderStructuredTemplate } from "@/lib/editor/render";
import type { TemplateDocument } from "@/lib/editor/types";
import { isReadOnlyStatus } from "../model/lifecycle";
import { resolveOptionalClientId } from "./client-actions";

// ------------------------------------------------------------------ types

export type DocumentDraftState = {
  /** Errores por field_key del machote. */
  errors?: Record<string, string>;
  titleError?: string;
  message?: string;
  success?: boolean;
};

export type DeleteDocumentState = {
  message?: string;
  success?: boolean;
};

// ------------------------------------------------------------------ helpers

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/**
 * Carga el machote y sus campos, verificando ownership server-side.
 * El contenido renderizado SIEMPRE se genera aquí a partir del machote y de
 * los valores validados — nunca se acepta desde el cliente.
 */
async function loadOwnedTemplateWithFields(
  supabase: Supabase,
  templateId: string,
  userId: string,
) {
  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("id, name, content_json")
    .eq("id", templateId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (templateError) throwDataAccessError("load document template", templateError);
  if (!template) return null;

  const { data: fields, error } = await supabase
    .from("template_fields")
    .select("field_key, label, field_type, required")
    .eq("template_id", templateId)
    .eq("owner_id", userId)
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
    fields: buildFillableFields(fields ?? [], templateText),
    document,
  };
}

function validateDraftInput(
  formData: FormData,
  fields: FillableTemplateField[],
  document: TemplateDocument,
  existingValues?: Record<string, string>,
): { state: DocumentDraftState } | {
  title: string;
  values: Record<string, string>;
  rendered: string;
} {
  const titleResult = DocumentTitleSchema.safeParse(
    String(formData.get("title") ?? ""),
  );

  const rawValues: Record<string, string> = {};
  for (const field of fields) {
    rawValues[field.field_key] = String(formData.get(field.field_key) ?? "");
  }
  const fillResult = validateDocumentFill(fields, rawValues);

  if (!titleResult.success || !fillResult.success) {
    return {
      state: {
        titleError: titleResult.success
          ? undefined
          : titleResult.error.issues[0]?.message,
        errors: fillResult.success ? undefined : fillResult.errors,
      },
    };
  }

  // Defensa en profundidad: aunque las keys provienen de campos propios,
  // se validan formato, tamaño y claves reservadas antes de persistir.
  const valuesToPersist = existingValues
    ? mergeDocumentDraftValues(
        existingValues,
        fillResult.values,
        fields.map((field) => field.field_key),
      )
    : fillResult.values;

  const valuesResult = DocumentValuesSchema.safeParse(valuesToPersist);
  if (!valuesResult.success) {
    return {
      state: {
        message: valuesResult.error.issues[0]?.message ??
          "Los valores no son válidos.",
      },
    };
  }

  const rendered = renderStructuredTemplate(document, valuesResult.data);
  const renderedResult = DocumentRenderedContentSchema.safeParse(rendered);
  if (!renderedResult.success) {
    return {
      state: {
        message: renderedResult.error.issues[0]?.message ??
          "El contenido del documento es demasiado largo.",
      },
    };
  }

  return {
    title: titleResult.data,
    values: valuesResult.data,
    rendered: renderedResult.data,
  };
}

// ------------------------------------------------------------------ create draft

export async function createDocumentDraftAction(
  templateId: string,
  _prevState: DocumentDraftState,
  formData: FormData,
): Promise<DocumentDraftState> {
  const { supabase, user } = await requireUser();

  if (!TemplateIdSchema.safeParse(templateId).success) {
    return { message: "No se encontró el machote." };
  }

  const loaded = await loadOwnedTemplateWithFields(supabase, templateId, user.id);
  if (!loaded) {
    return { message: "No se encontró el machote." };
  }

  const result = validateDraftInput(formData, loaded.fields, loaded.document);
  if ("state" in result) return result.state;

  const client = await resolveOptionalClientId(
    supabase,
    formData.get("client_id"),
    user.id,
  );
  if ("error" in client) return { message: client.error };

  const { data, error } = await supabase
    .from("documents")
    .insert({
      owner_id: user.id,
      template_id: templateId,
      client_id: client.clientId,
      title: result.title,
      status: "draft",
      field_values: result.values,
      rendered_content: result.rendered,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { message: "No fue posible guardar el borrador. Intenta de nuevo." };
  }

  revalidatePath("/dashboard/documents");
  redirect(`/dashboard/documents/${data.id}?saved=1`);
}

// ------------------------------------------------------------------ update draft

export async function updateDocumentDraftAction(
  documentId: string,
  _prevState: DocumentDraftState,
  formData: FormData,
): Promise<DocumentDraftState> {
  const { supabase, user } = await requireUser();

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { message: "No se encontró la escritura." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("documents")
    .select("id, template_id, field_values, status")
    .eq("id", documentId)
    .eq("owner_id", user.id)
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

  const loaded = await loadOwnedTemplateWithFields(
    supabase,
    existing.template_id,
    user.id,
  );
  if (!loaded) {
    return { message: "El machote de esta escritura ya no está disponible." };
  }

  const existingValuesResult = DocumentValuesSchema.safeParse(
    existing.field_values ?? {},
  );
  if (!existingValuesResult.success) {
    return { message: "No fue posible guardar el borrador. Intenta de nuevo." };
  }

  const result = validateDraftInput(
    formData,
    loaded.fields,
    loaded.document,
    existingValuesResult.data,
  );
  if ("state" in result) return result.state;

  const client = await resolveOptionalClientId(
    supabase,
    formData.get("client_id"),
    user.id,
  );
  if ("error" in client) return { message: client.error };

  const { data: updated, error } = await supabase
    .from("documents")
    .update({
      client_id: client.clientId,
      title: result.title,
      field_values: result.values,
      rendered_content: result.rendered,
    })
    .eq("id", documentId)
    .eq("owner_id", user.id)
    .neq("status", "final")
    .select("id")
    .maybeSingle();

  if (error) {
    return { message: "No fue posible guardar el borrador. Intenta de nuevo." };
  }
  if (!updated) {
    return {
      message: "Esta escritura está finalizada. Reábrela antes de editarla.",
    };
  }

  revalidatePath("/dashboard/documents");
  revalidatePath(`/dashboard/documents/${documentId}`);
  return { success: true };
}

// ------------------------------------------------------------------ delete draft

export async function deleteDocumentDraftAction(
  documentId: string,
  _prevState: DeleteDocumentState,
  _formData: FormData,
): Promise<DeleteDocumentState> {
  void _prevState;
  void _formData;

  const { supabase, user } = await requireUser();

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { message: "No se encontró la escritura." };
  }

  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { message: "No se pudo eliminar el borrador. Intenta de nuevo." };
  }

  revalidatePath("/dashboard/documents");
  return { success: true };
}
