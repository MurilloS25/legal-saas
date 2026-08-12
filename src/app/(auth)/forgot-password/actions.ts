"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ForgotPasswordSchema } from "@/lib/validations/auth";

export type ForgotPasswordState = {
  errors?: {
    email?: string;
  };
  message?: string;
  submitted?: boolean;
};

// Mismo mensaje siempre, exista o no la cuenta, y también ante cualquier
// error real (p. ej. rate limit de Supabase): nunca revela si un correo
// está registrado. Es la misma lógica de no-enumeración que ya usa loginAction.
const GENERIC_MESSAGE =
  "Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.";

/**
 * Resuelve el origen público de la app a partir de los headers de la
 * request (no hay una env var de "site URL" propia todavía). En local usa
 * http; en cualquier otro host asume https, salvo que el proxy indique lo
 * contrario vía x-forwarded-proto (siempre presente en Vercel).
 */
async function resolveSiteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const result = ForgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return { errors: { email: fieldErrors.email?.[0] } };
  }

  const supabase = await createClient();
  const origin = await resolveSiteOrigin();

  await supabase.auth.resetPasswordForEmail(result.data.email, {
    redirectTo: `${origin}/update-password`,
  });

  return { submitted: true, message: GENERIC_MESSAGE };
}
