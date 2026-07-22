import { isoToCostaRicaLocal } from "./datetime";
import type {
  NotarialMetadata,
  NotarialMetadataSuggestions,
} from "./notarial";
import type {
  SimpleIndexMappingKey,
  TemplateIndexConfiguration,
} from "./template-index-configuration";
import {
  normalizeNotarialValue,
  NOTARIAL_SEMANTIC_TYPES,
} from "./normalization";
import type { TemplateDocument } from "@/lib/editor/types";
import {
  resolveOptionBlockTime,
  type OptionBlockTimeResult,
} from "./option-block-time";

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
  optionBlockName?: string;
  optionVariantLabel?: string;
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
  templateDocument?: TemplateDocument;
  optionSelections?: Record<string, string>;
  templateName: string | null;
  generatedParties: string | null;
  suggestions: NotarialMetadataSuggestions;
};

const emptyField = (): NotarialPrefillField => ({
  value: "",
  source: "empty",
  compatible: true,
});

function savedField(
  value: string | number | null,
  rawValue?: string,
): NotarialPrefillField {
  return {
    value: value === null ? "" : String(value),
    source: "saved",
    compatible: true,
    rawValue,
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

function integerPrefill(
  key:
    | "instrument_number"
    | "protocol_book"
    | "initial_folio"
    | "final_folio",
  mapped: string | null,
  suggestion: string | number | null,
): NotarialPrefillField {
  const candidate = mapped ?? (suggestion === null ? null : String(suggestion));
  if (candidate === null) return emptyField();
  const normalized = normalizeNotarialValue({
    value: candidate,
    type: NOTARIAL_SEMANTIC_TYPES[key],
    locale: "es-CR",
  });
  return {
    value: normalized.ok ? String(normalized.value) : "",
    source: mapped === null ? "suggestion" : "template",
    compatible: normalized.ok,
    rawValue: candidate,
  };
}

function authorizedAtPrefill(
  rawDate: string | null,
  timeValue: string | null,
  rawTime: string | null = timeValue,
  optionBlock?: OptionBlockTimeResult,
): NotarialAuthorizedAtPrefill {
  if (rawDate === null && rawTime === null && !optionBlock) return emptyField();
  const date =
    rawDate === null
      ? null
      : normalizeNotarialValue({
          value: rawDate,
          type: NOTARIAL_SEMANTIC_TYPES.authorized_date,
          locale: "es-CR",
        });
  const time =
    timeValue === null
      ? null
      : normalizeNotarialValue({
          value: timeValue,
          type: NOTARIAL_SEMANTIC_TYPES.authorized_time,
          locale: "es-CR",
        });
  const compatible =
    date?.ok === true && time?.ok === true && optionBlock?.ok !== false;
  return {
    value: compatible ? `${date.value}T${time.value}` : "",
    source: "template",
    compatible,
    rawDate: rawDate ?? undefined,
    rawTime: rawTime ?? undefined,
    optionBlockName: optionBlock?.blockName,
    optionVariantLabel: optionBlock?.variantLabel,
  };
}

export function resolveNotarialMetadataPrefill({
  metadata,
  configuration,
  availableFields,
  fieldValues,
  templateDocument,
  optionSelections = {},
  templateName,
  generatedParties,
  suggestions,
}: ResolveInput): NotarialMetadataPrefill {
  const mapped = (key: SimpleIndexMappingKey) =>
    mappedValue(key, configuration, availableFields, fieldValues);
  const optionBlockTime =
    configuration?.authorizedTimeOptionBlockId && templateDocument
      ? resolveOptionBlockTime(
          templateDocument,
          configuration.authorizedTimeOptionBlockId,
          optionSelections,
          fieldValues,
        )
      : undefined;
  const mappedTime = optionBlockTime?.ok
    ? optionBlockTime.value
    : mapped("authorized_time");
  const rawTime = optionBlockTime
    ? (optionBlockTime.rawValue ?? null)
    : mappedTime;

  if (metadata) {
    return {
      instrumentNumber: savedField(
        metadata.instrument_number,
        mapped("instrument_number") ?? undefined,
      ),
      authorizedAt: {
        ...savedField(isoToCostaRicaLocal(metadata.authorized_at)),
        rawDate: mapped("authorized_date") ?? undefined,
        rawTime: rawTime ?? undefined,
        optionBlockName: optionBlockTime?.blockName,
        optionVariantLabel: optionBlockTime?.variantLabel,
      },
      protocolBook: savedField(
        metadata.protocol_book,
        mapped("protocol_book") ?? undefined,
      ),
      initialFolio: savedField(
        metadata.initial_folio,
        mapped("initial_folio") ?? undefined,
      ),
      finalFolio: savedField(
        metadata.final_folio,
        mapped("final_folio") ?? undefined,
      ),
      actName: savedField(
        metadata.act_name_override ?? metadata.act_name_snapshot,
      ),
      parties: savedField(
        metadata.parties_override ?? metadata.generated_parties,
      ),
    };
  }

  return {
    instrumentNumber: integerPrefill(
      "instrument_number",
      mapped("instrument_number"),
      suggestions.instrumentNumber,
    ),
    authorizedAt: authorizedAtPrefill(
      mapped("authorized_date"),
      mappedTime,
      rawTime,
      optionBlockTime,
    ),
    protocolBook: integerPrefill(
      "protocol_book",
      mapped("protocol_book"),
      suggestions.protocolBook,
    ),
    initialFolio: integerPrefill(
      "initial_folio",
      mapped("initial_folio"),
      suggestions.initialFolio,
    ),
    finalFolio: integerPrefill(
      "final_folio",
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
