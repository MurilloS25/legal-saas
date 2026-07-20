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
export const MARITAL_STATUS_OPTIONS = [
  { value: "soltero", label: "Soltero/a" },
  { value: "casado", label: "Casado/a" },
  { value: "divorciado", label: "Divorciado/a" },
  { value: "viudo", label: "Viudo/a" },
  { value: "union_libre", label: "Unión libre" },
] as const;

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
  marital_status: z.string().trim().min(1, "El estado civil es requerido"),
  nationality: z.string().trim().min(1, "La nacionalidad es requerida"),
  occupation: z.string().trim().min(1, "La ocupación es requerida"),
  exact_address: z.string().trim().min(1, "La dirección exacta es requerida"),
});

export type ClientInput = z.infer<typeof ClientSchema>;
