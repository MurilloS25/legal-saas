"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ConfirmResetState = {
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

  if (typeof tokenHash !== "string" || !tokenHash) {
    return { message: "Enlace de recuperación inválido." };
  }
  if (typeof email !== "string" || !email) {
    return { message: "Enlace de recuperación inválido." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (error) {
    // No se registra el detalle del error — podría contener información
    // del token. Un token ya usado, expirado o inválido comparten el
    // mismo mensaje genérico.
    return {
      message: "El enlace ya se usó o expiró. Solicita uno nuevo.",
    };
  }

  // URL limpia: ni token_hash ni email quedan en la barra de direcciones.
  // /update-password ya verifica la sesión server-side antes de mostrar
  // el formulario (sin cambios — ver ese archivo).
  redirect("/update-password");
}
