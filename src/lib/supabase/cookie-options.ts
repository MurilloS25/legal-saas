import type { CookieOptionsWithName } from "@supabase/ssr";

export function getAuthCookieOptions(
  production = process.env.NODE_ENV === "production",
): CookieOptionsWithName {
  return {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: production,
  };
}

export function isSupabaseAuthCookie(name: string): boolean {
  return /^sb-[^-]+-auth-token(?:\.\d+)?$/.test(name);
}
