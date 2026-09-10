import { z } from "zod";
import { FIELD_KEY_PATTERN } from "@/lib/editor/variable-key";
import {
  DOCUMENT_STATUSES,
  type DocumentStatus,
} from "./lifecycle";

/**
 * Validaciones de escrituras (documents).
 *
 * `field_values` es un mapa plano field_key -> texto. Los valores siempre
 * son strings: el texto exacto que escribió el usuario, sin parsing. El
 * contenido renderizado se genera del lado servidor a partir del machote y
 * de estos valores — nunca se acepta desde el cliente.
 *
 * Los estados válidos viven en `./lifecycle` (fuente única).
 */

export { DOCUMENT_STATUSES };
export type { DocumentStatus };

export const DocumentVersionSchema = z.iso.datetime({ offset: true });

const MAX_TITLE_LENGTH = 200;
const MAX_KEY_LENGTH = 120;
const MAX_VALUE_LENGTH = 20_000;
const MAX_VALUE_ENTRIES = 200;
const MAX_RENDERED_LENGTH = 200_000;

// Claves que permitirían contaminar prototipos si el objeto se usa sin cuidado.
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export const DocumentTitleSchema = z
  .string()
  .trim()
  .min(1, "El título de la escritura es requerido")
  .max(MAX_TITLE_LENGTH, "El título es demasiado largo");

// La revisión de claves peligrosas debe hacerse sobre el objeto crudo:
// z.record copia las entradas a un objeto nuevo y una clave como __proto__
// se perdería (o contaminaría el prototipo) durante esa copia.
const isSafePlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).every((key) => !DANGEROUS_KEYS.has(key));

export const DocumentValuesSchema = z
  .custom<Record<string, unknown>>(isSafePlainObject, {
    message: "Los valores deben ser un objeto plano sin claves reservadas",
  })
  .pipe(
    z.record(
      z
        .string()
        .max(MAX_KEY_LENGTH, "La clave del campo es demasiado larga")
        .regex(FIELD_KEY_PATTERN, "La clave del campo no es válida"),
      z
        .string({ error: "Cada valor debe ser texto" })
        .max(MAX_VALUE_LENGTH, "El valor es demasiado largo"),
    ),
  )
  .refine((values) => Object.keys(values).length <= MAX_VALUE_ENTRIES, {
    message: "La escritura tiene demasiados campos",
  });

export type DocumentValues = z.infer<typeof DocumentValuesSchema>;

const MAX_OPTION_SELECTION_ENTRIES = 100;
const MAX_OPTION_ID_LENGTH = 120;

/**
 * Selección de variante por Bloque de opciones: mapa `blockId -> variantId`.
 * Mismo patrón de guardas que `field_values`. La forma exacta de los ids
 * (`crypto.randomUUID()`, ver `option-blocks.ts`) no se valida aquí más
 * allá del largo — la validación real de que un `blockId`/`variantId`
 * corresponda a un Bloque/variante que existe hoy en el Machote ocurre al
 * resolver el render (`buildDocumentModel`), no en la persistencia: una
 * selección para un bloque que el Machote ya no tiene simplemente se
 * ignora, no bloquea el guardado.
 */
export const DocumentOptionSelectionsSchema = z
  .custom<Record<string, unknown>>(isSafePlainObject, {
    message: "Las selecciones deben ser un objeto plano sin claves reservadas",
  })
  .pipe(
    z.record(
      z.string().max(MAX_OPTION_ID_LENGTH, "El id del bloque es demasiado largo"),
      z
        .string({ error: "Cada selección debe ser texto" })
        .max(MAX_OPTION_ID_LENGTH, "El id de la variante es demasiado largo"),
    ),
  )
  .refine(
    (selections) => Object.keys(selections).length <= MAX_OPTION_SELECTION_ENTRIES,
    { message: "La escritura tiene demasiadas selecciones de bloques" },
  );

export type DocumentOptionSelections = z.infer<
  typeof DocumentOptionSelectionsSchema
>;

export function mergeDocumentDraftValues(
  existingValues: DocumentValues,
  currentValues: DocumentValues,
  currentFieldKeys: string[],
): DocumentValues {
  const currentFieldKeySet = new Set(currentFieldKeys);
  const mergedValues: DocumentValues = {};

  for (const [key, value] of Object.entries(existingValues)) {
    if (!currentFieldKeySet.has(key)) {
      mergedValues[key] = value;
    }
  }

  return {
    ...mergedValues,
    ...currentValues,
  };
}

export const DocumentRenderedContentSchema = z
  .string()
  .max(MAX_RENDERED_LENGTH, "El contenido del documento es demasiado largo");

// Formato UUID laxo (sin exigir bits de versión RFC): los IDs reales son v4
// generados por Postgres y RLS es la defensa de fondo.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DocumentIdSchema = z
  .string()
  .regex(UUID_PATTERN, "El identificador no es válido");

/**
 * client_id opcional del formulario. La cadena vacía (opción "Sin cliente")
 * se normaliza a null. Cualquier otro valor debe ser un UUID válido.
 */
export const OptionalClientIdSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || UUID_PATTERN.test(value), {
    message: "El cliente seleccionado no es válido",
  });

export const DocumentStatusSchema = z.enum(DOCUMENT_STATUSES, {
  error: "El estado no es válido",
});
