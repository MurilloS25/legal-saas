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
// El valor almacenado es exactamente el texto visible (p. ej.
// "Casado/a dos veces"), porque se reutiliza tal cual en documentos
// notariales. `Casado/a` y `Divorciado/a` son el caso normal (primera vez).
export const MARITAL_STATUS_VALUES = [
  "Soltero/a",
  "Casado/a",
  "Casado/a dos veces",
  "Casado/a tres veces",
  "Divorciado/a",
  "Divorciado/a dos veces",
  "Divorciado/a tres veces",
  "Viudo/a",
  "Libre",
] as const;

export type MaritalStatus = (typeof MARITAL_STATUS_VALUES)[number];

export const MARITAL_STATUS_OPTIONS = MARITAL_STATUS_VALUES.map((value) => ({
  value,
  label: value,
}));

const LEGACY_BASE: Record<string, string> = {
  soltero: "Soltero/a",
  soltera: "Soltero/a",
  casado: "Casado/a",
  casada: "Casado/a",
  divorciado: "Divorciado/a",
  divorciada: "Divorciado/a",
  viudo: "Viudo/a",
  viuda: "Viudo/a",
  libre: "Libre",
  "union libre": "Libre",
};

/**
 * Equivalente canónico de un valor histórico de estado civil, o "" si no hay
 * equivalencia clara. Los Clientes anteriores guardaron slugs ("soltero",
 * "union_libre"), formas de género ("Casada") o el texto actual. Solo se usa
 * para preseleccionar el formulario: no se reescribe nada en la base de datos;
 * el valor canónico se persiste al guardar de nuevo el Cliente.
 */
export function resolveMaritalStatusSelection(
  stored: string | null | undefined,
): string {
  if (!stored) return "";
  const key = stored
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\/a\b/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const times = key.match(/^(.*?)(?: (dos|tres) veces)?$/);
  const base = LEGACY_BASE[times?.[1] ?? ""];
  if (!base || base === "Soltero/a" || base === "Viudo/a" || base === "Libre") {
    return times?.[2] ? "" : (base ?? "");
  }
  return times?.[2] ? `${base} ${times[2]} veces` : base;
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
