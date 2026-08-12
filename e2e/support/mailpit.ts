/**
 * Cliente mínimo para el Mailpit local (buzón de pruebas usado por Supabase
 * Auth en desarrollo) — usado para extraer enlaces de recuperación de
 * contraseña enviados a un usuario de prueba durante los E2E.
 */

const MAILPIT_URL = process.env.MAILPIT_URL || "http://127.0.0.1:55324";

type MailpitMessageSummary = { ID: string; Created: string };
type MailpitMessage = { HTML: string; Text: string };

async function searchMessages(
  toEmail: string,
): Promise<MailpitMessageSummary[]> {
  const url = `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${toEmail}`)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Mailpit search failed: ${response.status}`);
  }
  const body = (await response.json()) as { messages: MailpitMessageSummary[] };
  return body.messages;
}

async function getMessage(id: string): Promise<MailpitMessage> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
  if (!response.ok) {
    throw new Error(`Mailpit message fetch failed: ${response.status}`);
  }
  return (await response.json()) as MailpitMessage;
}

/**
 * Espera el correo más reciente enviado a `toEmail` después de `sentAfter`
 * (para no recoger un correo previo de una ejecución anterior del test).
 */
export async function waitForLatestEmail(
  toEmail: string,
  sentAfter: Date,
  timeoutMs = 15_000,
): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const messages = await searchMessages(toEmail);
    const fresh = messages
      .filter((m) => new Date(m.Created).getTime() >= sentAfter.getTime())
      .sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime());

    if (fresh.length > 0) {
      return getMessage(fresh[0].ID);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`No email arrived for ${toEmail} within ${timeoutMs}ms`);
}

/** Extrae el primer enlace `href` del cuerpo HTML de un correo. */
export function extractFirstLink(html: string): string {
  const match = html.match(/href="([^"]+)"/);
  if (!match) {
    throw new Error("No link found in email HTML body");
  }
  return match[1].replace(/&amp;/g, "&");
}
