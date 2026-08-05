/**
 * Acceso a la Admin API de Supabase Auth (service role) — solo para E2E que
 * necesitan crear/revocar usuarios desechables (recuperación de contraseña,
 * usuario revocado). No se usa en la app en sí; nunca debe usarse fuera de
 * este directorio de soporte de pruebas.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name} — .env.local must be configured for authenticated E2E tests`,
    );
  }
  return value;
}

function adminUrl(path: string): string {
  return `${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/auth/v1/admin${path}`;
}

function adminHeaders(): Record<string, string> {
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

/** Crea un usuario ya confirmado (invite-only real: nunca pasa por /signup). */
export async function createDisposableUser(
  email: string,
  password: string,
): Promise<string> {
  const response = await fetch(adminUrl("/users"), {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!response.ok) {
    throw new Error(
      `Admin create user failed: ${response.status} ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { id: string };
  return body.id;
}

/** Revoca el acceso del usuario (equivalente a lo que haría el propietario/notario). */
export async function banUser(userId: string): Promise<void> {
  const response = await fetch(adminUrl(`/users/${userId}`), {
    method: "PUT",
    headers: adminHeaders(),
    // Supabase no soporta ban permanente directo; una duración larga (~100
    // años) es el mecanismo estándar para una revocación efectivamente
    // permanente vía Admin API.
    body: JSON.stringify({ ban_duration: "876000h" }),
  });
  if (!response.ok) {
    throw new Error(
      `Admin ban user failed: ${response.status} ${await response.text()}`,
    );
  }
}

/** Limpieza: elimina el usuario desechable creado por el test. */
export async function deleteUser(userId: string): Promise<void> {
  const response = await fetch(adminUrl(`/users/${userId}`), {
    method: "DELETE",
    headers: adminHeaders(),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(
      `Admin delete user failed: ${response.status} ${await response.text()}`,
    );
  }
}

/**
 * Lectura directa vía PostgREST con la service role key — solo para
 * verificar en E2E un efecto de base de datos que no tiene una superficie
 * en la UI (p. ej. que la auditoría de equipo sobrevive a la remoción de un
 * miembro). Nunca se usa para mutar datos: eso siempre pasa por la app real
 * (Server Actions / RPCs), que es lo que estos tests están verificando.
 */
export async function restSelect<T>(
  table: string,
  query: string,
): Promise<T[]> {
  const response = await fetch(
    `${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/${table}?${query}`,
    { headers: adminHeaders() },
  );
  if (!response.ok) {
    throw new Error(
      `Admin rest select failed: ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()) as T[];
}

/**
 * Borrado directo vía PostgREST — solo para limpieza de recursos que no
 * tienen cascada desde auth.users (workspace_activity.actor_user_id /
 * target_user_id no tienen ON DELETE CASCADE a propósito, para que la
 * auditoría sobreviva a una remoción real de la app). Sin esto, borrar un
 * usuario de prueba que generó actividad de equipo falla por violación de
 * llave foránea.
 */
export async function restDelete(table: string, query: string): Promise<void> {
  const response = await fetch(
    `${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/${table}?${query}`,
    { method: "DELETE", headers: adminHeaders() },
  );
  if (!response.ok) {
    throw new Error(
      `Admin rest delete failed: ${response.status} ${await response.text()}`,
    );
  }
}

/**
 * Actualización directa vía PostgREST — solo para sembrar un estado de fila
 * que una acción real de la app produciría (p. ej. status='revoked', lo
 * mismo que deja suspend_workspace_member), cuando lo que el test verifica
 * es el efecto de ESE estado sobre otro flujo, no la acción que lo produce
 * (esa ya tiene su propia cobertura E2E dedicada — ver team-management).
 */
export async function restUpdate(
  table: string,
  query: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(
    `${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/${table}?${query}`,
    {
      method: "PATCH",
      headers: adminHeaders(),
      body: JSON.stringify(patch),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Admin rest update failed: ${response.status} ${await response.text()}`,
    );
  }
}

/**
 * Inserta directo vía PostgREST con la service role key — solo para sembrar
 * fixtures neutrales (p. ej. un machote activo) que no son en sí lo que un
 * spec está verificando, evitando repetir un flujo de UI caro (el editor
 * Tiptap del machote) que ya tiene su propia cobertura E2E dedicada. La
 * ACCIÓN bajo prueba siempre pasa por la app real — esto es equivalente a
 * los fixtures de auth.users que ya se crean vía Admin API.
 */
export async function restInsert<T extends { id: string }>(
  table: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/${table}`,
    {
      method: "POST",
      headers: { ...adminHeaders(), Prefer: "return=representation" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Admin rest insert failed: ${response.status} ${await response.text()}`,
    );
  }
  const rows = (await response.json()) as T[];
  return rows[0];
}
