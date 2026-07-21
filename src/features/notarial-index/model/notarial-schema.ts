import { z } from "zod";
import { costaRicaLocalToIso } from "./datetime";

/**
 * Validación de la metadata del índice notarial. Todos los campos son
 * opcionales (la completitud se deriva); se acotan longitudes y se normaliza
 * la cadena vacía a null. `authorized_at` llega como datetime-local (hora de
 * Costa Rica) y se convierte a ISO UTC.
 *
 * El acto es texto libre: no hay catálogo legal inventado.
 */

const MAX_SHORT = 120;
const MAX_ACT_TYPE = 200;
const MAX_LONG = 2000;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "El valor es demasiado largo")
    .transform((value) => (value === "" ? null : value))
    .nullable();

export const NotarialMetadataSchema = z.object({
  instrument_number: z.preprocess(
    (value) => (value === "" || value === null ? null : Number(value)),
    z
      .number()
      .int("Debe ser un número entero")
      .positive("Debe ser mayor que cero")
      .nullable(),
  ),
  protocol_book: optionalText(MAX_SHORT),
  initial_folio: optionalText(MAX_SHORT),
  final_folio: optionalText(MAX_SHORT),
  act_name_override: optionalText(MAX_ACT_TYPE),
  parties_override: optionalText(MAX_LONG),
  notes: optionalText(MAX_LONG),
  version: z.coerce.number().int().positive(),
  authorized_at: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const iso = costaRicaLocalToIso(value);
      if (iso === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La fecha de autorización no es válida",
        });
        return z.NEVER;
      }
      return iso;
    })
    .nullable(),
});

export type NotarialMetadataInput = z.infer<typeof NotarialMetadataSchema>;

export function parseNotarialFormData(formData: FormData) {
  return NotarialMetadataSchema.safeParse({
    instrument_number: String(formData.get("instrument_number") ?? ""),
    protocol_book: String(formData.get("protocol_book") ?? ""),
    initial_folio: String(formData.get("initial_folio") ?? ""),
    final_folio: String(formData.get("final_folio") ?? ""),
    act_name_override: String(formData.get("act_name_override") ?? ""),
    parties_override: String(formData.get("parties_override") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    version: String(formData.get("version") ?? "1"),
    authorized_at: String(formData.get("authorized_at") ?? ""),
  });
}
