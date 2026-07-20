/**
 * Configuración de autollenado por variable: de qué campo del Cliente se
 * copia el valor al completar un rol (`rol.dato`) en una Escritura.
 *
 * `client_email`/`client_phone` no forman parte de este conjunto porque
 * `clients` no tiene esas columnas hoy — ver el reporte final de la
 * iteración para el pendiente documentado.
 *
 * Reexporta `VariableOutputTransform` desde `text-transforms.ts` (único
 * origen de verdad) para que la configuración del Machote y el render
 * compartan el mismo tipo.
 */

export {
  VARIABLE_OUTPUT_TRANSFORMS,
  VARIABLE_OUTPUT_TRANSFORM_LABELS,
  toVariableOutputTransform,
  type VariableOutputTransform,
} from "@/lib/editor/text-transforms";

export const VARIABLE_AUTOFILL_SOURCES = [
  "none",
  "client_full_name",
  "client_identification",
  "client_address",
] as const;

export type VariableAutofillSource = (typeof VARIABLE_AUTOFILL_SOURCES)[number];

export const VARIABLE_AUTOFILL_SOURCE_LABELS: Record<
  VariableAutofillSource,
  string
> = {
  none: "Sin autollenado",
  client_full_name: "Nombre completo del Cliente",
  client_identification: "Identificación del Cliente",
  client_address: "Dirección del Cliente",
};

/**
 * Normaliza un valor de origen de autollenado leído de la base de datos
 * (columna `text`, no tipada por Postgres) al tipo estricto. Un valor
 * desconocido —de una versión futura de la app, por ejemplo— cae a `none`
 * en vez de romper el render.
 */
export function toVariableAutofillSource(raw: string): VariableAutofillSource {
  return (VARIABLE_AUTOFILL_SOURCES as readonly string[]).includes(raw)
    ? (raw as VariableAutofillSource)
    : "none";
}

/**
 * Sugerencia de origen de autollenado a partir del segundo segmento
 * (`dato`) de una clave `rol.dato`. Es solo una sugerencia editable: nunca
 * se aplica de forma implícita ni sobrescribe una configuración existente.
 */
export function suggestAutofillSource(
  fieldKey: string,
): VariableAutofillSource {
  const dato = fieldKey.split(".")[1];
  if (!dato) return "none";
  if (dato === "nombre") return "client_full_name";
  if (dato === "cedula" || dato === "identificacion") {
    return "client_identification";
  }
  if (dato === "direccion") return "client_address";
  return "none";
}
