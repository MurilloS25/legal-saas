"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/auth";
import {
  ReceivableSchema,
  parseReceivableFormData,
} from "../model/receivables";

// ------------------------------------------------------------------ types

export type ReceivableState = {
  errors?: {
    client_id?: string;
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

// ------------------------------------------------------------------ create

export async function createReceivableAction(
  _prevState: ReceivableState,
  formData: FormData,
): Promise<ReceivableState> {
  const { supabase, user } = await requireUser();

  const result = parseReceivableFormData(formData);
  if (!result.success) return fieldErrors(result);

  const mutation = {
    ...result.data,
    amount_total: Number(result.data.amount_total),
  };

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

  revalidatePath("/dashboard/receivables");
  redirect(`/dashboard/receivables/${data.id}?created=1`);
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

  const mutation = {
    ...result.data,
    amount_total: Number(result.data.amount_total),
  };

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
