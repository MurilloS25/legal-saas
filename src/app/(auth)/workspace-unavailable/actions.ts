"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clearLocalAuthCookies } from "@/lib/supabase/clear-auth-cookies";
import { revokeAndClearSession } from "@/lib/auth/logout";

export async function workspaceUnavailableLogoutAction(): Promise<never> {
  const supabase = await createClient();
  await revokeAndClearSession(supabase, clearLocalAuthCookies);
  redirect("/login");
}
