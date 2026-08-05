"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ConfirmInviteState = {
  message?: string;
};

/**
 * Único punto donde se consume el token de invitación. A diferencia del
 * antiguo /auth/confirm?type=invite (un GET que ejecutaba verifyOtp como
 * efecto secundario de simplemente cargar la URL — vulnerable a que un
 * prefetch de navegador, un antivirus o un escáner de enlaces de correo
 * "hicieran clic" antes que la persona real), esto es un Server Action:
 * solo se ejecuta con un POST explícito, que Next.js ya protege contra
 * solicitudes de otro origen (verifica Origin/Host contra el propio
 * despliegue) — la misma defensa que usa cada Server Action del resto de
 * la app, sin mecanismos nuevos.
 *
 * token_hash nunca se registra: los `error` de Supabase no se loguean (ver
 * el comentario equivalente en auth/confirm/route.ts) y los mensajes de
 * error devueltos aquí son siempre genéricos.
 */
export async function confirmInviteAction(
  _prevState: ConfirmInviteState,
  formData: FormData,
): Promise<ConfirmInviteState> {
  const tokenHash = formData.get("token_hash");
  const email = formData.get("email");

  if (typeof tokenHash !== "string" || !tokenHash) {
    return { message: "Enlace de invitación inválido." };
  }
  if (typeof email !== "string" || !email) {
    return { message: "Enlace de invitación inválido." };
  }

  const supabase = await createClient();

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "invite",
  });

  if (verifyError) {
    // No se registra el detalle del error — podría contener información
    // del token. Un token ya usado, expirado o inválido comparten el
    // mismo mensaje genérico.
    return {
      message: "El enlace ya se usó o expiró. Pide una nueva invitación.",
    };
  }

  const { data: pending, error: pendingError } = await supabase
    .rpc("get_pending_workspace_invitation")
    .maybeSingle();

  if (pendingError || !pending) {
    return {
      message: "No se encontró una invitación pendiente para tu cuenta.",
    };
  }

  const { error: acceptError } = await supabase.rpc(
    "accept_workspace_invitation",
    { p_workspace_id: pending.workspace_id },
  );

  if (acceptError) {
    return { message: "No fue posible aceptar la invitación. Intenta de nuevo." };
  }

  // URL limpia: ni token_hash ni email quedan en la barra de direcciones.
  redirect("/accept-invite/set-password");
}
