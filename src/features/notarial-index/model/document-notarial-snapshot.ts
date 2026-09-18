import type { DocumentNotarialSnapshot } from "@/lib/documents/notarial-snapshot";
import type { TemplateIndexConfiguration } from "./template-index-configuration";

type TemplateFieldIdentity = { id: string; fieldKey: string };

export type ResolvedDocumentNotarialSnapshot = {
  templateName: string;
  configuration: TemplateIndexConfiguration | null;
  availableFields: TemplateFieldIdentity[];
};

/**
 * Converts database identifiers into stable field keys before the
 * configuration is attached to an Escritura. Template field row ids belong
 * to the mutable Machote; field keys belong to the captured document model.
 */
export function createDocumentNotarialSnapshot(
  templateName: string,
  configuration: TemplateIndexConfiguration | null,
  fields: readonly TemplateFieldIdentity[],
): DocumentNotarialSnapshot {
  const keyById = new Map(fields.map((field) => [field.id, field.fieldKey]));
  const mappedKey = (id: string | null) => (id ? keyById.get(id) ?? null : null);

  return {
    templateName,
    configuration: configuration
      ? {
          partySeparator: configuration.partySeparator,
          fixedSuffix: configuration.fixedSuffix,
          allowEmpty: configuration.allowEmpty,
          mappingsValid: configuration.mappingsValid,
          simpleFields: {
            instrument_number: mappedKey(configuration.simpleFields.instrument_number),
            authorized_date: mappedKey(configuration.simpleFields.authorized_date),
            authorized_time: mappedKey(configuration.simpleFields.authorized_time),
            protocol_book: mappedKey(configuration.simpleFields.protocol_book),
            initial_folio: mappedKey(configuration.simpleFields.initial_folio),
            final_folio: mappedKey(configuration.simpleFields.final_folio),
          },
          authorizedTimeOptionBlockId: configuration.authorizedTimeOptionBlockId,
          invalidMappings: configuration.invalidMappings,
          fields: configuration.fields.flatMap((field) => {
            const fieldKey = keyById.get(field.templateFieldId);
            return fieldKey ? [{ fieldKey, order: field.order }] : [];
          }),
        }
      : null,
  };
}

/** Rehydrates the key-based snapshot into the existing derivation contract. */
export function resolveDocumentNotarialSnapshot(
  snapshot: DocumentNotarialSnapshot,
): ResolvedDocumentNotarialSnapshot {
  const availableKeys = new Set<string>();
  const configuration = snapshot.configuration;
  if (configuration) {
    for (const value of Object.values(configuration.simpleFields)) {
      if (value) availableKeys.add(value);
    }
    for (const field of configuration.fields) availableKeys.add(field.fieldKey);
  }
  const availableFields = [...availableKeys].map((fieldKey) => ({
    id: fieldKey,
    fieldKey,
  }));

  return {
    templateName: snapshot.templateName,
    availableFields,
    configuration: configuration
      ? {
          id: "document-snapshot",
          templateId: "document-snapshot",
          partySeparator: configuration.partySeparator,
          fixedSuffix: configuration.fixedSuffix,
          allowEmpty: configuration.allowEmpty,
          mappingsValid: configuration.mappingsValid,
          simpleFields: configuration.simpleFields,
          authorizedTimeOptionBlockId: configuration.authorizedTimeOptionBlockId,
          invalidMappings: configuration.invalidMappings,
          fields: configuration.fields.map((field) => ({
            templateFieldId: field.fieldKey,
            order: field.order,
          })),
        }
      : null,
  };
}
