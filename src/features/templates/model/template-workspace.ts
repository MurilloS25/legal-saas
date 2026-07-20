/**
 * Validación del guardado del workspace de machotes.
 *
 * El workspace envía la información básica, el documento estructurado y la
 * configuración de variables en un solo submit. El documento y las
 * variables llegan como JSON serializado dentro del FormData, así que aquí
 * se aplican límites de tamaño ANTES de parsear y validación estricta
 * después — nunca se confía en el JSON del navegador.
 */

import { z } from "zod";
import { FIELD_KEY_PATTERN } from "./template-fields";
import { TEMPLATE_STATUS } from "./templates";
import { validateTemplateDocument } from "@/lib/editor/validate";
import { TEMPLATE_DOC_LIMITS, type TemplateDocument } from "@/lib/editor/types";
import {
  VARIABLE_AUTOFILL_SOURCES,
  VARIABLE_OUTPUT_TRANSFORMS,
} from "./variable-autofill";

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 500;
/** Tope del string JSON del documento antes de JSON.parse. */
const MAX_DOCUMENT_JSON_LENGTH = 1_000_000;
/** Tope del string JSON de las variables antes de JSON.parse. */
const MAX_VARIABLES_JSON_LENGTH = 200_000;

export const TemplateWorkspaceInfoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre del machote es requerido")
    .max(MAX_NAME_LENGTH, "El nombre es demasiado largo"),
  description: z
    .string()
    .trim()
    .max(MAX_DESCRIPTION_LENGTH, "La descripción es demasiado larga")
    .optional(),
  status: z.enum(TEMPLATE_STATUS, { error: "El estado no es válido" }),
});

export const TemplateWorkspaceVariableSchema = z.object({
  field_key: z
    .string()
    .trim()
    .min(1, "La variable es requerida")
    .max(
      TEMPLATE_DOC_LIMITS.maxVariableKeyLength,
      "La clave de la variable es demasiado larga",
    )
    .regex(
      FIELD_KEY_PATTERN,
      "Usa minúsculas, números, guion bajo y puntos simples. Ej: comprador.nombre",
    ),
  label: z
    .string()
    .trim()
    .min(1, "La etiqueta de la variable es requerida")
    .max(
      TEMPLATE_DOC_LIMITS.maxVariableLabelLength,
      "La etiqueta es demasiado larga",
    ),
  required: z.boolean({ error: "Indica si la variable es obligatoria" }),
  autofill_source: z.enum(VARIABLE_AUTOFILL_SOURCES).default("none"),
  output_transform: z.enum(VARIABLE_OUTPUT_TRANSFORMS).default("none"),
});

export type TemplateWorkspaceVariable = z.infer<
  typeof TemplateWorkspaceVariableSchema
>;

export type TemplateWorkspacePayload = {
  name: string;
  description?: string;
  status: (typeof TEMPLATE_STATUS)[number];
  document: TemplateDocument;
  variables: TemplateWorkspaceVariable[];
};

export type TemplateWorkspaceParseResult =
  | { success: true; payload: TemplateWorkspacePayload }
  | {
      success: false;
      errors: {
        name?: string;
        description?: string;
        status?: string;
        document?: string;
        variables?: string;
      };
    };

function parseJsonField(raw: string, maxLength: number): unknown {
  if (raw.length > maxLength) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export function parseTemplateWorkspacePayload(
  formData: FormData,
): TemplateWorkspaceParseResult {
  const infoResult = TemplateWorkspaceInfoSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    status: String(formData.get("status") ?? ""),
  });

  const errors: Extract<
    TemplateWorkspaceParseResult,
    { success: false }
  >["errors"] = {};

  if (!infoResult.success) {
    const fieldErrors = infoResult.error.flatten().fieldErrors;
    errors.name = fieldErrors.name?.[0];
    errors.description = fieldErrors.description?.[0];
    errors.status = fieldErrors.status?.[0];
  }

  // ---- documento estructurado
  const documentJson = parseJsonField(
    String(formData.get("document") ?? ""),
    MAX_DOCUMENT_JSON_LENGTH,
  );
  let document: TemplateDocument | undefined;
  if (documentJson === undefined) {
    errors.document = "El contenido del machote no es válido.";
  } else {
    const validation = validateTemplateDocument(documentJson);
    if (validation.ok) {
      document = validation.document;
    } else {
      errors.document = validation.error;
    }
  }

  // ---- variables configuradas
  const variablesJson = parseJsonField(
    String(formData.get("variables") ?? ""),
    MAX_VARIABLES_JSON_LENGTH,
  );
  let variables: TemplateWorkspaceVariable[] | undefined;
  if (!Array.isArray(variablesJson)) {
    errors.variables = "La configuración de variables no es válida.";
  } else if (variablesJson.length > TEMPLATE_DOC_LIMITS.maxDistinctVariables) {
    errors.variables = "El machote tiene demasiadas variables.";
  } else {
    const parsed: TemplateWorkspaceVariable[] = [];
    const seenKeys = new Set<string>();
    for (const entry of variablesJson) {
      const result = TemplateWorkspaceVariableSchema.safeParse(entry);
      if (!result.success) {
        errors.variables =
          result.error.issues[0]?.message ??
          "La configuración de variables no es válida.";
        break;
      }
      if (seenKeys.has(result.data.field_key)) {
        errors.variables = "Hay variables duplicadas en la configuración.";
        break;
      }
      seenKeys.add(result.data.field_key);
      parsed.push(result.data);
    }
    if (!errors.variables) variables = parsed;
  }

  if (
    !infoResult.success ||
    document === undefined ||
    variables === undefined
  ) {
    return { success: false, errors };
  }

  return {
    success: true,
    payload: {
      name: infoResult.data.name,
      description: infoResult.data.description,
      status: infoResult.data.status,
      document,
      variables,
    },
  };
}
