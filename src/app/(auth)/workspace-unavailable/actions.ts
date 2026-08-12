"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function workspaceUnavailableLogoutAction(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
