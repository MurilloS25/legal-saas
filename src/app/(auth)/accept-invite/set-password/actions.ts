"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordSchema } from "@/lib/validations/auth";

export type SetInvitePasswordState = {
  errors?: {
    password?: string;
    confirmPassword?: string;
  };
  message?: string;
};

export async function setInvitePasswordAction(
  _prevState: SetInvitePasswordState,
  formData: FormData,
): Promise<SetInvitePasswordState> {
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

  const { error } = await supabase.auth.updateUser({
    password: result.data.password,
  });
  if (error) {
    return { message: "No fue posible fijar la contraseña. Intenta de nuevo." };
  }

  redirect("/dashboard?invitation_accepted=1");
}
