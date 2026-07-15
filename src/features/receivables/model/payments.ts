/**
 * Métodos de pago admitidos para las cuentas por cobrar. El valor canónico se
 * almacena en inglés; la etiqueta visible está en español.
 */

export const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "sinpe",
  "card",
  "other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  bank_transfer: "Transferencia",
  sinpe: "SINPE",
  card: "Tarjeta",
  other: "Otro",
};

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABEL[method as PaymentMethod] ?? method;
}

export const PAYMENT_STATUSES = ["active", "voided"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
