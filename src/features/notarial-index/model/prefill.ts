import { isoToCostaRicaLocal } from "./datetime";
import type {
  NotarialMetadata,
  NotarialMetadataSuggestions,
} from "./notarial";
import type {
  SimpleIndexMappingKey,
  TemplateIndexConfiguration,
} from "./template-index-configuration";

export type NotarialPrefillSource =
  | "saved"
  | "template"
  | "suggestion"
  | "empty";

export type NotarialPrefillField = {
  value: string;
  source: NotarialPrefillSource;
  compatible: boolean;
  rawValue?: string;
};

export type NotarialAuthorizedAtPrefill = NotarialPrefillField & {
  rawDate?: string;
  rawTime?: string;
};

export type NotarialMetadataPrefill = {
  instrumentNumber: NotarialPrefillField;
  authorizedAt: NotarialAuthorizedAtPrefill;
  protocolBook: NotarialPrefillField;
  initialFolio: NotarialPrefillField;
  finalFolio: NotarialPrefillField;
  actName: NotarialPrefillField;
  parties: NotarialPrefillField;
};

type AvailableField = { id: string; fieldKey: string };

type ResolveInput = {
  metadata: NotarialMetadata | null;
  configuration: TemplateIndexConfiguration | null;
  availableFields: readonly AvailableField[];
  fieldValues: Record<string, unknown>;
  templateName: string | null;
  generatedParties: string | null;
  suggestions: NotarialMetadataSuggestions;
};

const emptyField = (): NotarialPrefillField => ({
  value: "",
  source: "empty",
  compatible: true,
});

function savedField(value: string | number | null): NotarialPrefillField {
  return {
    value: value === null ? "" : String(value),
    source: "saved",
    compatible: true,
  };
}

function mappedValue(
  key: SimpleIndexMappingKey,
  configuration: TemplateIndexConfiguration | null,
  availableFields: readonly AvailableField[],
  fieldValues: Record<string, unknown>,
): string | null {
  const mappedId = configuration?.simpleFields[key];
  if (!mappedId) return null;
  const field = availableFields.find((candidate) => candidate.id === mappedId);
  if (!field) return null;
  const value = fieldValues[field.fieldKey];
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

function textPrefill(
  mapped: string | null,
  suggestion: string | null,
): NotarialPrefillField {
  if (mapped !== null) {
    return { value: mapped, source: "template", compatible: true };
  }
  if (suggestion !== null && suggestion !== "") {
    return { value: suggestion, source: "suggestion", compatible: true };
  }
  return emptyField();
}

function instrumentPrefill(
  mapped: string | null,
  suggestion: number | null,
): NotarialPrefillField {
  if (mapped !== null) {
    const compatible = /^[1-9]\d*$/.test(mapped);
    return {
      value: compatible ? mapped : "",
      source: "template",
      compatible,
      rawValue: mapped,
    };
  }
  if (suggestion !== null) {
    return {
      value: String(suggestion),
      source: "suggestion",
      compatible: true,
    };
  }
  return emptyField();
}

function authorizedAtPrefill(
  rawDate: string | null,
  rawTime: string | null,
): NotarialAuthorizedAtPrefill {
  if (rawDate === null && rawTime === null) return emptyField();
  const dateCompatible =
    rawDate !== null && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(rawDate);
  const timeCompatible =
    rawTime !== null &&
    /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(rawTime);
  const compatible = dateCompatible && timeCompatible;
  return {
    value: compatible ? `${rawDate}T${rawTime}` : "",
    source: "template",
    compatible,
    rawDate: rawDate ?? undefined,
    rawTime: rawTime ?? undefined,
  };
}

export function resolveNotarialMetadataPrefill({
  metadata,
  configuration,
  availableFields,
  fieldValues,
  templateName,
  generatedParties,
  suggestions,
}: ResolveInput): NotarialMetadataPrefill {
  if (metadata) {
    return {
      instrumentNumber: savedField(metadata.instrument_number),
      authorizedAt: {
        ...savedField(isoToCostaRicaLocal(metadata.authorized_at)),
      },
      protocolBook: savedField(metadata.protocol_book),
      initialFolio: savedField(metadata.initial_folio),
      finalFolio: savedField(metadata.final_folio),
      actName: savedField(
        metadata.act_name_override ?? metadata.act_name_snapshot,
      ),
      parties: savedField(
        metadata.parties_override ?? metadata.generated_parties,
      ),
    };
  }

  const mapped = (key: SimpleIndexMappingKey) =>
    mappedValue(key, configuration, availableFields, fieldValues);

  return {
    instrumentNumber: instrumentPrefill(
      mapped("instrument_number"),
      suggestions.instrumentNumber,
    ),
    authorizedAt: authorizedAtPrefill(
      mapped("authorized_date"),
      mapped("authorized_time"),
    ),
    protocolBook: textPrefill(
      mapped("protocol_book"),
      suggestions.protocolBook,
    ),
    initialFolio: textPrefill(
      mapped("initial_folio"),
      suggestions.initialFolio,
    ),
    finalFolio: textPrefill(
      mapped("final_folio"),
      suggestions.initialFolio,
    ),
    actName: templateName
      ? { value: templateName, source: "template", compatible: true }
      : emptyField(),
    parties: generatedParties
      ? { value: generatedParties, source: "template", compatible: true }
      : emptyField(),
  };
}
