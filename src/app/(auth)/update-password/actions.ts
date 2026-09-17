"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChangePasswordSchema } from "@/lib/validations/auth";

export type UpdatePasswordState = {
  errors?: {
    currentPassword?: string;
    password?: string;
    confirmPassword?: string;
  };
  message?: string;
};

export async function updatePasswordAction(
  _prevState: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const result = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      errors: {
        currentPassword: fieldErrors.currentPassword?.[0],
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      },
    };
  }

  const supabase = await createClient();

  // Este flujo es exclusivamente un cambio autenticado ordinario. La
  // recuperación valida y aplica su token en /reset-password.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      message: "Inicia sesión para cambiar tu contraseña.",
    };
  }

  if (!user.email) {
    return { message: "No fue posible verificar tu cuenta. Inicia sesión de nuevo." };
  }

  // `current_password` no se aplica como una verificación universal en
  // todos los modos de Supabase Auth. Reautenticamos explícitamente al
  // mismo usuario antes de permitir el cambio de una sesión ordinaria.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: result.data.currentPassword,
  });
  if (reauthError) {
    return { message: "La contraseña actual no es correcta." };
  }

  const { error } = await supabase.auth.updateUser({
    password: result.data.password,
  });

  if (error) {
    return {
      message: "La contraseña actual no es correcta o no fue posible actualizarla.",
    };
  }

  // Cierra cualquier otra sesión activa del usuario: si la contraseña
  // cambió por una posible cuenta comprometida, las sesiones viejas no
  // deben seguir siendo válidas. La sesión actual (recién creada) no se ve
  // afectada por scope "others".
  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) {
    console.warn(`[auth] remote session revocation failed (${signOutError.code ?? "unknown"})`);
  }

  redirect("/dashboard?password_updated=1");
}
