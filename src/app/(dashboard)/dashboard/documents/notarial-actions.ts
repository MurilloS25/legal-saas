"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentIdSchema } from "@/lib/validations/documents";
import { parseNotarialFormData } from "@/lib/validations/notarial";

export type NotarialMetadataState = {
  errors?: Partial<Record<string, string>>;
  message?: string;
  success?: boolean;
};

/**
 * Guarda (crea o actualiza) la metadata del índice notarial de una Escritura.
 * Bloquea la edición si la Escritura está finalizada (defensa en profundidad:
 * también lo impide un trigger). El registro de actividad y la completitud los
 * derivan el trigger de la tabla.
 */
export async function saveNotarialMetadataAction(
  documentId: string,
  _prevState: NotarialMetadataState,
  formData: FormData,
): Promise<NotarialMetadataState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!DocumentIdSchema.safeParse(documentId).success) {
    return { message: "No se encontró la escritura." };
  }

  const { data: document } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!document) return { message: "No se encontró la escritura." };

  if (document.status === "final") {
    return {
      message:
        "La escritura está finalizada. Reábrela para editar los datos del índice.",
    };
  }

  const parsed = parseNotarialFormData(formData);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [key, messages] of Object.entries(fieldErrors)) {
      if (messages && messages[0]) errors[key] = messages[0];
    }
    return { errors };
  }

  const { data: existing } = await supabase
    .from("document_notarial_metadata")
    .select("id")
    .eq("document_id", documentId)
    .eq("owner_id", user.id)
    .maybeSingle();

  const values = parsed.data;

  const { error } = existing
    ? await supabase
        .from("document_notarial_metadata")
        .update(values)
        .eq("document_id", documentId)
        .eq("owner_id", user.id)
    : await supabase.from("document_notarial_metadata").insert({
        owner_id: user.id,
        document_id: documentId,
        ...values,
      });

  if (error) {
    return {
      message: "No fue posible guardar los datos del índice. Intenta de nuevo.",
    };
  }

  revalidatePath(`/dashboard/documents/${documentId}`);
  return { success: true };
}
