import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import { generateConfiguredPartiesPreview } from "../model/parties";
import { isTemplateIndexConfigurationResolved } from "../model/template-index-configuration";
import { queryTemplateIndexConfiguration } from "./template-index-config-queries";

type Supabase = Awaited<ReturnType<typeof requireWorkspace>>["supabase"];

export type ConfiguredPartiesResult =
  | { status: "missing" | "incomplete"; value: null }
  | { status: "ready"; value: string | null };

export async function generateConfiguredParties(
  supabase: Supabase,
  workspaceId: string,
  templateId: string,
  fieldValues: unknown,
): Promise<ConfiguredPartiesResult> {
  const configuration = await queryTemplateIndexConfiguration(
    supabase,
    workspaceId,
    templateId,
  );
  if (!configuration) return { status: "missing", value: null };
  if (!isTemplateIndexConfigurationResolved(configuration)) {
    return { status: "incomplete", value: null };
  }

  const selectedIds = configuration.fields.map(
    (field) => field.templateFieldId,
  );
  let availableFields: Array<{ id: string; fieldKey: string }> = [];
  if (selectedIds.length > 0) {
    const { data, error } = await supabase
      .from("template_fields")
      .select("id, field_key")
      .eq("workspace_id", workspaceId)
      .eq("template_id", templateId)
      .in("id", selectedIds);
    if (error) throwDataAccessError("load configured index fields", error);
    availableFields = (data ?? []).map((field) => ({
      id: field.id,
      fieldKey: field.field_key,
    }));
  }

  const values =
    fieldValues && typeof fieldValues === "object" && !Array.isArray(fieldValues)
      ? (fieldValues as Record<string, unknown>)
      : {};
  const generated = generateConfiguredPartiesPreview(
    configuration,
    availableFields,
    values,
  );
  if (selectedIds.length !== availableFields.length) {
    return { status: "incomplete", value: null };
  }
  return { status: "ready", value: generated };
}
