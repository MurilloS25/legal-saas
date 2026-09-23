import { describe, expect, it } from "vitest";
import {
  buildDocx,
  buildPdf,
  docxDocumentXml,
} from "../../../../test/support/document-fixtures";
import { detectUploadedDocumentType } from "./detect";
import { documentXmlToText, extractDocxText } from "./docx";
import {
  DocumentExtractionError,
  extractPastedText,
  extractUploadedDocument,
  type ExtractionLimits,
} from "./index";
import { normalizeExtractedText } from "./normalize";
import { extractPdfText } from "./pdf";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const limits: ExtractionLimits = {
  maxFileBytes: 1_000_000,
  maxPages: 5,
  maxChars: 5_000,
  maxDocxXmlBytes: 200_000,
  maxZipEntries: 100,
  timeoutMs: 10_000,
};

async function expectCode(work: Promise<unknown> | (() => unknown), code: string) {
  try {
    await (typeof work === "function" ? work() : work);
  } catch (error) {
    expect(error).toBeInstanceOf(DocumentExtractionError);
    expect((error as DocumentExtractionError).code).toBe(code);
    return;
  }
  throw new Error(`expected extraction error ${code}`);
}

describe("normalizeExtractedText", () => {
  it("unifies line endings, strips control chars and collapses blank lines", () => {
    expect(normalizeExtractedText("Uno\r\nDos\u0007\n\n\n\nTres  \n")).toBe(
      "Uno\nDos\n\nTres",
    );
  });

  it("removes zero-width characters and BOM", () => {
    expect(normalizeExtractedText("﻿Ho​la")).toBe("Hola");
  });
});

describe("extractPastedText", () => {
  it("returns normalized text within limits", () => {
    const result = extractPastedText("  Comparece TEST PERSONA UNO.  ", limits);
    expect(result).toEqual({
      sourceType: "text",
      text: "Comparece TEST PERSONA UNO.",
      pageCount: null,
      charCount: 27,
    });
  });

  it("rejects empty text", async () => {
    await expectCode(() => extractPastedText(" \n\t ", limits), "empty_text");
  });

  it("rejects text over the character limit", async () => {
    await expectCode(
      () => extractPastedText("a".repeat(limits.maxChars + 1), limits),
      "text_too_long",
    );
  });
});

describe("detectUploadedDocumentType", () => {
  const pdfBytes = buildPdf(["Texto de prueba"]);

  it("accepts a PDF whose extension, MIME and signature match", () => {
    expect(
      detectUploadedDocumentType({
        fileName: "escritura.PDF",
        declaredMime: "application/pdf",
        bytes: pdfBytes,
      }),
    ).toBe("pdf");
  });

  it("rejects unsupported extensions such as .doc and images", async () => {
    for (const fileName of ["viejo.doc", "foto.png", "scan.jpg", "sin-extension"]) {
      await expectCode(
        () =>
          detectUploadedDocumentType({
            fileName,
            declaredMime: "application/pdf",
            bytes: pdfBytes,
          }),
        "unsupported_type",
      );
    }
  });

  it("rejects a Word 97-2003 binary renamed to .docx", async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]);
    await expectCode(
      () =>
        detectUploadedDocumentType({
          fileName: "renombrado.docx",
          declaredMime: DOCX_MIME,
          bytes: ole,
        }),
      "unsupported_type",
    );
  });

  it("rejects a declared MIME that contradicts the extension", async () => {
    await expectCode(
      () =>
        detectUploadedDocumentType({
          fileName: "documento.pdf",
          declaredMime: "image/png",
          bytes: pdfBytes,
        }),
      "mime_mismatch",
    );
  });

  it("rejects a file whose signature does not match its extension", async () => {
    await expectCode(
      () =>
        detectUploadedDocumentType({
          fileName: "falso.pdf",
          declaredMime: "application/pdf",
          bytes: new TextEncoder().encode("<html>no es un pdf</html>"),
        }),
      "mime_mismatch",
    );
  });

  it("uses only the last path segment of the file name", () => {
    expect(
      detectUploadedDocumentType({
        fileName: "../../etc/passwd/../escritura.pdf",
        declaredMime: "application/pdf",
        bytes: pdfBytes,
      }),
    ).toBe("pdf");
  });
});

