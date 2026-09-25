"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/server/auth";
import { ClientSchema } from "../model/client-schema";
import type {
  ClientDialogState,
  ClientState,
  CreatedClient,
  DeleteClientState,
} from "../model/action-state";

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
//
// `createClientRow` es la única lógica de creación: valida, inserta con el
// `owner_id` del usuario autenticado (nunca aceptado del cliente) y
// revalida la caché del listado. Dos acciones la envuelven con
// comportamientos de navegación distintos: la del módulo Clientes
// (redirige al listado, como siempre) y la de creación contextual desde
// otro formulario (nunca navega — devuelve el cliente creado para que el
// formulario de origen lo seleccione sin perder sus propios datos).

async function createClientRow(
  formData: FormData,
): Promise<
  | { ok: true; client: CreatedClient }
  | { ok: false; state: ClientState }
> {
  const { supabase, user, workspaceId } = await requireWorkspace();

  const result = ClientSchema.safeParse(parseFormData(formData));
  if (!result.success) return { ok: false, state: fieldErrors(result) };

  const { data, error } = await supabase
    .from("clients")
    .insert({ owner_id: user.id, workspace_id: workspaceId, ...result.data })
    .select(
      "id, identification_type, full_name, identification_number, exact_address, marital_status, occupation, nationality",
    )
    .single();

  if (error || !data) {
    return {
      ok: false,
      state: { message: "No fue posible crear el cliente. Intenta de nuevo." },
    };
  }

  revalidatePath("/clients");
  return { ok: true, client: data };
}

export async function createClientAction(
  _prevState: ClientState,
  formData: FormData,
): Promise<ClientState> {
  const result = await createClientRow(formData);
  if (!result.ok) return result.state;

  redirect("/clients?event=created");
}

/**
 * Creación contextual desde otro formulario (Escritura, Cuenta por
 * cobrar): nunca redirige. El componente que la usa (`CreateClientDialog`)
 * cierra el diálogo y selecciona el cliente devuelto por su cuenta.
 */
export async function createClientForDialogAction(
  _prevState: ClientDialogState,
  formData: FormData,
): Promise<ClientDialogState> {
  const result = await createClientRow(formData);
  if (!result.ok) return result.state;

  return { success: true, client: result.client };
}

// ------------------------------------------------------------------ update

export async function updateClientAction(
  id: string,
  _prevState: ClientState,
  formData: FormData,
): Promise<ClientState> {
  const { supabase, workspaceId } = await requireWorkspace();

  const result = ClientSchema.safeParse(parseFormData(formData));
  if (!result.success) return fieldErrors(result);

  const { error } = await supabase
    .from("clients")
    .update(result.data)
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    return {
      message: "No fue posible actualizar el cliente. Intenta de nuevo.",
    };
  }

  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  redirect("/clients?event=updated");
}

// ------------------------------------------------------------------ delete

export async function deleteClientAction(
  id: string,
  _prevState: DeleteClientState,
  _formData: FormData,
): Promise<DeleteClientState> {
  void _prevState;
  void _formData;

  const { supabase, workspaceId } = await requireWorkspace();

  const { data, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      message:
        "No se pudo eliminar el cliente. Puede estar asociado a otros registros.",
    };
  }

  revalidatePath("/clients");
  redirect("/clients");
}
