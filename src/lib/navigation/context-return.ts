/**
 * Validación de `returnTo`: el enlace opcional para volver a la Escritura
 * de origen tras crear o abrir una Cuenta por cobrar.
 *
 * `returnTo` nunca dispara un redirect automático — solo alimenta un enlace
 * explícito que el usuario pulsa por su cuenta (`ContextBackLink`). El
 * allowlist es intencionalmente angosto: una sola forma de ruta interna
 * permitida por ahora. Ampliar a otros módulos requiere extender este
 * archivo, no relajar la validación existente.
 *
 * El valor viaja como texto plano en query params y en un input oculto de
 * formulario; en ambos casos llega ya decodificado (Next.js decodifica los
 * `searchParams`, y `FormData` no codifica valores de inputs), así que este
 * módulo no vuelve a decodificar — solo valida el patrón exacto.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DOCUMENT_RECEIVABLES_RETURN_PATTERN =
  /^\/dashboard\/documents\/([^/?]+)\?section=receivables$/;

/**
 * Construye el `returnTo` hacia la pestaña "Cuentas por cobrar" de una
 * Escritura. Único punto que genera el valor, para que siempre calce con
 * lo que `parseDocumentReceivablesReturnTo` acepta.
 */
export function buildDocumentReceivablesReturnTo(documentId: string): string {
  return `/dashboard/documents/${documentId}?section=receivables`;
}

/**
 * Valida un valor de `returnTo` recibido de un query param o de un campo
 * oculto de formulario. Devuelve la ruta interna si calza exactamente con
 * la única forma permitida, o `null` en cualquier otro caso: dominios
 * externos, protocolos (`javascript:`), rutas fuera de `/dashboard`, IDs
 * malformados, o cualquier variación del patrón.
 *
 * Esta validación es de formato únicamente — no confirma que la Escritura
 * exista ni le pertenezca al usuario. Esa comprobación la sigue haciendo,
 * sin cambios, la propia página de destino al cargar.
 */
export function parseDocumentReceivablesReturnTo(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;

  const match = DOCUMENT_RECEIVABLES_RETURN_PATTERN.exec(raw);
  if (!match) return null;

  const documentId = match[1];
  if (!UUID_PATTERN.test(documentId)) return null;

  return buildDocumentReceivablesReturnTo(documentId);
}

/**
 * Agrega `returnTo` (codificado) a un href existente, solo cuando hay un
 * valor válido. Centraliza el `encodeURIComponent` para que ningún punto de
 * entrada lo olvide y rompa el valor al insertarlo en una query string.
 */
export function appendReturnTo(href: string, returnTo: string | null): string {
  if (!returnTo) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}
