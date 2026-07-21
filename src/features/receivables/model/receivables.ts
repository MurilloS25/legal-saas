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

const MAX_CLIENT_NAME = 200;

export const CLIENT_MODES = ["registered", "free"] as const;
export type ClientMode = (typeof CLIENT_MODES)[number];

export const ReceivableSchema = z
  .object({
    client_mode: z.enum(CLIENT_MODES, { error: "Selecciona el tipo de cliente" }),
    client_id: OptionalUuid,
    // Nombre libre digitado por el usuario. Para "Cliente registrado" este
    // valor no se usa: el servidor siempre deriva el snapshot del nombre
    // vigente del Cliente (nunca se confía en texto enviado por el navegador
    // para una cuenta con client_id).
    client_name: z
      .string()
      .trim()
      .max(MAX_CLIENT_NAME, "El nombre es demasiado largo"),
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
  )
  .refine((data) => data.client_mode !== "registered" || data.client_id !== null, {
    message: "Selecciona un cliente",
    path: ["client_id"],
  })
  .refine(
    (data) => data.client_mode !== "free" || data.client_name.trim() !== "",
    {
      message: "El nombre del cliente es requerido",
      path: ["client_name"],
    },
  );

export type ReceivableInput = z.infer<typeof ReceivableSchema>;

export function parseReceivableFormData(formData: FormData) {
  return ReceivableSchema.safeParse({
    client_mode: String(formData.get("client_mode") ?? ""),
    client_id: String(formData.get("client_id") ?? ""),
    client_name: String(formData.get("client_name") ?? ""),
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
