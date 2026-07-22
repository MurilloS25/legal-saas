"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import { DocumentIdSchema } from "../model/document-schema";
import { buildDuplicateDocumentTitle } from "../model/duplicate";

export type DuplicateDocumentState = {
  message?: string;
};

/**
 * Duplica una escritura propia (borrador o finalizada) como un borrador
 * nuevo e independiente.
 *
 * Copia: machote de origen, contenido/valores de variables, selecciones de
 * Bloques de opciones, cliente principal y el contenido renderizado (se
 * recalcula igual que en creación, pero copiarlo es equivalente ya que el
 * machote y los valores son los mismos).
 *
 * Nunca copia: id, estado (siempre nace `draft`), fechas, historial de
 * actividad, metadata notarial (número de instrumento, fechas de
 * autorización, etc. — únicos por instrumento) ni cuentas por cobrar/pagos.
 * El original nunca se modifica, sin importar su estado.
 */
export async function duplicateDocumentAction(
  documentId: string,
  _prevState: DuplicateDocumentState,
  _formData: FormData,
): Promise<DuplicateDocumentState> {
  void _prevState;
  void _formData;

  const { supabase, user } = await requireUser();

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { message: "No se encontró la escritura." };
  }

  const { data: source, error: sourceError } = await supabase
    .from("documents")
    .select(
      "title, template_id, client_id, field_values, option_selections, rendered_content",
    )
    .eq("id", documentId)
    .eq("owner_id", user.id)
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
      template_id: source.template_id,
      client_id: source.client_id,
      title: buildDuplicateDocumentTitle(source.title),
      status: "draft",
      field_values: source.field_values,
      option_selections: source.option_selections,
      rendered_content: source.rendered_content,
    })
    .select("id")
    .single();

  if (insertError || !copy) {
    return { message: "No fue posible duplicar la escritura. Intenta de nuevo." };
  }

  revalidatePath("/dashboard/documents");
  redirect(`/dashboard/documents/${copy.id}?lifecycle=duplicated`);
}
