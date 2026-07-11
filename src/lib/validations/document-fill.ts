/**
 * Validación del llenado de un machote.
 *
 * Decisión de seguridad: las keys que no están definidas como campos del
 * machote se DESCARTAN silenciosamente (no se rechazan). Así el resultado
 * validado solo contiene keys conocidas y nada externo puede inyectar
 * valores para variables no definidas.
 */

export type FillableField = {
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
};

export type DocumentFillResult =
  | { success: true; values: Record<string, string> }
  | { success: false; errors: Record<string, string> };

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function typeError(field: FillableField, value: string): string | null {
  if (value === "") return null;

  if (field.field_type === "number" && !Number.isFinite(Number(value))) {
    return `${field.label} debe ser un número válido`;
  }
  if (field.field_type === "date" && !isValidIsoDate(value)) {
    return `${field.label} debe ser una fecha válida`;
  }
  return null;
}

export function validateDocumentFill(
  fields: FillableField[],
  rawValues: Record<string, string>,
): DocumentFillResult {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = (rawValues[field.field_key] ?? "").trim();

    if (field.required && value === "") {
      errors[field.field_key] = `${field.label} es requerido`;
      continue;
    }

    const invalidType = typeError(field, value);
    if (invalidType) {
      errors[field.field_key] = invalidType;
      continue;
    }

    values[field.field_key] = value;
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, values };
}
