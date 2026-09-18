import { z } from "zod";

export const IDENTIFICATION_TYPES = ["cedula_fisica"] as const;
export type IdentificationType = (typeof IDENTIFICATION_TYPES)[number];

/**
 * Normaliza un número de identificación: elimina guiones y espacios. Único
 * tipo soportado hoy es `cedula_fisica` (siempre numérica), así que no se
 * fuerza mayúsculas ni se restringe a un largo fijo — eso requeriría una
 * regla de negocio real para DIMEX, pasaporte o persona jurídica, que este
 * sistema todavía no modela.
 */
export function normalizeClientIdentification(raw: string): string {
  return raw.replace(/[-\s]/g, "");
}

// Única fuente de las opciones de estado civil — la reutilizan tanto el
// formulario completo (`ClientForm`) como el diálogo de creación contextual
// (`CreateClientDialog`), para no duplicar la lista.
//
// El valor almacenado es exactamente el texto visible (p. ej. "Casada dos
// veces"), porque se reutiliza tal cual en documentos notariales: no se
// deriva género ni número de veces después. `Casado`/`Divorciado` son el
// caso normal (primera vez).
export const MARITAL_STATUS_VALUES = [
  "Soltero",
  "Soltera",
  "Casado",
  "Casada",
  "Casado dos veces",
  "Casada dos veces",
  "Casado tres veces",
  "Casada tres veces",
  "Divorciado",
  "Divorciada",
  "Divorciado dos veces",
  "Divorciada dos veces",
  "Divorciado tres veces",
  "Divorciada tres veces",
  "Viudo",
  "Viuda",
  "Libre",
] as const;

export type MaritalStatus = (typeof MARITAL_STATUS_VALUES)[number];

export const MARITAL_STATUS_OPTIONS = MARITAL_STATUS_VALUES.map((value) => ({
  value,
  label: value,
}));

/**
 * Valor inicial del selector al editar. Los Clientes anteriores guardaron
 * slugs ("soltero", "casado"…) o formas combinadas ("Casado/a"); no se
 * reescriben en la base de datos. Solo un valor que coincide exactamente
 * (sin distinguir mayúsculas) con una opción actual se preselecciona; el
 * resto queda sin seleccionar para que la persona elija la forma explícita
 * al guardar.
 */
export function resolveMaritalStatusSelection(stored: string | null | undefined): string {
  if (!stored) return "";
  const match = MARITAL_STATUS_VALUES.find(
    (v) => v.toLowerCase() === stored.trim().toLowerCase(),
  );
  return match ?? "";
}

export const ClientSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre completo es requerido"),
  identification_type: z.enum(IDENTIFICATION_TYPES, {
    error: "El tipo de identificación no es válido",
  }),
  identification_number: z
    .string()
    .trim()
    .transform(normalizeClientIdentification)
    .pipe(z.string().min(1, "El número de identificación es requerido")),
  marital_status: z
    .string()
    .trim()
    .min(1, "El estado civil es requerido")
    .pipe(
      z.enum(MARITAL_STATUS_VALUES, {
        error: "El estado civil no es válido",
      }),
    ),
  nationality: z.string().trim().min(1, "La nacionalidad es requerida"),
  occupation: z.string().trim().min(1, "La ocupación es requerida"),
  exact_address: z.string().trim().min(1, "La dirección exacta es requerida"),
});

export type ClientInput = z.infer<typeof ClientSchema>;
