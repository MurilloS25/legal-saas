import { z } from "zod";
import { RECEIVABLE_CURRENCIES } from "./status";

/**
 * Validación de una cuenta por cobrar. El monto se conserva como string
 * decimal exacto (nunca float): se normaliza la coma a punto y se exige
 * hasta dos decimales y valor positivo. Las fechas son `YYYY-MM-DD`.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_CONCEPT = 200;
const MAX_NOTES = 2000;
const MAX_AMOUNT = 9_999_999_999.99;

const AmountSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(",", "."))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
    message: "El monto debe ser un número con hasta dos decimales",
  })
  .refine((value) => Number(value) > 0, {
    message: "El monto debe ser mayor que cero",
  })
  .refine((value) => Number(value) <= MAX_AMOUNT, {
    message: "El monto es demasiado grande",
  });

const OptionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || UUID_PATTERN.test(value), {
    message: "El identificador no es válido",
  });

const DateSchema = z
  .string()
  .trim()
  .refine((value) => DATE_RE.test(value), {
    message: "La fecha no es válida",
  });

const OptionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || DATE_RE.test(value), {
    message: "La fecha no es válida",
  });

export const ReceivableSchema = z
  .object({
    client_id: z
      .string()
      .trim()
      .regex(UUID_PATTERN, "Selecciona un cliente"),
    document_id: OptionalUuid,
    concept: z
      .string()
      .trim()
      .min(1, "El concepto es requerido")
      .max(MAX_CONCEPT, "El concepto es demasiado largo"),
    currency: z.enum(RECEIVABLE_CURRENCIES, { error: "La moneda no es válida" }),
    amount_total: AmountSchema,
    issued_at: DateSchema,
    due_at: OptionalDate,
    notes: z
      .string()
      .trim()
      .max(MAX_NOTES, "Las notas son demasiado largas")
      .transform((value) => (value === "" ? null : value))
      .nullable(),
  })
  .refine(
    (data) => data.due_at === null || data.due_at >= data.issued_at,
    {
      message: "El vencimiento no puede ser anterior a la emisión",
      path: ["due_at"],
    },
  );

export type ReceivableInput = z.infer<typeof ReceivableSchema>;

export function parseReceivableFormData(formData: FormData) {
  return ReceivableSchema.safeParse({
    client_id: String(formData.get("client_id") ?? ""),
    document_id: String(formData.get("document_id") ?? ""),
    concept: String(formData.get("concept") ?? ""),
    currency: String(formData.get("currency") ?? ""),
    amount_total: String(formData.get("amount_total") ?? ""),
    issued_at: String(formData.get("issued_at") ?? ""),
    due_at: String(formData.get("due_at") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
}

export const ReceivableIdSchema = z
  .string()
  .regex(UUID_PATTERN, "El identificador no es válido");
