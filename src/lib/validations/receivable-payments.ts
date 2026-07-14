import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/receivables/payments";

/**
 * Validación del registro y la anulación de pagos. El monto se conserva como
 * string decimal exacto (coma normalizada a punto, hasta dos decimales, > 0).
 * La moneda del pago no se pide: la RPC la hereda de la cuenta.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 9_999_999_999.99;
const MAX_REFERENCE = 200;
const MAX_REASON = 500;

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

const OptionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || DATE_RE.test(value), {
    message: "La fecha no es válida",
  });

export const RegisterPaymentSchema = z.object({
  amount: AmountSchema,
  paid_at: OptionalDate,
  method: z.enum(PAYMENT_METHODS, { error: "El método no es válido" }),
  reference: z
    .string()
    .trim()
    .max(MAX_REFERENCE, "La referencia es demasiado larga")
    .transform((value) => (value === "" ? null : value))
    .nullable(),
});

export type RegisterPaymentInput = z.infer<typeof RegisterPaymentSchema>;

export function parseRegisterPaymentFormData(formData: FormData) {
  return RegisterPaymentSchema.safeParse({
    amount: String(formData.get("amount") ?? ""),
    paid_at: String(formData.get("paid_at") ?? ""),
    method: String(formData.get("method") ?? ""),
    reference: String(formData.get("reference") ?? ""),
  });
}

export const VoidPaymentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "El motivo es requerido")
    .max(MAX_REASON, "El motivo es demasiado largo"),
});

export function parseVoidPaymentFormData(formData: FormData) {
  return VoidPaymentSchema.safeParse({
    reason: String(formData.get("reason") ?? ""),
  });
}
