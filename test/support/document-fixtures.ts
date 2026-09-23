/**
 * Generadores de archivos sintéticos para pruebas de extracción. Todo el
 * contenido es ficticio. Nada se escribe en disco: los bytes se generan en
 * memoria en cada prueba.
 */

import JSZip from "jszip";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function docxDocumentXml(paragraphs: string[]): string {
  const body = paragraphs
    .map(
      (text) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
}

export async function buildDocx(options: {
  paragraphs?: string[];
  documentXml?: string;
  pages?: number;
  contentTypes?: string;
  extraEntries?: Record<string, string>;
}): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", options.contentTypes ?? CONTENT_TYPES);
  zip.file(
    "word/document.xml",
    options.documentXml ?? docxDocumentXml(options.paragraphs ?? []),
  );
  if (options.pages !== undefined) {
    zip.file(
      "docProps/app.xml",
      `<?xml version="1.0"?><Properties><Pages>${options.pages}</Pages></Properties>`,
    );
  }
  for (const [name, content] of Object.entries(options.extraEntries ?? {})) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/**
 * PDF mínimo válido (con tabla xref correcta). Cada elemento de `pages` es
 * el texto de una página; `null` genera una página sin capa de texto (solo
 * un rectángulo dibujado, como un escaneo).
 */
export function buildPdf(pages: Array<string | null>): Uint8Array {
  const objects: string[] = [];
  const pageRefs: number[] = [];
  // 1: catalog, 2: pages, 3: font; luego pares (page, content) por página.
  const fontId = 3;
  let nextId = 4;
  const pageObjects: Array<{ id: number; body: string }> = [];
  for (const text of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageRefs.push(pageId);
    const stream =
      text === null
        ? "0 0 1 rg 50 50 200 200 re f"
        : `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, (c) => `\\${c}`)}) Tj ET`;
    pageObjects.push({
      id: pageId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    });
    pageObjects.push({
      id: contentId,
      body: `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    });
  }

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageRefs.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  for (const { id, body } of pageObjects) objects[id] = body;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
