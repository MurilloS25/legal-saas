/**
 * Validación del llenado de un machote.
 *
 * Todos los valores se tratan como texto: no hay parsing numérico ni de
 * fechas. En el dominio notarial el valor final siempre se representa
 * textualmente (montos en palabras, fechas jurídicas), así que el texto
 * escrito por el usuario se conserva exactamente, solo con trim.
 * `field_type` se acepta en la definición del campo por compatibilidad con
 * registros antiguos, pero no cambia la validación.
 *
 * Decisión de seguridad: las keys que no están definidas como campos del
 * machote se DESCARTAN silenciosamente (no se rechazan). Así el resultado
 * validado solo contiene keys conocidas y nada externo puede inyectar
 * valores para variables no definidas.
 */

export type FillableField = {
  field_key: string;
  label: string;
  /** Legado: se ignora en la validación; todos los valores son texto. */
  field_type?: string;
  required: boolean;
};

export type DocumentFillResult =
  | { success: true; values: Record<string, string> }
  | { success: false; errors: Record<string, string> };

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

    values[field.field_key] = value;
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, values };
}
