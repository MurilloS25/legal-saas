import { z } from "zod";
import { costaRicaLocalToIso } from "./notarial-datetime";

/**
 * Validación de la metadata del índice notarial. Todos los campos son
 * opcionales (la completitud se deriva); se acotan longitudes y se normaliza
 * la cadena vacía a null. `authorized_at` llega como datetime-local (hora de
 * Costa Rica) y se convierte a ISO UTC.
 *
 * `act_type` es texto libre: no hay catálogo legal inventado.
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
  instrument_number: optionalText(MAX_SHORT),
  act_type: optionalText(MAX_ACT_TYPE),
  book_reference: optionalText(MAX_SHORT),
  folio_reference: optionalText(MAX_SHORT),
  appearing_parties_summary: optionalText(MAX_LONG),
  notes: optionalText(MAX_LONG),
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
    act_type: String(formData.get("act_type") ?? ""),
    book_reference: String(formData.get("book_reference") ?? ""),
    folio_reference: String(formData.get("folio_reference") ?? ""),
    appearing_parties_summary: String(
      formData.get("appearing_parties_summary") ?? "",
    ),
    notes: String(formData.get("notes") ?? ""),
    authorized_at: String(formData.get("authorized_at") ?? ""),
  });
}
