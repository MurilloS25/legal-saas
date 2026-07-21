import "server-only";

/**
 * Carga las preferencias de formato guardadas del dueño en `document_settings`
 * y las resuelve a `DocumentFormattingPreferences` (con defaults para lo
 * ausente o inválido). Único punto de lectura de `document_settings` para
 * generación DOCX — todos los exportadores (Escrituras, Índice Notarial)
 * pasan por aquí para no duplicar la consulta ni la resolución de defaults.
 */

import type { requireApiUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import {
  resolveDocumentFormatting,
  type DocumentFormattingPreferences,
} from "./formatting";

type Supabase = Awaited<ReturnType<typeof requireApiUser>>["supabase"];

export async function loadDocumentFormattingPreferences(
  supabase: Supabase,
  ownerId: string,
): Promise<DocumentFormattingPreferences> {
  const { data, error } = await supabase
    .from("document_settings")
    .select(
      "font_family, font_size, margin_top_cm, margin_bottom_cm, margin_left_cm, margin_right_cm, line_spacing",
    )
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throwDataAccessError("load document formatting settings", error);

  return resolveDocumentFormatting(data);
}
