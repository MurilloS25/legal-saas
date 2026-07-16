import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import { TemplateIdSchema } from "@/features/templates";
import type { TemplateIndexConfiguration } from "../model/template-index-configuration";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

export async function queryTemplateIndexConfiguration(
  supabase: Supabase,
  ownerId: string,
  templateId: string,
): Promise<TemplateIndexConfiguration | null> {
  const { data: configuration, error } = await supabase
    .from("template_index_configurations")
    .select(
      "id, template_id, party_separator, fixed_suffix, allow_empty, is_complete",
    )
    .eq("owner_id", ownerId)
    .eq("template_id", templateId)
    .maybeSingle();

  if (error) throwDataAccessError("get template index configuration", error);
  if (!configuration) return null;

  const { data: fields, error: fieldsError } = await supabase
    .from("template_index_configuration_fields")
    .select("template_field_id, sort_order")
    .eq("owner_id", ownerId)
    .eq("configuration_id", configuration.id)
    .order("sort_order", { ascending: true })
    .order("template_field_id", { ascending: true });

  if (fieldsError) {
    throwDataAccessError("get template index configuration fields", fieldsError);
  }

  return {
    id: configuration.id,
    templateId: configuration.template_id,
    partySeparator: configuration.party_separator,
    fixedSuffix: configuration.fixed_suffix,
    allowEmpty: configuration.allow_empty,
    isComplete: configuration.is_complete,
    fields: (fields ?? []).map((field) => ({
      templateFieldId: field.template_field_id,
      order: field.sort_order,
    })),
  };
}

export async function getTemplateIndexConfiguration(
  templateId: string,
): Promise<TemplateIndexConfiguration | null> {
  if (!TemplateIdSchema.safeParse(templateId).success) return null;
  const { supabase, user } = await requireUser();
  return queryTemplateIndexConfiguration(supabase, user.id, templateId);
}
