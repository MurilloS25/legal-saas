"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/auth";
import {
  ReceivableSchema,
  parseReceivableFormData,
  type ReceivableInput,
} from "../model/receivables";
import type { Database } from "@/lib/supabase/database.types";
import {
  appendReturnTo,
  parseDocumentReceivablesReturnTo,
} from "@/lib/navigation/context-return";
import { receivableHasPaymentHistory } from "./payment-queries";

type ReceivableInsert = Database["public"]["Tables"]["receivables"]["Insert"];
type ReceivableUpdate = Database["public"]["Tables"]["receivables"]["Update"];

// ------------------------------------------------------------------ types

export type ReceivableState = {
  errors?: {
    client_id?: string;
    client_name?: string;
    document_id?: string;
    concept?: string;
    currency?: string;
    amount_total?: string;
    issued_at?: string;
    due_at?: string;
    notes?: string;
  };
  message?: string;
  success?: boolean;
};

export type DeleteReceivableState = {
  message?: string;
};

// ------------------------------------------------------------------ helpers

function fieldErrors(
  result: ReturnType<typeof ReceivableSchema.safeParse>,
): ReceivableState {
  if (result.success) return {};
  const fe = result.error.flatten().fieldErrors;
  return {
    errors: {
      client_id: fe.client_id?.[0],
      client_name: fe.client_name?.[0],
      document_id: fe.document_id?.[0],
      concept: fe.concept?.[0],
      currency: fe.currency?.[0],
      amount_total: fe.amount_total?.[0],
      issued_at: fe.issued_at?.[0],
      due_at: fe.due_at?.[0],
      notes: fe.notes?.[0],
    },
  };
}

function receivableMutationMessage(code: string | undefined): string {
  if (code === "23514") {
    return "No fue posible guardar la cuenta. Revisa el monto, la moneda o los pagos registrados.";
  }
  return "No fue posible actualizar la cuenta por cobrar. Intenta de nuevo.";
}

/**
 * Construye el payload de escritura a partir de la entrada validada.
 *
 * Para "Cliente registrado" nunca se envía el texto del formulario como
 * snapshot: se manda `null` y el trigger `sync_receivable_client_name_snapshot`
 * lo deriva siempre del nombre vigente del Cliente en el momento de
 * guardar — así no se puede falsificar el nombre visible de una cuenta con
 * `client_id`. Para "Escribir nombre" se envía `client_id: null` y el texto
 * digitado como snapshot (el CHECK de la tabla exige que no quede vacío).
 *
 * `client_name_snapshot` se envía `null` para "Cliente registrado" — el
 * tipo generado lo marca `string` (no nullable) porque la columna es
 * `NOT NULL` a nivel de tabla, pero eso no ve que un trigger BEFORE la
 * rellena antes de que se evalúe esa restricción; de ahí el cast.
 */
function buildReceivableMutation(
  data: ReceivableInput,
): Omit<ReceivableInsert, "owner_id"> {
  const isRegistered = data.client_mode === "registered";
  return {
    client_id: isRegistered ? data.client_id : null,
    client_name_snapshot: isRegistered
      ? (null as unknown as string)
      : data.client_name.trim(),
    document_id: data.document_id,
    concept: data.concept,
    currency: data.currency,
    amount_total: Number(data.amount_total),
    issued_at: data.issued_at,
    due_at: data.due_at,
    notes: data.notes,
  };
}

// ------------------------------------------------------------------ create

export async function createReceivableAction(
  _prevState: ReceivableState,
  formData: FormData,
): Promise<ReceivableState> {
  const { supabase, user } = await requireUser();

  const result = parseReceivableFormData(formData);
  if (!result.success) return fieldErrors(result);

  const mutation = buildReceivableMutation(result.data);

  const { data, error } = await supabase
    .from("receivables")
    .insert({ owner_id: user.id, ...mutation })
    .select("id")
    .single();

  if (error || !data) {
    return {
      message: "No fue posible crear la cuenta por cobrar. Intenta de nuevo.",
    };
  }

  // Revalidado server-side de nuevo: el input oculto viaja desde el
  // cliente, así que nunca se confía en su valor sin volver a chequear el
  // patrón permitido.
  const returnTo = parseDocumentReceivablesReturnTo(
    formData.get("returnTo") as string | null,
  );

  revalidatePath("/dashboard/receivables");
  redirect(
    appendReturnTo(`/dashboard/receivables/${data.id}?created=1`, returnTo),
  );
}

// ------------------------------------------------------------------ update

export async function updateReceivableAction(
  id: string,
  _prevState: ReceivableState,
  formData: FormData,
): Promise<ReceivableState> {
  const { supabase, user } = await requireUser();

  const result = parseReceivableFormData(formData);
  if (!result.success) return fieldErrors(result);

  const mutation: ReceivableUpdate = buildReceivableMutation(result.data);

  // Inmutabilidad financiera: con cualquier pago histórico (activo o
  // anulado), monto/moneda/Cliente/Escritura quedan bloqueados. Esto es
  // defensa adicional a la UI (que ya deshabilita estos campos) y al
  // trigger de base de datos — un request manipulado que solo ocultara los
  // inputs no bastaría para pasar esto.
  const hasPayments = await receivableHasPaymentHistory(supabase, id, user.id);
  if (hasPayments) {
    const { data: existing, error: existingError } = await supabase
      .from("receivables")
      .select("client_id, client_name_snapshot, document_id, currency, amount_total")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (existingError) {
      return {
        message: "No fue posible actualizar la cuenta por cobrar. Intenta de nuevo.",
      };
    }
    if (!existing) {
      return { message: "No se encontró la cuenta por cobrar." };
    }

    const financialFieldsChanged =
      mutation.client_id !== existing.client_id ||
      (mutation.client_id === null &&
        mutation.client_name_snapshot !== existing.client_name_snapshot) ||
      mutation.document_id !== existing.document_id ||
      mutation.currency !== existing.currency ||
      Number(mutation.amount_total) !== Number(existing.amount_total);

    if (financialFieldsChanged) {
      return {
        message:
          "Esta cuenta ya tiene pagos registrados: el monto, la moneda, el cliente y la escritura relacionada no se pueden modificar.",
      };
    }
  }

  const { error } = await supabase
    .from("receivables")
    .update(mutation)
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    return {
      message: receivableMutationMessage(error.code),
    };
  }

  revalidatePath(`/dashboard/receivables/${id}`);
  revalidatePath("/dashboard/receivables");
  redirect(`/dashboard/receivables/${id}`);
}

// ------------------------------------------------------------------ delete

export async function deleteReceivableAction(
  id: string,
  _prevState: DeleteReceivableState,
  _formData: FormData,
): Promise<DeleteReceivableState> {
  void _prevState;
  void _formData;

  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("receivables")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      message:
        error?.code === "23514"
          ? "No se pudo eliminar la cuenta porque tiene pagos activos registrados."
          : "No se pudo eliminar la cuenta por cobrar. Intenta de nuevo.",
    };
  }

  revalidatePath("/dashboard/receivables");
  redirect("/dashboard/receivables");
}
