"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordSchema } from "@/lib/validations/auth";

export type ConfirmResetState = {
  errors?: {
    password?: string;
    confirmPassword?: string;
  };
  message?: string;
};

/**
 * Único punto donde se consume el token de recuperación. Mismo patrón que
 * src/app/(auth)/accept-invite/confirm-actions.ts (ver ese archivo para el
 * razonamiento completo): solo un POST explícito — protegido por la misma
 * verificación de Origin/Host que ya usa cualquier Server Action de
 * Next.js, sin mecanismos nuevos — ejecuta verifyOtp. token_hash nunca se
 * registra; los mensajes de error son siempre genéricos.
 */
export async function confirmResetAction(
  _prevState: ConfirmResetState,
  formData: FormData,
): Promise<ConfirmResetState> {
  const tokenHash = formData.get("token_hash");
  const email = formData.get("email");
  const result = UpdatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (typeof tokenHash !== "string" || !tokenHash) {
    return { message: "Enlace de recuperación inválido." };
  }
  if (typeof email !== "string" || !email) {
    return { message: "Enlace de recuperación inválido." };
  }
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    return {
      errors: {
        password: errors.password?.[0],
        confirmPassword: errors.confirmPassword?.[0],
      },
    };
  }

  const supabase = await createClient();

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (verifyError) {
    // No se registra el detalle del error — podría contener información
    // del token. Un token ya usado, expirado o inválido comparten el
    // mismo mensaje genérico.
    return {
      message: "El enlace ya se usó o expiró. Solicita uno nuevo.",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: result.data.password,
  });
  if (updateError) {
    return { message: "No fue posible actualizar la contraseña. Intenta de nuevo." };
  }

  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) {
    console.warn(`[auth] remote session revocation failed (${signOutError.code ?? "unknown"})`);
  }

  // La redirección elimina token_hash y email de la URL y no persiste el
  // token en almacenamiento del navegador.
  redirect("/dashboard?password_updated=1");
}
