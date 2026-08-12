import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Email confirmation endpoint for Supabase Auth.
//
// Supabase sends a confirmation link that includes token_hash and type.
// In production, configure the email template to point to:
//   <your-domain>/auth/confirm?token_hash={{ .TokenHash }}&type=signup
//
// The optional `next` parameter controls where to redirect after confirmation.
// It may arrive as a bare relative path OR as an absolute URL: Supabase's
// email templates substitute {{ .RedirectTo }} with whatever absolute
// `redirectTo` was passed to the *ForEmail() call (e.g. resetPasswordForEmail),
// since that same value must also satisfy Supabase's allow-list, which expects
// full URLs. Either way, only the path is used — the redirect always happens
// on the CURRENT request's origin (never a host parsed out of `next`), because
// verifyOtp() below sets the session cookie scoped to this origin, and
// redirecting to a different host would lose that cookie.
function extractSafeRedirectPath(next: string | null): string {
  if (!next) return "/dashboard";
  let path = next;
  if (!path.startsWith("/")) {
    try {
      const url = new URL(next);
      path = `${url.pathname}${url.search}`;
    } catch {
      return "/dashboard";
    }
  }
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  const redirectPath = extractSafeRedirectPath(next);

  // Invitaciones y recuperación de contraseña ya no pasan por aquí: el
  // correo enlaza directo a /accept-invite o /reset-password, que solo
  // consumen el token en un POST explícito (ver esos routes para el
  // porqué — un GET que ejecuta verifyOtp es vulnerable a que un
  // prefetch/escáner de enlaces lo consuma antes del clic real). Si de
  // todos modos llega un enlace viejo con alguno de estos types, se
  // descarta sin tocar el token en vez de reproducir ese problema aquí.
  if (type === "invite") {
    const url = request.nextUrl.clone();
    url.pathname = "/accept-invite";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (type === "recovery") {
    const url = request.nextUrl.clone();
    url.pathname = "/reset-password";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!token_hash || !type) {
    // Missing required parameters — redirect to login with a generic notice.
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.delete("token_hash");
    url.searchParams.delete("type");
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error) {
    // Do not log error details — they may contain token information.
    // Redirect to login so the user can request a new confirmation link.
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.delete("token_hash");
    url.searchParams.delete("type");
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  const destination = new URL(redirectPath, request.nextUrl.origin);
  return NextResponse.redirect(destination);
}
