/**
 * Verificación de mismo origen para Route Handlers que mutan estado (las
 * Server Actions ya la hacen dentro de Next.js; un Route Handler no).
 * Complementa las cookies de sesión `SameSite`: una petición POST
 * cross-site sin cabecera `Origin` válida se rechaza.
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return false;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}
