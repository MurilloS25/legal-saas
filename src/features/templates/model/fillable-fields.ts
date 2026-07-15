/**
 * Derivación de los campos llenables de un machote.
 *
 * Corrección del fallo de creación de escrituras: un machote cuyo contenido
 * usa variables `{{key}}` pero que no tiene campos configurados bloqueaba la
 * creación por completo. Los campos llenables ahora son la unión de:
 *
 * 1. los campos configurados del machote (conservan etiqueta, obligatoriedad
 *    y orden), y
 * 2. las variables detectadas en el contenido que no tienen campo
 *    configurado, como campos opcionales cuya etiqueta es la propia clave.
 *
 * Así una escritura siempre puede crearse y las variables sin configurar
 * siguen siendo llenables; configurarlas solo mejora etiqueta y validación.
 */

import { extractTemplateVariables } from "./variables";

export type ConfiguredTemplateField = {
  field_key: string;
  label: string;
  required: boolean;
  /** Legado: solo se usa para elegir el control de UI. */
  field_type?: string;
};

export type FillableTemplateField = {
  field_key: string;
  label: string;
  required: boolean;
  field_type: string;
  /** true si la variable viene del contenido sin campo configurado. */
  derived: boolean;
};

export function buildFillableFields(
  configuredFields: ConfiguredTemplateField[],
  content: string,
): FillableTemplateField[] {
  const configured = configuredFields.map((field) => ({
    field_key: field.field_key,
    label: field.label,
    required: field.required,
    field_type: field.field_type ?? "text",
    derived: false,
  }));

  const configuredKeys = new Set(configured.map((field) => field.field_key));

  const derived = extractTemplateVariables(content)
    .filter((key) => !configuredKeys.has(key))
    .map((key) => ({
      field_key: key,
      label: key,
      required: false,
      field_type: "text",
      derived: true,
    }));

  return [...configured, ...derived];
}
