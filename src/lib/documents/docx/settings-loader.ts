import "server-only";

/**
 * Carga las preferencias de formato guardadas del Workspace en
 * `document_settings` y las resuelve a `DocumentFormattingPreferences` (con
 * defaults para lo ausente o inválido). Único punto de lectura de
 * `document_settings` para generación DOCX — todos los exportadores
 * (Escrituras, Índice Notarial) pasan por aquí para no duplicar la consulta
 * ni la resolución de defaults. Por Workspace, no por usuario: cualquier
 * miembro que exporte usa el mismo formato compartido de la oficina.
 */

import type { requireApiWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import {
  resolveDocumentFormatting,
  type DocumentFormattingPreferences,
} from "./formatting";

type Supabase = Awaited<ReturnType<typeof requireApiWorkspace>>["supabase"];

export async function loadDocumentFormattingPreferences(
  supabase: Supabase,
  workspaceId: string,
): Promise<DocumentFormattingPreferences> {
  const { data, error } = await supabase
    .from("document_settings")
    .select(
      "font_family, font_size, margin_top_cm, margin_bottom_cm, margin_left_cm, margin_right_cm, line_spacing",
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throwDataAccessError("load document formatting settings", error);

  return resolveDocumentFormatting(data);
}
