/**
 * Utilidades HTTP puras para la respuesta de descarga del `.docx`.
 * Aisladas para poder probar la construcción de headers sin arrancar el
 * servidor (inyección CRLF, comillas, caracteres no ASCII en el filename).
 */

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Construye un header `Content-Disposition: attachment` seguro:
 *
 * - `filename=` con un fallback solo ASCII imprimible (sin comillas ni
 *   barras, sin CR/LF que permitirían inyectar headers);
 * - `filename*=UTF-8''…` (RFC 5987) percent-encoded para conservar tildes.
 *
 * `filename` ya debería venir saneado por `buildDocxFilename`; esto es una
 * segunda barrera defensiva.
 */
export function contentDispositionAttachment(filename: string): string {
  const asciiFallback =
    filename
      // Solo ASCII imprimible (0x20–0x7E); descarta controles y no ASCII.
      .replace(/[^ -~]/g, "_")
      // Comillas y barras romperían el token entrecomillado.
      .replace(/["\\]/g, "_")
      .trim() || "Escritura.docx";

  // encodeURIComponent deja `'()*` sin codificar, pero no son attr-char
  // válidos en el ext-value de RFC 5987; se codifican explícitamente.
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
