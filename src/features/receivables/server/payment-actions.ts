"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/auth";
import type { Database } from "@/lib/supabase/database.types";
import {
  parseRegisterPaymentFormData,
  parseVoidPaymentFormData,
} from "../model/receivable-payments";
import {
  appendReturnTo,
  parseDocumentReceivablesReturnTo,
} from "@/lib/navigation/context-return";

// ------------------------------------------------------------------ types

export type PaymentState = {
  errors?: {
    amount?: string;
    paid_at?: string;
    method?: string;
    reference?: string;
  };
  message?: string;
  /** Solo poblado por `registerPaymentForDialogAction` (modo diálogo,
   * registro contextual desde una Escritura, que nunca redirige). */
  success?: boolean;
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
//
// `registerPaymentRow` es la única lógica de registro: valida y llama la RPC
// atómica. Dos acciones la envuelven con comportamientos de navegación
// distintos — la de la propia Cuenta por cobrar (redirige a la pestaña
// Pagos, como siempre) y la de registro contextual desde el paso "Cobro" de
// una Escritura (nunca navega — el diálogo de origen se cierra solo).

async function registerPaymentRow(
  receivableId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; state: PaymentState }> {
  const { supabase } = await requireUser();

  const result = parseRegisterPaymentFormData(formData);
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors;
    return {
      ok: false,
      state: {
        errors: {
          amount: fe.amount?.[0],
          paid_at: fe.paid_at?.[0],
          method: fe.method?.[0],
          reference: fe.reference?.[0],
        },
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
    return { ok: false, state: { message: registerErrorMessage(error.code) } };
  }

  revalidatePath(`/dashboard/receivables/${receivableId}`);
  return { ok: true };
}

export async function registerPaymentAction(
  receivableId: string,
  _prevState: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const result = await registerPaymentRow(receivableId, formData);
  if (!result.ok) return result.state;

  const returnTo = parseDocumentReceivablesReturnTo(
    formData.get("returnTo") as string | null,
  );
  redirect(
    appendReturnTo(
      `/dashboard/receivables/${receivableId}?section=payments&paid=1`,
      returnTo,
    ),
  );
}

/**
 * Registro contextual desde el paso "Cobro" de una Escritura: nunca
 * redirige. El diálogo que la usa se cierra y refresca el resumen sin
 * abandonar la Escritura.
 */
export async function registerPaymentForDialogAction(
  receivableId: string,
  documentId: string,
  _prevState: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const result = await registerPaymentRow(receivableId, formData);
  if (!result.ok) return result.state;

  revalidatePath(`/dashboard/documents/${documentId}`);
  return { success: true };
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
        : error.code === "28000"
          ? "Solo el propietario o un administrador puede anular un pago."
          : "No fue posible anular el pago. Intenta de nuevo.";
    return { error: message };
  }

  revalidatePath(`/dashboard/receivables/${receivableId}`);
  const returnTo = parseDocumentReceivablesReturnTo(
    formData.get("returnTo") as string | null,
  );
  redirect(
    appendReturnTo(
      `/dashboard/receivables/${receivableId}?section=payments`,
      returnTo,
    ),
  );
}
