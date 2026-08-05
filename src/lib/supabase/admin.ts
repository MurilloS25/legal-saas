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

/**
 * Busca un usuario existente por email exacto vía la Admin API — necesario
 * para re-invitar a alguien que ya tiene cuenta (p. ej. un miembro
 * removido de un Workspace): `admin.inviteUserByEmail` falla con
 * `email_exists` en ese caso, y el SDK de supabase-js no expone un
 * `getUserByEmail`, así que se llama al endpoint REST directo con el
 * parámetro `filter` (búsqueda por email que sí soporta la Admin API,
 * aunque no esté tipado en el cliente JS).
 */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  const response = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );
  if (!response.ok) return null;
  const body = (await response.json()) as { users: { id: string; email?: string }[] };
  const match = body.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  return match?.id ?? null;
}
