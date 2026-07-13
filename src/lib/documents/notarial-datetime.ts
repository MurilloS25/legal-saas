/**
 * Manejo de fecha/hora del índice notarial anclado a Costa Rica.
 *
 * Costa Rica es UTC-6 fijo (sin horario de verano), así que el valor de un
 * `<input type="datetime-local">` (reloj de pared, sin zona) se interpreta
 * SIEMPRE como hora de Costa Rica, independientemente de la zona del
 * navegador. Así el instante guardado es estable y se muestra de forma
 * consistente en `America/Costa_Rica`.
 */

const CR_OFFSET = "-06:00";
const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/**
 * Convierte un valor de datetime-local (hora de CR) a un ISO UTC. Devuelve
 * null si el valor está vacío o no tiene el formato esperado.
 */
export function costaRicaLocalToIso(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!DATETIME_LOCAL_RE.test(trimmed)) return null;

  const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  const date = new Date(`${withSeconds}${CR_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Convierte un ISO persistido al valor `YYYY-MM-DDTHH:mm` en hora de Costa
 * Rica, para precargar el input datetime-local.
 */
export function isoToCostaRicaLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Inicio del día (00:00 CR) de una fecha YYYY-MM-DD como ISO UTC, o null. */
export function costaRicaDayStartIso(date: string): string | null {
  const trimmed = date.trim();
  if (!DATE_RE.test(trimmed)) return null;
  const d = new Date(`${trimmed}T00:00:00${CR_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Fin del día (23:59:59.999 CR) de una fecha YYYY-MM-DD como ISO UTC, o null. */
export function costaRicaDayEndIso(date: string): string | null {
  const trimmed = date.trim();
  if (!DATE_RE.test(trimmed)) return null;
  const d = new Date(`${trimmed}T23:59:59.999${CR_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Fecha legible (solo día) en America/Costa_Rica. */
export function formatCostaRicaDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Hora legible (HH:mm) en America/Costa_Rica. */
export function formatCostaRicaTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
