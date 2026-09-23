import "server-only";

/**
 * Argumentos de la RPC `save_template_workspace`, compartidos por el
 * guardado manual del workspace y por "Crear con IA", para que ambos
 * caminos persistan exactamente igual (mismo contenido de compatibilidad,
 * mismo preview, mismos campos).
 */

import { buildTemplateContentJson } from "@/lib/editor/content";
import type { TemplateDocument } from "@/lib/editor/types";
import type { Database } from "@/lib/supabase/database.types";
import type { TemplateWorkspaceVariable } from "../model/template-workspace";

export type SaveTemplateArgs =
  Database["public"]["Functions"]["save_template_workspace"]["Args"];

export function buildSaveTemplateWorkspaceArgs(input: {
  templateId: string | null;
  expectedUpdatedAt: string | null;
  name: string;
  description: string | null | undefined;
  status: string;
  document: TemplateDocument;
  variables: TemplateWorkspaceVariable[];
}): SaveTemplateArgs {
  const contentJson = buildTemplateContentJson(input.document);
  const args = {
    p_template_id: input.templateId,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_name: input.name,
    p_description: input.description ?? null,
    p_status: input.status,
    p_content_json: contentJson,
    p_text_preview: contentJson.text.slice(0, 300),
    p_fields: input.variables.map(
      ({ field_key, label, required, autofill_source, output_transform }) => ({
        field_key,
        label,
        required,
        autofill_source,
        output_transform,
      }),
    ),
  };
  // Generated function args do not encode nullable PostgreSQL parameters.
  return args as unknown as SaveTemplateArgs;
}
