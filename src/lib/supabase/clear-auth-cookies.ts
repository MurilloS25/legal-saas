import "server-only";

import { cookies } from "next/headers";
import { isSupabaseAuthCookie } from "./cookie-options";

export async function clearLocalAuthCookies(): Promise<void> {
  const store = await cookies();
  for (const cookie of store.getAll()) {
    if (isSupabaseAuthCookie(cookie.name)) store.delete(cookie.name);
  }
}
