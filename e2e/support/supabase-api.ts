/**
 * Acceso REST (PostgREST) a Supabase local para los helpers de E2E.
 *
 * Usa el JWT del usuario de prueba extraído del storageState de Playwright
 * junto con la anon key: todas las operaciones pasan por RLS igual que la
 * aplicación. No se usa el service role.
 */

import { readFileSync } from "node:fs";
import type { CleanupResource } from "./cleanup-registry";

const STORAGE_STATE_PATH = "playwright/.auth/user.json";

type StorageState = {
  cookies: { name: string; value: string }[];
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name} — .env.local must be configured for authenticated E2E tests`,
    );
  }
  return value;
}

function decodeCookiePayload(raw: string): string {
  const value = decodeURIComponent(raw);
  if (value.startsWith("base64-")) {
    return Buffer.from(value.slice("base64-".length), "base64url").toString(
      "utf8",
    );
  }
  return value;
}

/**
 * Extrae el access token de la sesión guardada por el proyecto `setup`.
 * Soporta cookies fragmentadas (`sb-...-auth-token.0`, `.1`, ...).
 */
export function getTestUserAuth(): { accessToken: string; userId: string } {
  const state = JSON.parse(
    readFileSync(STORAGE_STATE_PATH, "utf8"),
  ) as StorageState;

  const chunks = state.cookies
    .map((cookie) => {
      const match = cookie.name.match(/^sb-.+-auth-token(?:\.(\d+))?$/);
      if (!match) return null;
      return { index: match[1] ? Number(match[1]) : 0, value: cookie.value };
    })
    .filter((c): c is { index: number; value: string } => c !== null)
    .sort((a, b) => a.index - b.index);

  if (chunks.length === 0) {
    throw new Error(
      `No Supabase auth cookie found in ${STORAGE_STATE_PATH} — run the setup project first`,
    );
  }

  const session = JSON.parse(
    decodeCookiePayload(chunks.map((c) => c.value).join("")),
  ) as { access_token?: string };

  const accessToken = session.access_token;
  if (!accessToken) {
    throw new Error("Auth cookie does not contain an access_token");
  }

  const payload = JSON.parse(
    Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"),
  ) as { sub?: string };
  if (!payload.sub) {
    throw new Error("Access token does not contain a sub claim");
  }

  return { accessToken, userId: payload.sub };
}

// Mismo orden de resolución que la app (src/lib/supabase/*): la publishable
// key es el nombre nuevo de la anon key.
function getApiKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or ANON_KEY) — .env.local must be configured for authenticated E2E tests",
    );
  }
  return key;
}

function restHeaders(): Record<string, string> {
  const anonKey = getApiKey();
  const { accessToken } = getTestUserAuth();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

function restUrl(path: string): string {
  return `${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/${path}`;
}

/** Inserta una fila y devuelve su id. Sujeto a RLS del usuario de prueba. */
export async function restInsert(
  table: string,
  row: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(restUrl(table), {
    method: "POST",
    headers: { ...restHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    throw new Error(
      `Insert into ${table} failed: ${response.status} ${await response.text()}`,
    );
  }

  const [created] = (await response.json()) as { id: string }[];
  return created.id;
}

export async function restUpsert(
  table: string,
  row: Record<string, unknown>,
  onConflict: string,
): Promise<void> {
  const response = await fetch(
    `${restUrl(table)}?on_conflict=${encodeURIComponent(onConflict)}`,
    {
      method: "POST",
      headers: {
        ...restHeaders(),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Upsert into ${table} failed: ${response.status} ${await response.text()}`,
    );
  }
}

/**
 * Elimina todas las filas del usuario de prueba en una tabla (RLS acota al
 * propio owner). Útil para tablas de auditoría que no se limpian en cascada.
 */
export async function restDeleteOwnRows(table: string): Promise<void> {
  const { userId } = getTestUserAuth();
  const response = await fetch(`${restUrl(table)}?owner_id=eq.${userId}`, {
    method: "DELETE",
    headers: restHeaders(),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(
      `Delete from ${table} failed: ${response.status} ${await response.text()}`,
    );
  }
}

/** Actualiza columnas de una fila por id. Sujeto a RLS del usuario de prueba. */
export async function restUpdate(
  table: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${restUrl(table)}?id=eq.${id}`, {
    method: "PATCH",
    headers: restHeaders(),
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    throw new Error(
      `Update of ${table} failed: ${response.status} ${await response.text()}`,
    );
  }
}

/** Busca el id de una fila por igualdad de columna (para filas creadas vía UI). */
export async function restFindIdBy(
  table: string,
  column: string,
  value: string,
): Promise<string | null> {
  const url = `${restUrl(table)}?select=id&${column}=eq.${encodeURIComponent(value)}&limit=1`;
  const response = await fetch(url, { headers: restHeaders() });

  if (!response.ok) return null;
  const rows = (await response.json()) as { id: string }[];
  return rows[0]?.id ?? null;
}

/** Lee filas vía REST bajo la RLS del usuario de prueba. */
export async function restSelect<T>(path: string): Promise<T[]> {
  const response = await fetch(restUrl(path), { headers: restHeaders() });

  if (!response.ok) {
    throw new Error(
      `Select from ${path} failed: ${response.status} ${await response.text()}`,
    );
  }

  return (await response.json()) as T[];
}

/** Ejecuta un RPC vía REST bajo la RLS/Auth normal del usuario de prueba. */
export async function restRpc(
  functionName: string,
  body: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(
    `${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(
      `RPC ${functionName} failed: ${response.status} ${await response.text()}`,
    );
  }
}

/** Deleter para CleanupRegistry: borra por id, tolerando filas ya inexistentes. */
export async function restDelete(
  resource: CleanupResource,
): Promise<"deleted" | "missing"> {
  // Una Escritura finalizada no puede eliminarse (RLS lo bloquea a
  // propósito): reabrirla primero es seguro y silencioso — si la fila ya no
  // existe o no está finalizada, el PATCH simplemente no afecta filas.
  if (resource.table === "documents") {
    await restUpdate("documents", resource.id, { status: "draft" }).catch(
      () => undefined,
    );
  }

  const url = `${restUrl(resource.table)}?id=eq.${resource.id}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: { ...restHeaders(), Prefer: "return=representation" },
  });

  if (!response.ok) {
    throw new Error(
      `Delete from ${resource.table} failed: ${response.status} ${await response.text()}`,
    );
  }

  const rows = (await response.json()) as unknown[];
  return rows.length > 0 ? "deleted" : "missing";
}
