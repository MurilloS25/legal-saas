"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordSchema } from "@/lib/validations/auth";

export type AcceptInviteState = {
  errors?: {
    password?: string;
    confirmPassword?: string;
  };
  message?: string;
};

/**
 * Fija la contraseña de la cuenta invitada y activa la membresía. Ambos
 * pasos requieren la sesión creada por /auth/confirm?type=invite — sin
 * ella, el enlace expiró o ya se usó. El workspace_id se resuelve aquí
 * mismo (no se confía en un valor enviado por el cliente): si no hay
 * invitación pendiente para este usuario, accept_workspace_invitation
 * simplemente falla.
 */
export async function acceptInvitationAction(
  _prevState: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const result = UpdatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      errors: {
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      },
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { message: "El enlace expiró o ya se usó. Pide una nueva invitación." };
  }

  const { data: pending, error: pendingError } = await supabase
    .rpc("get_pending_workspace_invitation")
    .maybeSingle();

  if (pendingError || !pending) {
    return { message: "No se encontró una invitación pendiente para tu cuenta." };
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: result.data.password,
  });
  if (passwordError) {
    return { message: "No fue posible fijar la contraseña. Intenta de nuevo." };
  }

  const { error: acceptError } = await supabase.rpc(
    "accept_workspace_invitation",
    { p_workspace_id: pending.workspace_id },
  );
  if (acceptError) {
    return { message: "No fue posible aceptar la invitación. Intenta de nuevo." };
  }

  redirect("/dashboard?invitation_accepted=1");
}
