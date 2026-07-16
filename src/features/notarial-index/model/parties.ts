export type IndexPartyValue = {
  templateFieldId: string;
  order: number;
  value: unknown;
};

export type GenerateIndexPartiesInput = {
  fields: readonly IndexPartyValue[];
  separator: string;
  fixedSuffix: string | null;
};

export type ConfiguredPartyField = {
  id: string;
  fieldKey: string;
};

export type PartiesConfigurationView = {
  isComplete: boolean;
  partySeparator: string;
  fixedSuffix: string | null;
  fields: ReadonlyArray<{ templateFieldId: string; order: number }>;
};

function normalizePartyValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

export function generateIndexParties({
  fields,
  separator,
  fixedSuffix,
}: GenerateIndexPartiesInput): string {
  const normalizedSeparator = (separator === "" ? " " : separator)
    .toLocaleUpperCase("es-CR");
  const ordered = [...fields].sort(
    (left, right) =>
      left.order - right.order ||
      left.templateFieldId.localeCompare(right.templateFieldId),
  );
  const seen = new Set<string>();
  const values: string[] = [];

  for (const field of ordered) {
    const value = normalizePartyValue(field.value);
    const key = value.toLocaleUpperCase("es-CR");
    if (value === "" || seen.has(key)) continue;
    seen.add(key);
    values.push(key);
  }

  const suffix = normalizePartyValue(fixedSuffix).toLocaleUpperCase("es-CR");
  if (suffix !== "" && !seen.has(suffix)) values.push(suffix);

  return values.join(normalizedSeparator).trim();
}

export function generateConfiguredPartiesPreview(
  configuration: PartiesConfigurationView | null,
  availableFields: readonly ConfiguredPartyField[],
  fieldValues: Record<string, unknown>,
): string | null {
  if (!configuration?.isComplete) return null;
  const fieldsById = new Map(availableFields.map((field) => [field.id, field]));
  if (
    configuration.fields.some(
      (field) => !fieldsById.has(field.templateFieldId),
    )
  ) {
    return null;
  }
  const generated = generateIndexParties({
    fields: configuration.fields.map((field) => {
      const available = fieldsById.get(field.templateFieldId);
      return {
        templateFieldId: field.templateFieldId,
        order: field.order,
        value: available ? fieldValues[available.fieldKey] : "",
      };
    }),
    separator: configuration.partySeparator,
    fixedSuffix: configuration.fixedSuffix,
  });
  return generated === "" ? null : generated;
}
