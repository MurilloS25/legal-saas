/**
 * Construcción de un nombre de archivo `.docx` seguro a partir del título
 * persistido de la escritura.
 *
 * Función pura: no toca disco ni red. Se deriva del título guardado en
 * servidor (nunca de un query string) y neutraliza todo lo que podría
 * causar path traversal, inyección en headers o nombres inválidos en
 * Windows/macOS. Las tildes se conservan porque son seguras en un filename.
 */

const FALLBACK_BASENAME = "Escritura";
const MAX_BASENAME_LENGTH = 120;

// Nombres de dispositivo reservados en Windows (con o sin extensión).
const RESERVED_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

// Caracteres de control Unicode (C0, DEL, C1): evitan CRLF y bytes de control
// que podrían inyectarse en headers.
const CONTROL_CHARS = /\p{Cc}/gu;
// Inválidos en nombres de archivo en Windows, incluidos los separadores de
// ruta `/` y `\`.
const INVALID_CHARS = /[<>:"/\\|?*]/g;

function sanitizeBasename(rawTitle: string): string {
  let name = rawTitle
    .normalize("NFC")
    .replace(CONTROL_CHARS, " ")
    .replace(INVALID_CHARS, " ")
    // `..` no puede sobrevivir como componente de ruta.
    .replace(/\.\.+/g, " ")
    // Colapsa espacios en blanco.
    .replace(/\s+/g, " ")
    .trim()
    // Windows recorta puntos y espacios finales.
    .replace(/[. ]+$/g, "")
    .trim();

  // Nombre reservado (ignorando una posible extensión) → fallback.
  const withoutExtension = name.split(".")[0]?.toLowerCase() ?? "";
  if (RESERVED_NAMES.has(withoutExtension)) {
    name = "";
  }

  if (name.length > MAX_BASENAME_LENGTH) {
    name = name.slice(0, MAX_BASENAME_LENGTH).trim().replace(/[. ]+$/g, "");
  }

  return name || FALLBACK_BASENAME;
}

/**
 * Devuelve un nombre de archivo que termina exactamente en `.docx` y es
 * seguro para descargar. `title` es el título persistido de la escritura.
 */
export function buildDocxFilename(title: string): string {
  return `${sanitizeBasename(title)}.docx`;
}
