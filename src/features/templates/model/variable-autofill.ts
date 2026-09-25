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
import type { VariableOutputTransform } from "@/lib/editor/text-transforms";

// Ejemplo corto para que "Dígitos en palabras" y "Número completo en
// palabras" no se confundan entre sí — mismo valor de entrada (125), salida
// real de `applyVariableTransform` (ver src/lib/editor/text-transforms.ts),
// no un ejemplo inventado. Vive aquí (no en cada formulario) para que
// cualquier punto donde se elija una transformación —Insertar variable,
// Bloques de opciones, panel de Variables— muestre el mismo ejemplo.
export const VARIABLE_OUTPUT_TRANSFORM_EXAMPLES: Partial<
  Record<VariableOutputTransform, string>
> = {
  digits_to_words: "Ejemplo: 125 → UNO DOS CINCO",
  number_to_words: "Ejemplo: 125 → CIENTO VEINTICINCO",
};

export const VARIABLE_AUTOFILL_SOURCES = [
  "none",
  "client_full_name",
  "client_identification",
  "client_address",
  "client_marital_status",
  "client_occupation",
  "client_nationality",
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
  client_marital_status: "Estado civil del Cliente",
  client_occupation: "Ocupación / profesión del Cliente",
  client_nationality: "Nacionalidad del Cliente",
};

/**
 * Orígenes que solo existen para una persona física. Una persona jurídica
 * (sociedad) no tiene estado civil, ocupación ni nacionalidad personal: el
 * autollenado nunca los inventa para ella.
 */
export const NATURAL_PERSON_ONLY_AUTOFILL_SOURCES: ReadonlySet<VariableAutofillSource> =
  new Set(["client_marital_status", "client_occupation", "client_nationality"]);

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

// ------------------------------------------------------------------ detección automática
//
// Única fuente de verdad para reconocer el "dato" de una clave `rol.dato`
// (p. ej. `vendedor.nombre_completo`) sin exigir configuración manual en el
// Machote. La usan tanto la sugerencia editable del panel de Variables como
// la detección automática de "Completar desde Clientes" en la Escritura — no
// hay una segunda tabla de alias en ningún otro lugar.

/** Quita diacríticos (tildes, diéresis) preservando el resto del texto. */
export function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normaliza el segundo segmento (`dato`) de una clave `rol.dato` para
 * compararlo contra los alias conocidos: minúsculas, sin tildes, camelCase
 * dividido en palabras, espacios/guiones convertidos a guion bajo.
 *
 * Ejemplos equivalentes: "nombre_completo", "nombre-completo",
 * "nombreCompleto", "Nombre Completo" -> "nombre_completo".
 */
export function normalizeVariableDataKey(raw: string): string {
  const withoutAccents = stripDiacritics(raw);
  const snakeCased = withoutAccents.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  return snakeCased
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const CLIENT_FULL_NAME_ALIASES = new Set([
  "nombre",
  "nombre_completo",
  "full_name",
  "razon_social",
]);
const CLIENT_IDENTIFICATION_ALIASES = new Set([
  "cedula",
  "identificacion",
  "numero_identificacion",
  "cedula_juridica",
]);
const CLIENT_ADDRESS_ALIASES = new Set([
  "direccion",
  "domicilio",
  "direccion_exacta",
]);
const CLIENT_MARITAL_STATUS_ALIASES = new Set(["estado_civil"]);
const CLIENT_OCCUPATION_ALIASES = new Set([
  "ocupacion",
  "profesion",
  "oficio",
  "profesion_u_oficio",
]);
const CLIENT_NATIONALITY_ALIASES = new Set(["nacionalidad"]);
// "correo"/"email"/"telefono" no se mapean intencionalmente: `clients` no
// tiene columnas email/phone hoy. No inventar ni simular esas fuentes.

/**
 * Infiere el origen de autollenado a partir del "dato" (segundo segmento de
 * `rol.dato`), usando únicamente el conjunto cerrado de alias conocidos —
 * nunca matching difuso ni similitud semántica. Un alias no reconocido
 * ("dato", "valor", "campo1", etc.) siempre resuelve a `none`.
 */
export function inferAutofillSource(dato: string): VariableAutofillSource {
  const normalized = normalizeVariableDataKey(dato);
  if (CLIENT_FULL_NAME_ALIASES.has(normalized)) return "client_full_name";
  if (CLIENT_IDENTIFICATION_ALIASES.has(normalized)) {
    return "client_identification";
  }
  if (CLIENT_ADDRESS_ALIASES.has(normalized)) return "client_address";
  if (CLIENT_MARITAL_STATUS_ALIASES.has(normalized)) {
    return "client_marital_status";
  }
  if (CLIENT_OCCUPATION_ALIASES.has(normalized)) return "client_occupation";
  if (CLIENT_NATIONALITY_ALIASES.has(normalized)) return "client_nationality";
  return "none";
}

/**
 * Orden de resolución del origen de autollenado efectivo de una variable:
 * 1) configuración explícita guardada en el Machote, si no es `none`;
 * 2) detección automática por alias a partir del "dato" de `rol.dato`;
 * 3) `none` si no hay punto o el alias no se reconoce.
 *
 * La configuración manual del Machote actúa como override para casos
 * especiales; nunca se sobrescribe con la inferencia automática.
 */
export function resolveAutofillSource(
  fieldKey: string,
  explicit: VariableAutofillSource,
): VariableAutofillSource {
  if (explicit !== "none") return explicit;
  const dato = fieldKey.split(".")[1];
  if (!dato) return "none";
  return inferAutofillSource(dato);
}

/**
 * Sugerencia de origen de autollenado a partir del segundo segmento
 * (`dato`) de una clave `rol.dato`, para prellenar el select del panel de
 * Variables del Machote. Es solo una sugerencia editable: nunca se aplica
 * de forma implícita ni sobrescribe una configuración existente.
 */
export function suggestAutofillSource(
  fieldKey: string,
): VariableAutofillSource {
  const dato = fieldKey.split(".")[1];
  if (!dato) return "none";
  return inferAutofillSource(dato);
}
