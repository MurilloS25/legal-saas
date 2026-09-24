import { z } from "zod";

export const IDENTIFICATION_TYPES = ["cedula_fisica", "cedula_juridica"] as const;
export type IdentificationType = (typeof IDENTIFICATION_TYPES)[number];

export const IDENTIFICATION_TYPE_LABELS: Record<IdentificationType, string> = {
  cedula_fisica: "Cédula física",
  cedula_juridica: "Cédula jurídica",
};

/** true si el tipo representa una persona jurídica (sociedad). */
export function isLegalEntityType(type: string | null | undefined): boolean {
  return type === "cedula_juridica";
}

/**
 * Normaliza una cédula física: elimina guiones y espacios (siempre
 * numérica). Solo aplica a `cedula_fisica`; la cédula jurídica tiene su
 * propia regla (`normalizeLegalEntityIdentification`) porque sus guiones
 * son parte del formato con el que se escribe en la Escritura.
 */
export function normalizeClientIdentification(raw: string): string {
  return raw.replace(/[-\s]/g, "");
}

/**
 * Normalización segura de una cédula jurídica: solo recorta los extremos y
 * quita espacios alrededor de un guion ("3 - 101 - 123456" ->
 * "3-101-123456"). Nunca elimina los guiones ni reagrupa dígitos: el valor
 * se guarda tal como el usuario lo escribió.
 */
export function normalizeLegalEntityIdentification(raw: string): string {
  return raw.trim().replace(/\s*-\s*/g, "-");
}

/**
 * Validación conservadora de cédula jurídica: grupos de dígitos separados
 * por un guion simple ("3-101-123456"), o solo dígitos ("3101123456") para
 * registros escritos sin guiones. No se impone un largo ni una estructura
 * de grupos específica (el proyecto no tiene una regla oficial
 * referenciada); solo se rechazan caracteres ajenos, guiones al inicio o al
 * final, guiones dobles y valores excesivamente largos.
 */
export const LEGAL_ENTITY_IDENTIFICATION_PATTERN = /^[0-9]+(-[0-9]+)*$/;
export const LEGAL_ENTITY_IDENTIFICATION_MAX_LENGTH = 30;

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

const sharedClientFields = {
  full_name: z.string().trim().min(1, "El nombre completo es requerido"),
  exact_address: z.string().trim().min(1, "La dirección exacta es requerida"),
};

const NaturalPersonClientSchema = z.object({
  ...sharedClientFields,
  identification_type: z.literal("cedula_fisica"),
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
});

// Estado civil, nacionalidad y ocupación no aplican a una sociedad: se
// guardan siempre como NULL (el CHECK de la base lo exige) y cualquier
// valor enviado se descarta — nunca se "inventa" un dato personal para una
// persona jurídica ni se copia luego a una Escritura.
const notApplicableToLegalEntity = z
  .unknown()
  .optional()
  .transform((): null => null);

const LegalEntityClientSchema = z.object({
  ...sharedClientFields,
  identification_type: z.literal("cedula_juridica"),
  identification_number: z
    .string()
    .transform(normalizeLegalEntityIdentification)
    .pipe(
      z
        .string()
        .min(1, "La cédula jurídica es requerida")
        .max(
          LEGAL_ENTITY_IDENTIFICATION_MAX_LENGTH,
          "La cédula jurídica es demasiado larga",
        )
        .regex(
          LEGAL_ENTITY_IDENTIFICATION_PATTERN,
          "La cédula jurídica solo admite números separados por guiones (p. ej. 3-101-123456)",
        ),
    ),
  marital_status: notApplicableToLegalEntity,
  nationality: notApplicableToLegalEntity,
  occupation: notApplicableToLegalEntity,
});

export const ClientSchema = z.discriminatedUnion(
  "identification_type",
  [NaturalPersonClientSchema, LegalEntityClientSchema],
  { error: "El tipo de identificación no es válido" },
);

export type ClientInput = z.infer<typeof ClientSchema>;
