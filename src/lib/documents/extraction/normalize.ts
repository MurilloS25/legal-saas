/**
 * Normalización determinista del texto extraído: saltos de línea uniformes,
 * sin caracteres de control (salvo `\n` y `\t`), Unicode NFC, espacios
 * finales recortados y como máximo una línea en blanco consecutiva.
 *
 * No reescribe contenido: solo limpia artefactos de extracción para que el
 * texto que ve el proveedor de IA y el que usa LexCR para reconstruir el
 * Machote sean exactamente el mismo.
 */
export function normalizeExtractedText(raw: string): string {
  const unified = raw.replace(/\r\n?/g, "\n").normalize("NFC");

  let withoutControl = "";
  for (const char of unified) {
    const code = char.codePointAt(0) ?? 0;
    if (char === "\n" || char === "\t") {
      withoutControl += char;
      continue;
    }
    // C0, DEL, C1 y separadores de línea/párrafo Unicode.
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) continue;
    if (code === 0x2028 || code === 0x2029) {
      withoutControl += "\n";
      continue;
    }
    // Caracteres de ancho cero y BOM: invisibles, no aportan contenido.
    if (code === 0x200b || code === 0xfeff) continue;
    withoutControl += char;
  }

  return withoutControl
    .split("\n")
    .map((line) => line.replace(/[ \t ]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Cantidad de caracteres "visibles" (no espacios), para detectar vacío. */
export function visibleCharCount(text: string): number {
  return text.replace(/\s/g, "").length;
}
