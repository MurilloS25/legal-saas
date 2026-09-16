"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import { DocumentIdSchema } from "../model/document-schema";
import { buildDuplicateDocumentTitle } from "../model/duplicate";
import type { DuplicateDocumentState } from "../model/action-state";

/**
 * Duplica una escritura propia (borrador o finalizada) como un borrador
 * nuevo e independiente.
 *
 * Copia: referencia al machote de origen, snapshot estructurado, valores de
 * variables, selecciones de Bloques de opciones, cliente principal y
 * contenido renderizado. Así la copia representa exactamente la versión
 * documental del original aunque el Machote haya cambiado después.
 *
 * Nunca copia: id, estado (siempre nace `draft`), fechas, historial de
 * actividad, metadata notarial (número de instrumento, fechas de
 * autorización, etc. — únicos por instrumento), cuentas por cobrar/pagos, ni
 * la pertenencia al Índice Notarial del original (si esta se corrigió
 * individualmente) — la copia toma el default actual del Machote, igual que
 * cualquier Escritura nueva creada desde él.
 * El original nunca se modifica, sin importar su estado.
 */
export async function duplicateDocumentAction(
  documentId: string,
  _prevState: DuplicateDocumentState,
  _formData: FormData,
): Promise<DuplicateDocumentState> {
  void _prevState;
  void _formData;

  const { supabase, user, workspaceId } = await requireWorkspace();

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { message: "No se encontró la escritura." };
  }

  const { data: source, error: sourceError } = await supabase
    .from("documents")
    .select(
      "title, template_id, client_id, field_values, option_selections, rendered_content, template_snapshot",
    )
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (sourceError) {
    throwDataAccessError("load document to duplicate", sourceError);
  }
  if (!source) {
    return { message: "No se encontró la escritura." };
  }

  const { data: copy, error: insertError } = await supabase
    .from("documents")
    .insert({
      owner_id: user.id,
      workspace_id: workspaceId,
      template_id: source.template_id,
      client_id: source.client_id,
      title: buildDuplicateDocumentTitle(source.title),
      status: "draft",
      field_values: source.field_values,
      option_selections: source.option_selections,
      rendered_content: source.rendered_content,
      template_snapshot: source.template_snapshot,
      // Nace desde el machote de origen, no del original que se duplica —
      // el trigger `documents_notarial_index_snapshot` (ver 20260822090000)
      // deriva `include_in_notarial_index` de `template_id` al insertar, sin
      // copiar el posible override individual de la Escritura original.
    })
    .select("id")
    .single();

  if (insertError || !copy) {
    return { message: "No fue posible duplicar la escritura. Intenta de nuevo." };
  }

  revalidatePath("/dashboard/documents");
  redirect(`/dashboard/documents/${copy.id}?lifecycle=duplicated`);
}
