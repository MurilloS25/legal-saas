import type { OptionBlockSummary } from "@/lib/editor/option-blocks";

export type IndexConfigurationField = {
  id: string;
  fieldKey: string;
  label: string;
};

/** All option blocks in the template, including blocks without a time mapping. */
export type IndexConfigurationOptionBlock = OptionBlockSummary;
