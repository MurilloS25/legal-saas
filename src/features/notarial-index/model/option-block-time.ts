import type {
  TemplateDocument,
  TemplateOptionBlockNode,
} from "@/lib/editor/types";
import { normalizeNotarialValue } from "./normalization";

export type OptionBlockTimeResult =
  | {
      ok: true;
      value: string;
      rawValue: string;
      blockName: string;
      variantLabel: string;
    }
  | {
      ok: false;
      reason: "block_not_found" | "invalid_configuration" | "missing" | "invalid";
      rawValue?: string;
      blockName?: string;
      variantLabel?: string;
    };

function findOptionBlock(
  document: TemplateDocument,
  blockId: string,
): TemplateOptionBlockNode | null {
  for (const paragraph of document.content) {
    for (const node of paragraph.content ?? []) {
      if (node.type === "optionBlock" && node.attrs.blockId === blockId) {
        return node;
      }
    }
  }
  return null;
}

/**
 * Resuelve la salida horaria desde attrs estructurados y valores crudos.
 * Nunca analiza el texto renderizado de la variante.
 */
export function resolveOptionBlockTime(
  document: TemplateDocument,
  blockId: string,
  optionSelections: Record<string, string>,
  fieldValues: Record<string, unknown>,
): OptionBlockTimeResult {
  const block = findOptionBlock(document, blockId);
  if (!block) return { ok: false, reason: "block_not_found" };
  const output = block.attrs.structuredOutput;
  if (!output || output.type !== "time") {
    return {
      ok: false,
      reason: "invalid_configuration",
      blockName: block.attrs.name,
    };
  }

  const selectedId = optionSelections[blockId] ?? block.attrs.defaultVariantId;
  const variant =
    block.attrs.variants.find((candidate) => candidate.id === selectedId) ??
    block.attrs.variants.find(
      (candidate) => candidate.id === block.attrs.defaultVariantId,
    ) ??
    block.attrs.variants[0];
  const config = output.variants.find(
    (candidate) => candidate.variantId === variant?.id,
  );
  if (!variant || !config) {
    return {
      ok: false,
      reason: "invalid_configuration",
      blockName: block.attrs.name,
      variantLabel: variant?.label,
    };
  }

  const rawHour = fieldValues[config.hourFieldKey];
  const rawMinute =
    config.minuteFieldKey === null ? "00" : fieldValues[config.minuteFieldKey];
  const rawValue = [rawHour, rawMinute]
    .filter((value): value is string => typeof value === "string")
    .join(" / ");
  if (typeof rawHour !== "string" || typeof rawMinute !== "string") {
    return {
      ok: false,
      reason: "missing",
      rawValue,
      blockName: block.attrs.name,
      variantLabel: variant.label,
    };
  }

  const hour = normalizeNotarialValue({
    value: rawHour,
    type: "integer",
    locale: "es-CR",
  });
  const minute = normalizeNotarialValue({
    value: rawMinute,
    type: "integer",
    locale: "es-CR",
  });
  if (
    !hour.ok ||
    !minute.ok ||
    hour.value > 23 ||
    minute.value > 59
  ) {
    return {
      ok: false,
      reason: "invalid",
      rawValue,
      blockName: block.attrs.name,
      variantLabel: variant.label,
    };
  }

  return {
    ok: true,
    value: `${String(hour.value).padStart(2, "0")}:${String(minute.value).padStart(2, "0")}`,
    rawValue,
    blockName: block.attrs.name,
    variantLabel: variant.label,
  };
}
