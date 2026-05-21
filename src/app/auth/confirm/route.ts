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
// Only internal paths (starting with "/") are accepted to prevent open redirects.

function isSafeRedirectPath(path: string | null): boolean {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  const redirectTo = isSafeRedirectPath(next) ? (next as string) : "/dashboard";

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

  const url = request.nextUrl.clone();
  url.pathname = redirectTo;
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");
  url.searchParams.delete("next");
  return NextResponse.redirect(url);
}
