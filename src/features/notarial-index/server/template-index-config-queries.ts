import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import { TemplateIdSchema } from "@/features/templates";
import {
  INDEX_MAPPING_KEYS,
  type InvalidIndexMapping,
  type TemplateIndexConfiguration,
} from "../model/template-index-configuration";

type Supabase = Awaited<ReturnType<typeof requireWorkspace>>["supabase"];

export async function queryTemplateIndexConfiguration(
  supabase: Supabase,
  workspaceId: string,
  templateId: string,
): Promise<TemplateIndexConfiguration | null> {
  const { data: configuration, error } = await supabase
    .from("template_index_configurations")
    .select(
      "id, template_id, instrument_number_field_id, authorized_date_field_id, authorized_time_field_id, authorized_time_option_block_id, protocol_book_field_id, initial_folio_field_id, final_folio_field_id, invalid_mappings, party_separator, fixed_suffix, allow_empty, is_complete",
    )
    .eq("workspace_id", workspaceId)
    .eq("template_id", templateId)
    .maybeSingle();

  if (error) throwDataAccessError("get template index configuration", error);
  if (!configuration) return null;

  const { data: fields, error: fieldsError } = await supabase
    .from("template_index_configuration_fields")
    .select("template_field_id, sort_order")
    .eq("workspace_id", workspaceId)
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
    simpleFields: {
      instrument_number: configuration.instrument_number_field_id,
      authorized_date: configuration.authorized_date_field_id,
      authorized_time: configuration.authorized_time_field_id,
      protocol_book: configuration.protocol_book_field_id,
      initial_folio: configuration.initial_folio_field_id,
      final_folio: configuration.final_folio_field_id,
    },
    authorizedTimeOptionBlockId:
      configuration.authorized_time_option_block_id,
    invalidMappings: configuration.invalid_mappings.filter(
      (key): key is InvalidIndexMapping =>
        (INDEX_MAPPING_KEYS as readonly string[]).includes(key),
    ),
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
  const { supabase, workspaceId } = await requireWorkspace();
  return queryTemplateIndexConfiguration(supabase, workspaceId, templateId);
}
