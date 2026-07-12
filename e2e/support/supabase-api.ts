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

/** Deleter para CleanupRegistry: borra por id, tolerando filas ya inexistentes. */
export async function restDelete(
  resource: CleanupResource,
): Promise<"deleted" | "missing"> {
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
