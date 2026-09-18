import {
  DocumentOptionSelectionsSchema,
  DocumentRenderedContentSchema,
  DocumentTitleSchema,
  DocumentValuesSchema,
  mergeDocumentDraftValues,
} from "../model/document-schema";
import { validateDocumentFill } from "../model/document-fill";
import type { FillableTemplateField } from "@/features/templates/domain";
import type { VariableOutputTransform } from "@/features/templates/domain";
import { renderStructuredTemplate } from "@/lib/editor/render";
import type { TemplateDocument } from "@/lib/editor/types";
import { extractActiveDocumentVariables } from "@/lib/editor/variables";
import type { DocumentDraftState } from "../model/action-state";

function buildTransformsMap(
  fields: FillableTemplateField[],
): Record<string, VariableOutputTransform> {
  const transforms: Record<string, VariableOutputTransform> = {};
  for (const field of fields) {
    if (field.output_transform !== "none") {
      transforms[field.field_key] = field.output_transform;
    }
  }
  return transforms;
}

export function validateDraftInput(
  formData: FormData,
  fields: FillableTemplateField[],
  document: TemplateDocument,
  existingValues?: Record<string, string>,
): { state: DocumentDraftState } | {
  title: string;
  values: Record<string, string>;
  optionSelections: Record<string, string>;
  rendered: string;
} {
  const titleResult = DocumentTitleSchema.safeParse(
    String(formData.get("title") ?? ""),
  );

  const rawValues: Record<string, string> = {};
  for (const field of fields) {
    rawValues[field.field_key] = String(formData.get(field.field_key) ?? "");
  }

  let optionSelectionsRaw: unknown = {};
  try {
    const raw = String(formData.get("option_selections") ?? "{}");
    optionSelectionsRaw = raw ? JSON.parse(raw) : {};
  } catch {
    optionSelectionsRaw = {};
  }
  const optionSelectionsResult =
    DocumentOptionSelectionsSchema.safeParse(optionSelectionsRaw);
  const activeKeys = new Set(
    extractActiveDocumentVariables(
      document,
      optionSelectionsResult.success ? optionSelectionsResult.data : {},
    ),
  );
  const fillResult = validateDocumentFill(
    fields.map((field) =>
      field.required && !activeKeys.has(field.field_key)
        ? { ...field, required: false }
        : field,
    ),
    rawValues,
  );

  if (!titleResult.success || !fillResult.success) {
    return {
      state: {
        titleError: titleResult.success
          ? undefined
          : titleResult.error.issues[0]?.message,
        errors: fillResult.success ? undefined : fillResult.errors,
      },
    };
  }

  const valuesToPersist = existingValues
    ? mergeDocumentDraftValues(
        existingValues,
        fillResult.values,
        fields.map((field) => field.field_key),
      )
    : fillResult.values;

  const valuesResult = DocumentValuesSchema.safeParse(valuesToPersist);
  if (!valuesResult.success) {
    return {
      state: {
        message:
          valuesResult.error.issues[0]?.message ?? "Los valores no son válidos.",
      },
    };
  }

  if (!optionSelectionsResult.success) {
    return {
      state: {
        message:
          optionSelectionsResult.error.issues[0]?.message ??
          "Las selecciones de bloques no son válidas.",
      },
    };
  }

  const rendered = renderStructuredTemplate(
    document,
    valuesResult.data,
    buildTransformsMap(fields),
    optionSelectionsResult.data,
  );
  const renderedResult = DocumentRenderedContentSchema.safeParse(rendered);
  if (!renderedResult.success) {
    return {
      state: {
        message:
          renderedResult.error.issues[0]?.message ??
          "El contenido del documento es demasiado largo.",
      },
    };
  }

  return {
    title: titleResult.data,
    values: valuesResult.data,
    optionSelections: optionSelectionsResult.data,
    rendered: renderedResult.data,
  };
}
