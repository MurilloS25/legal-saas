import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * Cliente con la service role key — solo para operaciones de la Admin API
 * (invitar usuarios) que no puede hacer el cliente anon/autenticado normal.
 * Server-only: nunca debe importarse desde un Client Component. No usa
 * cookies ni sesión — cada llamada actúa con privilegios totales, así que
 * cada Server Action que lo use debe validar auth/rol ANTES de invocarlo.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
