"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ClientSchema } from "@/lib/validations/clients";

// ------------------------------------------------------------------ types

export type ClientState = {
  errors?: {
    full_name?: string;
    identification_type?: string;
    identification_number?: string;
    marital_status?: string;
    nationality?: string;
    occupation?: string;
    exact_address?: string;
  };
  message?: string;
  success?: boolean;
};

export type DeleteClientState = {
  message?: string;
};

// ------------------------------------------------------------------ helpers

function parseFormData(formData: FormData) {
  return {
    full_name: String(formData.get("full_name") ?? ""),
    identification_type: String(formData.get("identification_type") ?? ""),
    identification_number: String(formData.get("identification_number") ?? ""),
    marital_status: String(formData.get("marital_status") ?? ""),
    nationality: String(formData.get("nationality") ?? ""),
    occupation: String(formData.get("occupation") ?? ""),
    exact_address: String(formData.get("exact_address") ?? ""),
  };
}

function fieldErrors(result: ReturnType<typeof ClientSchema.safeParse>): ClientState {
  if (result.success) return {};
  const fe = result.error.flatten().fieldErrors;
  return {
    errors: {
      full_name: fe.full_name?.[0],
      identification_type: fe.identification_type?.[0],
      identification_number: fe.identification_number?.[0],
      marital_status: fe.marital_status?.[0],
      nationality: fe.nationality?.[0],
      occupation: fe.occupation?.[0],
      exact_address: fe.exact_address?.[0],
    },
  };
}

// ------------------------------------------------------------------ create

export async function createClientAction(
  _prevState: ClientState,
  formData: FormData,
): Promise<ClientState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const result = ClientSchema.safeParse(parseFormData(formData));
  if (!result.success) return fieldErrors(result);

  const { data, error } = await supabase
    .from("clients")
    .insert({ owner_id: user.id, ...result.data })
    .select("id")
    .single();

  if (error || !data) {
    return { message: "No fue posible crear el cliente. Intenta de nuevo." };
  }

  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}

// ------------------------------------------------------------------ update

export async function updateClientAction(
  id: string,
  _prevState: ClientState,
  formData: FormData,
): Promise<ClientState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const result = ClientSchema.safeParse(parseFormData(formData));
  if (!result.success) return fieldErrors(result);

  const { error } = await supabase
    .from("clients")
    .update(result.data)
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    return {
      message: "No fue posible actualizar el cliente. Intenta de nuevo.",
    };
  }

  revalidatePath(`/dashboard/clients/${id}`);
  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}

// ------------------------------------------------------------------ delete

export async function deleteClientAction(
  id: string,
  _prevState: DeleteClientState,
  _formData: FormData,
): Promise<DeleteClientState> {
  void _prevState;
  void _formData;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      message:
        "No se pudo eliminar el cliente. Puede estar asociado a otros registros.",
    };
  }

  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}
