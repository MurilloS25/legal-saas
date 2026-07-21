import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UnauthorizedError } from "@/lib/server/errors";

const getServerAuth = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
});

/** Auth context for Server Components and Server Actions. */
export async function requireUser() {
  const context = await getServerAuth();
  if (!context.user) redirect("/login");
  return { supabase: context.supabase, user: context.user };
}

/** Auth context for Route Handlers. APIs must map this error to HTTP. */
export async function requireApiUser() {
  const context = await getServerAuth();
  if (!context.user) throw new UnauthorizedError();
  return { supabase: context.supabase, user: context.user };
}
