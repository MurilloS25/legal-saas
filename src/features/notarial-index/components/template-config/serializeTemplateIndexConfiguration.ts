import type { SimpleIndexMappingKey } from "../../model/template-index-configuration";
import {
  TEMPLATE_INDEX_SIMPLE_FIELDS,
  type IndexConfigurationField,
} from "./types";

export type TemplateIndexSerializationError =
  | "parties_field_not_saved"
  | "authorized_time_field_not_saved"
  | "simple_field_not_saved";

type Input = {
  freshFields: IndexConfigurationField[];
  selectedIds: string[];
  simpleFieldValues: Record<SimpleIndexMappingKey, string>;
  separator: string;
  fixedSuffix: string;
  allowEmpty: boolean;
};

type Result =
  | {
      success: true;
      resolvedSelectedIds: string[];
      resolvedSimpleFieldValues: Record<SimpleIndexMappingKey, string>;
      formData: FormData;
    }
  | {
      success: false;
      error: TemplateIndexSerializationError;
      message: string;
    };

function resolveFieldId(
  candidateId: string,
  freshFieldsByKey: Map<string, string>,
): string | null {
  if (!candidateId.startsWith("local:")) return candidateId;
  return freshFieldsByKey.get(candidateId.slice("local:".length)) ?? null;
}

export function serializeTemplateIndexConfiguration({
  freshFields,
  selectedIds,
  simpleFieldValues,
  separator,
  fixedSuffix,
  allowEmpty,
}: Input): Result {
  const freshFieldsByKey = new Map(
    freshFields.map((field) => [field.fieldKey, field.id]),
  );
  const resolvedSelectedIds: string[] = [];

  for (const id of selectedIds) {
    const resolved = resolveFieldId(id, freshFieldsByKey);
    if (!resolved) {
      return {
        success: false,
        error: "parties_field_not_saved",
        message:
          "Una de las variables seleccionadas para Partes todavía no " +
          "terminó de guardarse. Vuelve a intentar.",
      };
    }
    resolvedSelectedIds.push(resolved);
  }

  const resolvedSimpleFieldValues: Record<SimpleIndexMappingKey, string> = {
    ...simpleFieldValues,
  };
  for (const { key } of TEMPLATE_INDEX_SIMPLE_FIELDS) {
    const raw = simpleFieldValues[key];
    if (key === "authorized_time") {
      if (raw.startsWith("field:")) {
        const resolved = resolveFieldId(
          raw.slice("field:".length),
          freshFieldsByKey,
        );
        if (!resolved) {
          return {
            success: false,
            error: "authorized_time_field_not_saved",
            message:
              "La variable elegida para Hora de autorización todavía " +
              "no terminó de guardarse. Vuelve a intentar.",
          };
        }
        resolvedSimpleFieldValues[key] = `field:${resolved}`;
      }
      continue;
    }
    if (!raw) continue;
    const resolved = resolveFieldId(raw, freshFieldsByKey);
    if (!resolved) {
      return {
        success: false,
        error: "simple_field_not_saved",
        message:
          "Una de las variables mapeadas todavía no terminó de " +
          "guardarse. Vuelve a intentar.",
      };
    }
    resolvedSimpleFieldValues[key] = resolved;
  }

  const formData = new FormData();
  formData.set("party_separator", separator);
  formData.set("fixed_suffix", fixedSuffix);
  if (allowEmpty) formData.set("allow_empty", "on");
  for (const id of resolvedSelectedIds) {
    formData.append("selected_field", id);
  }
  for (const { key } of TEMPLATE_INDEX_SIMPLE_FIELDS) {
    const name =
      key === "authorized_time"
        ? "authorized_time_source"
        : `${key}_field_id`;
    formData.set(name, resolvedSimpleFieldValues[key]);
  }

  return {
    success: true,
    resolvedSelectedIds,
    resolvedSimpleFieldValues,
    formData,
  };
}