describe("DOCX extraction", () => {
  it("extracts paragraphs, tabs and breaks as plain text", () => {
    const xml =
      '<w:document><w:body><w:p><w:r><w:t>Hola</w:t><w:tab/><w:t xml:space="preserve"> mundo &amp; más</w:t></w:r></w:p><w:p><w:r><w:t>Línea</w:t><w:br/><w:t>dos</w:t></w:r></w:p></w:body></w:document>';
    expect(documentXmlToText(xml)).toBe("Hola\t mundo & más\nLínea\ndos");
  });

  it("drops deleted tracked-change text", () => {
    const xml =
      "<w:body><w:p><w:r><w:t>Queda</w:t></w:r><w:del><w:r><w:t>BORRADO</w:t></w:r></w:del></w:p></w:body>";
    expect(documentXmlToText(xml)).toBe("Queda");
  });

  it("rejects XML with a DOCTYPE (no DTD/entity processing)", async () => {
    await expectCode(
      () =>
        documentXmlToText(
          '<!DOCTYPE x [<!ENTITY e SYSTEM "http://example.invalid/">]><w:p><w:t>&e;</w:t></w:p>',
        ),
      "corrupt_file",
    );
  });

  it("extracts text from a real DOCX container", async () => {
    const bytes = await buildDocx({
      paragraphs: ["Comparece TEST PERSONA UNO.", "Segundo párrafo."],
      pages: 1,
    });
    const result = await extractDocxText(bytes, limits);
    expect(result.text).toBe("Comparece TEST PERSONA UNO.\nSegundo párrafo.");
    expect(result.pageCount).toBe(1);
    expect(result.sourceType).toBe("docx");
  });

  it("rejects a DOCX declaring more pages than allowed", async () => {
    const bytes = await buildDocx({ paragraphs: ["Texto"], pages: 6 });
    await expectCode(extractDocxText(bytes, limits), "too_many_pages");
  });

  it("stops decompressing a document.xml larger than the cap (zip bomb)", async () => {
    // ~1 MB de XML altamente comprimible: el archivo es pequeño, el
    // contenido inflado supera el tope configurado.
    const bomb = docxDocumentXml(["A".repeat(1_000_000)]);
    const bytes = await buildDocx({ documentXml: bomb });
    expect(bytes.byteLength).toBeLessThan(50_000);
    await expectCode(extractDocxText(bytes, limits), "file_too_large");
  });

  it("rejects a ZIP with too many entries", async () => {
    const extraEntries = Object.fromEntries(
      Array.from({ length: 150 }, (_, i) => [`x/${i}.txt`, "x"]),
    );
    const bytes = await buildDocx({ paragraphs: ["Texto"], extraEntries });
    await expectCode(extractDocxText(bytes, limits), "corrupt_file");
  });

  it("rejects a ZIP that is not a Word document", async () => {
    const bytes = await buildDocx({
      paragraphs: ["Texto"],
      contentTypes: "<Types><Override ContentType=\"application/xml\"/></Types>",
    });
    await expectCode(extractDocxText(bytes, limits), "mime_mismatch");
  });

  it("rejects corrupt bytes", async () => {
    await expectCode(
      extractDocxText(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), limits),
      "corrupt_file",
    );
  });

  it("rejects a DOCX without text", async () => {
    const bytes = await buildDocx({ paragraphs: ["", "   "] });
    await expectCode(extractDocxText(bytes, limits), "empty_text");
  });

  it("rejects a DOCX whose text exceeds the character limit", async () => {
    const bytes = await buildDocx({ paragraphs: ["b".repeat(limits.maxChars + 10)] });
    await expectCode(extractDocxText(bytes, limits), "text_too_long");
  });
});

describe("PDF extraction", () => {
  it("extracts text from a PDF with a text layer", async () => {
    const bytes = buildPdf([
      "Comparece TEST PERSONA UNO, mayor, casado, abogado, vecino de Prueba.",
    ]);
    const result = await extractPdfText(bytes, limits);
    expect(result.text).toContain("Comparece TEST PERSONA UNO");
    expect(result.pageCount).toBe(1);
    expect(result.sourceType).toBe("pdf");
  });

  it("rejects a scanned PDF without a text layer (no OCR)", async () => {
    await expectCode(extractPdfText(buildPdf([null, null]), limits), "no_text_layer");
  });

  it("rejects a PDF with more pages than allowed before extracting text", async () => {
    const pages = Array.from({ length: 6 }, (_, i) => `Pagina de prueba numero ${i + 1} con texto suficiente.`);
    await expectCode(extractPdfText(buildPdf(pages), limits), "too_many_pages");
  });

  it("rejects corrupt PDF bytes", async () => {
    await expectCode(
      extractPdfText(new TextEncoder().encode("%PDF-1.4\ngarbage"), limits),
      "corrupt_file",
    );
  });
});

describe("extractUploadedDocument", () => {
  it("rejects files over the byte limit before parsing", async () => {
    const bytes = new Uint8Array(limits.maxFileBytes + 1);
    await expectCode(
      extractUploadedDocument(
        { fileName: "grande.pdf", declaredMime: "application/pdf", bytes },
        limits,
      ),
      "file_too_large",
    );
  });

  it("dispatches DOCX uploads to the DOCX extractor", async () => {
    const bytes = await buildDocx({ paragraphs: ["Texto de prueba DOCX."] });
    const result = await extractUploadedDocument(
      { fileName: "prueba.docx", declaredMime: DOCX_MIME, bytes },
      limits,
    );
    expect(result.text).toBe("Texto de prueba DOCX.");
  });
});
