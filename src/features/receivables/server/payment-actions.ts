"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/auth";
import type { Database } from "@/lib/supabase/database.types";
import {
  parseRegisterPaymentFormData,
  parseVoidPaymentFormData,
} from "../model/receivable-payments";

// ------------------------------------------------------------------ types

export type PaymentState = {
  errors?: {
    amount?: string;
    paid_at?: string;
    method?: string;
    reference?: string;
  };
  message?: string;
};

export type VoidPaymentState = {
  error?: string;
};

// Traduce el SQLSTATE de la RPC a un mensaje accionable para el usuario.
function registerErrorMessage(code: string | undefined): string {
  switch (code) {
    case "23514":
      return "El pago supera el saldo pendiente de la cuenta.";
    case "22003":
      return "El monto debe ser mayor que cero.";
    case "22023":
      return "El método de pago no es válido.";
    case "P0002":
      return "La cuenta por cobrar no existe.";
    default:
      return "No fue posible registrar el pago. Intenta de nuevo.";
  }
}

// ------------------------------------------------------------------ register

export async function registerPaymentAction(
  receivableId: string,
  _prevState: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const { supabase } = await requireUser();

  const result = parseRegisterPaymentFormData(formData);
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors;
    return {
      errors: {
        amount: fe.amount?.[0],
        paid_at: fe.paid_at?.[0],
        method: fe.method?.[0],
        reference: fe.reference?.[0],
      },
    };
  }

  type RegisterPaymentArgs = Database["public"]["Functions"]["register_receivable_payment"]["Args"];

  const args = {
    p_receivable_id: receivableId,
    p_amount: Number(result.data.amount),
    p_paid_at: result.data.paid_at,
    p_method: result.data.method,
    p_reference: result.data.reference,
  };

  // PostgreSQL accepts null for these optional values, but generated function
  // argument types do not encode parameter nullability.
  const { error } = await supabase.rpc(
    "register_receivable_payment",
    args as RegisterPaymentArgs,
  );

  if (error) {
    return { message: registerErrorMessage(error.code) };
  }

  revalidatePath(`/dashboard/receivables/${receivableId}`);
  redirect(`/dashboard/receivables/${receivableId}?section=payments`);
}

// ------------------------------------------------------------------ void

export async function voidPaymentAction(
  receivableId: string,
  paymentId: string,
  _prevState: VoidPaymentState,
  formData: FormData,
): Promise<VoidPaymentState> {
  const { supabase } = await requireUser();

  const result = parseVoidPaymentFormData(formData);
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors;
    return { error: fe.reason?.[0] ?? "El motivo es requerido." };
  }

  const { error } = await supabase.rpc("void_receivable_payment", {
    p_payment_id: paymentId,
    p_reason: result.data.reason,
  });

  if (error) {
    const message =
      error.code === "23514"
        ? "El pago ya está anulado."
        : "No fue posible anular el pago. Intenta de nuevo.";
    return { error: message };
  }

  revalidatePath(`/dashboard/receivables/${receivableId}`);
  redirect(`/dashboard/receivables/${receivableId}?section=payments`);
}
