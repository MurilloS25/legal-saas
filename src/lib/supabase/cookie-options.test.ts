import { describe, expect, it } from "vitest";
import { getAuthCookieOptions, isSupabaseAuthCookie } from "./cookie-options";

describe("Supabase SSR cookie policy", () => {
  it("uses HttpOnly, SameSite=Lax and Secure in production", () => {
    expect(getAuthCookieOptions(true)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  });

  it("keeps local HTTP development usable", () => {
    expect(getAuthCookieOptions(false)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
  });

  it("recognizes only Supabase auth cookies and their chunks", () => {
    expect(isSupabaseAuthCookie("sb-127-auth-token")).toBe(true);
    expect(isSupabaseAuthCookie("sb-projectref-auth-token.1")).toBe(true);
    expect(isSupabaseAuthCookie("unrelated-session")).toBe(false);
  });
});
