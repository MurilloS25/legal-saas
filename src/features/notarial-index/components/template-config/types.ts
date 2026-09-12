import type { OptionBlockSummary } from "@/lib/editor/option-blocks";
import type { SimpleIndexMappingKey } from "../../model/template-index-configuration";

export type IndexConfigurationField = {
  id: string;
  fieldKey: string;
  label: string;
};

/** All option blocks in the template, including blocks without a time mapping. */
export type IndexConfigurationOptionBlock = OptionBlockSummary;

export type TemplateIndexPartiesMode =
  | "pending"
  | "required"
  | "not_required";

export const TEMPLATE_INDEX_SIMPLE_FIELDS: Array<{
  key: SimpleIndexMappingKey;
  label: string;
}> = [
  { key: "instrument_number", label: "Número de instrumento" },
  { key: "authorized_date", label: "Fecha de autorización" },
  { key: "authorized_time", label: "Hora de autorización" },
  { key: "protocol_book", label: "Tomo" },
  { key: "initial_folio", label: "Folio inicial" },
  { key: "final_folio", label: "Folio final" },
];
