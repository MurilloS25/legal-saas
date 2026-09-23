/**
 * Extracción de texto plano de un `.docx` (Office Open XML).
 *
 * Defensas:
 * - límite de entradas del ZIP antes de leer nada (el índice central se lee
 *   sin descomprimir);
 * - `word/document.xml` se descomprime en streaming con un tope de bytes:
 *   una zip bomb se corta en cuanto supera el tope, nunca se infla entera;
 * - no se interpreta DTD ni entidades externas (un `<!DOCTYPE` rechaza el
 *   archivo) y solo se decodifican las entidades XML estándar, así que no
 *   hay XXE ni SSRF posibles;
 * - no se escribe nada en disco.
 *
 * No se usa un parser XML completo: basta con recorrer párrafos (`w:p`),
 * runs de texto (`w:t`), tabulaciones y saltos. El texto borrado en control
 * de cambios (`w:del`) se descarta.
 */

import JSZip from "jszip";
import { normalizeExtractedText, visibleCharCount } from "./normalize";
import {
  DocumentExtractionError,
  type ExtractedDocument,
  type ExtractionLimits,
} from "./types";

const APP_XML_MAX_BYTES = 64 * 1024;
const CONTENT_TYPES_MAX_BYTES = 64 * 1024;
const WORD_MAIN_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";

/** `internalStream` es API pública de JSZip, pero falta en sus tipos. */
type ZipStream = {
  on(event: "data", handler: (chunk: Uint8Array) => void): ZipStream;
  on(event: "error", handler: (error: unknown) => void): ZipStream;
  on(event: "end", handler: () => void): ZipStream;
  pause(): ZipStream;
  resume(): ZipStream;
};
type ZipEntryWithStream = { internalStream(type: "uint8array"): ZipStream };

function readEntryCapped(
  file: JSZip.JSZipObject,
  maxBytes: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    let settled = false;
    const stream = (file as unknown as ZipEntryWithStream).internalStream("uint8array");
    stream
      .on("data", (chunk: Uint8Array) => {
        if (settled) return;
        total += chunk.length;
        if (total > maxBytes) {
          settled = true;
          stream.pause();
          reject(new DocumentExtractionError("file_too_large"));
          return;
        }
        chunks.push(chunk);
      })
      .on("error", () => {
        if (settled) return;
        settled = true;
        reject(new DocumentExtractionError("corrupt_file"));
      })
      .on("end", () => {
        if (settled) return;
        settled = true;
        const out = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          out.set(chunk, offset);
          offset += chunk.length;
        }
        resolve(out);
      })
      .resume();
  });
}

const decoder = new TextDecoder("utf-8", { fatal: false });

function decodeXmlEntities(value: string): string {
  return value.replace(
    /&(lt|gt|amp|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6});/g,
    (_match, entity: string) => {
      switch (entity) {
        case "lt":
          return "<";
        case "gt":
          return ">";
        case "amp":
          return "&";
        case "quot":
          return '"';
        case "apos":
          return "'";
        default: {
          const codePoint = entity.startsWith("#x")
            ? Number.parseInt(entity.slice(2), 16)
            : Number.parseInt(entity.slice(1), 10);
          return Number.isInteger(codePoint) &&
            codePoint > 0 &&
            codePoint <= 0x10ffff
            ? String.fromCodePoint(codePoint)
            : "";
        }
      }
    },
  );
}

/**
 * Convierte el XML de `word/document.xml` en texto: un párrafo `w:p` por
 * línea, `w:tab` como tabulación y `w:br`/`w:cr` como salto de línea.
 * Exportada solo para pruebas.
 */
export function documentXmlToText(xml: string): string {
  if (/<!DOCTYPE/i.test(xml)) {
    throw new DocumentExtractionError("corrupt_file");
  }
  const withoutDeleted = xml.replace(/<w:del\b[\s\S]*?<\/w:del>/g, "");
  const paragraphs: string[] = [];
  const paragraphPattern = /<w:p\b[^>]*?(?:\/>|>([\s\S]*?)<\/w:p>)/g;
  const tokenPattern =
    /<w:t\b[^>]*?(?:\/>|>([\s\S]*?)<\/w:t>)|<w:tab\b[^>]*?\/>|<w:(?:br|cr)\b[^>]*?\/>/g;

  for (const paragraph of withoutDeleted.matchAll(paragraphPattern)) {
    const body = paragraph[1] ?? "";
    let line = "";
    for (const token of body.matchAll(tokenPattern)) {
      const raw = token[0];
      if (raw.startsWith("<w:tab")) line += "\t";
      else if (raw.startsWith("<w:br") || raw.startsWith("<w:cr")) line += "\n";
      else line += decodeXmlEntities(token[1] ?? "");
    }
    paragraphs.push(line);
  }
  return paragraphs.join("\n");
}

function readDeclaredPages(appXml: string): number | null {
  const match = /<Pages>\s*(\d{1,6})\s*<\/Pages>/.exec(appXml);
  return match ? Number(match[1]) : null;
}

export async function extractDocxText(
  bytes: Uint8Array,
  limits: ExtractionLimits,
): Promise<ExtractedDocument> {
  if (bytes.byteLength > limits.maxFileBytes) {
    throw new DocumentExtractionError("file_too_large");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes, { createFolders: false });
  } catch {
    throw new DocumentExtractionError("corrupt_file");
  }

  const entries = Object.keys(zip.files);
  if (entries.length > limits.maxZipEntries) {
    throw new DocumentExtractionError("corrupt_file");
  }

  const contentTypes = zip.file("[Content_Types].xml");
  const documentXml = zip.file("word/document.xml");
  if (!contentTypes || !documentXml) {
    throw new DocumentExtractionError("mime_mismatch");
  }
  const contentTypesXml = decoder.decode(
    await readEntryCapped(contentTypes, CONTENT_TYPES_MAX_BYTES),
  );
  if (!contentTypesXml.includes(WORD_MAIN_CONTENT_TYPE)) {
    // Un ZIP con otra estructura (xlsx, pptx, docm con macros, etc.).
    throw new DocumentExtractionError("mime_mismatch");
  }

  let pageCount: number | null = null;
  const appXml = zip.file("docProps/app.xml");
  if (appXml) {
    pageCount = readDeclaredPages(
      decoder.decode(await readEntryCapped(appXml, APP_XML_MAX_BYTES)),
    );
    if (pageCount !== null && pageCount > limits.maxPages) {
      throw new DocumentExtractionError("too_many_pages");
    }
  }

  const xml = decoder.decode(
    await readEntryCapped(documentXml, limits.maxDocxXmlBytes),
  );
  const text = normalizeExtractedText(documentXmlToText(xml));

  if (visibleCharCount(text) === 0) {
    throw new DocumentExtractionError("empty_text");
  }
  if (text.length > limits.maxChars) {
    throw new DocumentExtractionError("text_too_long");
  }

  return { sourceType: "docx", text, pageCount, charCount: text.length };
}
