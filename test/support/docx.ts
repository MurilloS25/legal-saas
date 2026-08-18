/**
 * Helpers de prueba para inspeccionar un `.docx` generado sin depender de
 * Microsoft Word. Un `.docx` es un ZIP OOXML; aquí se abre en memoria y se
 * exponen sus partes principales para hacer aserciones puntuales.
 */

import JSZip from "jszip";

export type DocxParts = {
  zip: JSZip;
  /** `word/document.xml` como texto. */
  documentXml: string;
  /** `word/styles.xml` como texto (fuente/tamaño/interlineado por defecto). */
  stylesXml: string;
  contentTypesXml: string;
  relsXml: string;
  /** Nombres de todas las entradas del ZIP. */
  entryNames: string[];
};

export async function readDocx(buffer: Buffer | Uint8Array): Promise<DocxParts> {
  const zip = await JSZip.loadAsync(buffer);
  const entryNames = Object.keys(zip.files);

  const read = async (path: string): Promise<string> => {
    const file = zip.file(path);
    return file ? file.async("string") : "";
  };

  return {
    zip,
    documentXml: await read("word/document.xml"),
    stylesXml: await read("word/styles.xml"),
    contentTypesXml: await read("[Content_Types].xml"),
    relsXml: await read("_rels/.rels"),
    entryNames,
  };
}

/**
 * Concatena el texto de todos los nodos `<w:t>` de document.xml, respetando
 * el orden. Útil para verificar el contenido sin acoplarse al XML completo.
 */
export function extractDocxText(documentXml: string): string {
  const matches = [
    ...documentXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),
  ];
  return matches
    .map((match) =>
      match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'"),
    )
    .join("");
}

/**
 * Número de párrafos (`<w:p>`) en document.xml. `\b` capta también los
 * párrafos vacíos auto-cerrados (`<w:p/>`) y excluye `<w:pPr>`.
 */
export function countParagraphs(documentXml: string): number {
  return (documentXml.match(/<w:p\b/g) ?? []).length;
}

/** Número de saltos de línea (`<w:br/>`) en document.xml. */
export function countLineBreaks(documentXml: string): number {
  return (documentXml.match(/<w:br\b/g) ?? []).length;
}

/** Número de filas de tabla (`<w:tr`) en document.xml, incluye el encabezado. */
export function countTableRows(documentXml: string): number {
  return (documentXml.match(/<w:tr\b/g) ?? []).length;
}
