import { describe, expect, it } from "vitest";
import { generateDocumentDocx } from "./generate";
import { buildDocumentModel } from "@/lib/editor/render";
import { legacyTextToDocument } from "@/lib/editor/convert";
import { readDocx } from "../../../../test/support/docx";

// Endurecimiento: verifica que el .docx generado tiene la estructura OOXML
// mínima válida, sin depender de Microsoft Word.

describe("docx OOXML structure", () => {
  it("contains the required OPC parts", async () => {
    const buffer = await generateDocumentDocx(
      buildDocumentModel(legacyTextToDocument("Texto de prueba."), {}),
    );
    const parts = await readDocx(buffer);

    expect(parts.entryNames).toContain("[Content_Types].xml");
    expect(parts.entryNames).toContain("_rels/.rels");
    expect(parts.entryNames).toContain("word/document.xml");
  });

  it("declares the wordprocessing document content type", async () => {
    const buffer = await generateDocumentDocx([
      { kind: "paragraph", runs: [] },
    ]);
    const parts = await readDocx(buffer);
    expect(parts.contentTypesXml).toContain("wordprocessingml.document.main");
  });

  it("wires the main document relationship in _rels/.rels", async () => {
    const buffer = await generateDocumentDocx([
      { kind: "paragraph", runs: [] },
    ]);
    const parts = await readDocx(buffer);
    expect(parts.relsXml).toContain("officeDocument");
    expect(parts.relsXml).toContain("word/document.xml");
  });

  it("wraps content in a well-formed <w:body>", async () => {
    const buffer = await generateDocumentDocx(
      buildDocumentModel(legacyTextToDocument("Uno\nDos"), {}),
    );
    const parts = await readDocx(buffer);
    expect(parts.documentXml).toContain("<w:body>");
    expect(parts.documentXml).toContain("</w:body>");
    expect(parts.documentXml).toContain("<w:sectPr");
  });

  it("preserves Unicode text through the OOXML encoding", async () => {
    const buffer = await generateDocumentDocx(
      buildDocumentModel(
        legacyTextToDocument("Piñón §3 «cláusula» ₡100 — Nº1"),
        {},
      ),
    );
    const parts = await readDocx(buffer);
    // El texto se almacena UTF-8; al leerlo debe reaparecer intacto.
    expect(parts.documentXml).toContain("Piñón");
    expect(parts.documentXml).toContain("«cláusula»");
    expect(parts.documentXml).toContain("₡100");
  });

  it("escapes XML metacharacters instead of breaking the document", async () => {
    const buffer = await generateDocumentDocx([
      {
        kind: "paragraph",
        runs: [
          {
            kind: "text",
            text: "a < b & c > d",
            marks: { bold: false, italic: false, underline: false },
          },
        ],
      },
    ]);
    const parts = await readDocx(buffer);
    // Los metacaracteres van escapados en el XML.
    expect(parts.documentXml).toContain("&lt;");
    expect(parts.documentXml).toContain("&amp;");
    expect(parts.documentXml).toContain("&gt;");
  });
});
