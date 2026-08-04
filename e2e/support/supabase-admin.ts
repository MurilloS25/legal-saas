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
