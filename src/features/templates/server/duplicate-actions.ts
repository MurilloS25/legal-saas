"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import { hasPermission } from "@/lib/server/permissions";
import { resolveTemplateContent } from "@/lib/editor/content";
import type { Database } from "@/lib/supabase/database.types";
import { queryTemplateIndexConfiguration } from "@/features/notarial-index/server";
import { TemplateIdSchema } from "../model/templates";
import {
  toVariableAutofillSource,
  toVariableOutputTransform,
} from "../model/variable-autofill";
import {
  buildDuplicateIndexMapping,
  buildDuplicateTemplateName,
  duplicateTemplateNameBase,
  regenerateOptionBlockIds,
} from "../model/duplicate";
import type { DuplicateTemplateState } from "../model/action-state";
import { buildSaveTemplateWorkspaceArgs } from "./template-workspace-rpc";

type Supabase = Awaited<ReturnType<typeof requireWorkspace>>["supabase"];
type IndexMappingArgs =
  Database["public"]["Functions"]["save_template_index_mapping_with_block_source"]["Args"];

const NOT_FOUND = "No se encontró el machote.";
const GENERIC_ERROR = "No fue posible duplicar el machote. Intenta de nuevo.";

/** Escapa los comodines de `ilike` para buscar el nombre literal. */
function likeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Duplica un Machote del Workspace como un Machote NUEVO en borrador, para
 * crear variantes sin reconstruirlo ni volver a generarlo con IA.
 *
 * Copia: nombre ("… - Copia", "… - Copia 2"), descripción, contenido
 * (incluidos Bloques de opciones y sus variantes), variables con su
 * etiqueta, obligatoriedad, autollenado y transformación, la configuración
 * del Índice Notarial (campos, hora desde Bloque, Partes, separador,
 * sufijo, "no requiere Partes") y el default de inclusión en el Índice.
 *
 * Nunca copia: id ni IDs internos (campos y Bloques reciben IDs nuevos),
 * estado (siempre `draft`), fechas, Escrituras creadas desde el original ni
 * la metadata de generación con IA (`ai_template_generations` sigue
 * apuntando solo al original: la copia no aparece como generada por IA).
 *
 * Autorización en servidor: `templates.write` + Workspace activo; el origen
 * se lee filtrado por Workspace (y RLS), y las RPCs vuelven a validar
 * membresía y rol. Si un paso posterior a la creación falla, la copia
 * parcial se elimina para no dejar un Machote a medias.
 */
export async function duplicateTemplateAction(
  templateId: string,
  _prevState: DuplicateTemplateState,
  _formData: FormData,
): Promise<DuplicateTemplateState> {
  void _prevState;
  void _formData;

  const { supabase, role, workspaceId } = await requireWorkspace();
  if (!hasPermission(role, "templates.write")) {
    return { message: "Tu rol no permite duplicar machotes." };
  }
  if (!TemplateIdSchema.safeParse(templateId).success) {
    return { message: NOT_FOUND };
  }

  const { data: source, error: sourceError } = await supabase
    .from("templates")
    .select("name, description, content_json, include_in_notarial_index_by_default")
    .eq("id", templateId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (sourceError) throwDataAccessError("load template to duplicate", sourceError);
  if (!source) return { message: NOT_FOUND };

  const { data: sourceFields, error: fieldsError } = await supabase
    .from("template_fields")
    .select("id, field_key, label, required, autofill_source, output_transform")
    .eq("template_id", templateId)
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (fieldsError) throwDataAccessError("load template fields to duplicate", fieldsError);
  const fields = sourceFields ?? [];

  const indexConfiguration = await queryTemplateIndexConfiguration(
    supabase,
    workspaceId,
    templateId,
  );

  const base = duplicateTemplateNameBase(source.name);
  const { data: copyNames, error: namesError } = await supabase
    .from("templates")
    .select("name")
    .eq("workspace_id", workspaceId)
    .ilike("name", `${likeLiteral(base)} - Copia%`);
  if (namesError) throwDataAccessError("list template copy names", namesError);

  const { document } = resolveTemplateContent(source.content_json);
  const { document: copyDocument, blockIdMap } = regenerateOptionBlockIds(document);

  const { data: created, error: createError } = await supabase
    .rpc(
      "save_template_workspace",
      buildSaveTemplateWorkspaceArgs({
        templateId: null,
        expectedUpdatedAt: null,
        name: buildDuplicateTemplateName(
          source.name,
          (copyNames ?? []).map((row) => row.name),
        ),
        description: source.description,
        status: "draft",
        document: copyDocument,
        variables: fields.map((field) => ({
          field_key: field.field_key,
          label: field.label,
          required: field.required,
          autofill_source: toVariableAutofillSource(field.autofill_source),
          output_transform: toVariableOutputTransform(field.output_transform),
        })),
      }),
    )
    .single();
  if (createError || !created) return { message: GENERIC_ERROR };
  const copyId = created.template_id;

  const copied = await copyNotarialConfiguration(supabase, {
    workspaceId,
    copyId,
    indexConfiguration,
    sourceFieldKeyById: new Map(fields.map((field) => [field.id, field.field_key])),
    blockIdMap,
    includeByDefault: source.include_in_notarial_index_by_default,
  });
  if (!copied) {
    await supabase
      .from("templates")
      .delete()
      .eq("id", copyId)
      .eq("workspace_id", workspaceId);
    return { message: GENERIC_ERROR };
  }

  revalidatePath("/templates");
  redirect(`/templates/${copyId}?duplicated=1`);
}

async function copyNotarialConfiguration(
  supabase: Supabase,
  input: {
    workspaceId: string;
    copyId: string;
    indexConfiguration: Awaited<ReturnType<typeof queryTemplateIndexConfiguration>>;
    sourceFieldKeyById: Map<string, string>;
    blockIdMap: Map<string, string>;
    includeByDefault: boolean;
  },
): Promise<boolean> {
  if (input.indexConfiguration) {
    const { data: copyFields, error } = await supabase
      .from("template_fields")
      .select("id, field_key")
      .eq("template_id", input.copyId)
      .eq("workspace_id", input.workspaceId);
    if (error || !copyFields) return false;

    const args = buildDuplicateIndexMapping({
      templateId: input.copyId,
      configuration: input.indexConfiguration,
      sourceFieldKeyById: input.sourceFieldKeyById,
      targetFieldIdByKey: new Map(copyFields.map((field) => [field.field_key, field.id])),
      blockIdMap: input.blockIdMap,
    });
    const { error: mappingError } = await supabase.rpc(
      "save_template_index_mapping_with_block_source",
      // Generated function args do not encode nullable PostgreSQL parameters.
      args as unknown as IndexMappingArgs,
    );
    if (mappingError) return false;
  }

  // Un Machote nuevo nace incluido en el Índice (default de la columna);
  // solo hace falta copiar la preferencia cuando el original la desactivó.
  if (!input.includeByDefault) {
    const { error } = await supabase.rpc("set_template_notarial_index_default", {
      p_template_id: input.copyId,
      p_include_by_default: false,
    });
    if (error) return false;
  }
  return true;
}
