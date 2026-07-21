import { describe, expect, it } from "vitest";
import { generateDocumentDocx, DocxGenerationError } from "./generate";
import { DOCX_LIMITS } from "./limits";
import { buildDocumentModel } from "@/lib/editor/render";
import { legacyTextToDocument } from "@/lib/editor/convert";
import type {
  DocumentModel,
  DocumentParagraph,
  DocumentRun,
} from "@/lib/editor/render";
import {
  countLineBreaks,
  countParagraphs,
  extractDocxText,
  readDocx,
} from "../../../../test/support/docx";

const NO_MARKS = { bold: false, italic: false, underline: false };

function paragraph(runs: DocumentRun[]): DocumentParagraph {
  return { kind: "paragraph", runs };
}

function text(value: string, marks: Partial<typeof NO_MARKS> = {}): DocumentRun {
  return { kind: "text", text: value, marks: { ...NO_MARKS, ...marks } };
}

async function generateAndRead(model: DocumentModel) {
  const buffer = await generateDocumentDocx(model);
  return { buffer, parts: await readDocx(buffer) };
}

describe("generateDocumentDocx", () => {
  it("produces a structurally valid docx (ZIP with OOXML parts)", async () => {
    const { buffer, parts } = await generateAndRead([
      paragraph([text("Hola mundo")]),
    ]);

    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(parts.entryNames).toContain("[Content_Types].xml");
    expect(parts.entryNames).toContain("_rels/.rels");
    expect(parts.entryNames).toContain("word/document.xml");
  });

  it("handles an empty document without crashing", async () => {
    const { parts } = await generateAndRead([]);
    expect(parts.documentXml).toContain("<w:body>");
  });

  it("renders a single paragraph of text", async () => {
    const { parts } = await generateAndRead([paragraph([text("Un párrafo.")])]);
    expect(extractDocxText(parts.documentXml)).toBe("Un párrafo.");
  });

  it("keeps separate paragraphs and preserves empty lines", async () => {
    const { parts } = await generateAndRead([
      paragraph([text("Primero")]),
      paragraph([]),
      paragraph([text("Tercero")]),
    ]);
    // 3 párrafos del modelo (el vacío conserva la línea en blanco).
    expect(countParagraphs(parts.documentXml)).toBe(3);
    expect(extractDocxText(parts.documentXml)).toBe("PrimeroTercero");
  });

  it("renders a hardBreak as a line break inside one paragraph", async () => {
    const { parts } = await generateAndRead([
      paragraph([text("línea 1"), { kind: "break" }, text("línea 2")]),
    ]);
    expect(countParagraphs(parts.documentXml)).toBe(1);
    expect(countLineBreaks(parts.documentXml)).toBe(1);
  });

  it("does not merge all paragraphs and does not duplicate breaks", async () => {
    const model = buildDocumentModel(
      legacyTextToDocument("uno\ndos\n\ncuatro"),
      {},
    );
    const { parts } = await generateAndRead(model);
    expect(countParagraphs(parts.documentXml)).toBe(4);
    expect(countLineBreaks(parts.documentXml)).toBe(0);
  });

  it("applies bold, italic and underline", async () => {
    const { parts } = await generateAndRead([
      paragraph([
        text("negrita", { bold: true }),
        text("cursiva", { italic: true }),
        text("subrayado", { underline: true }),
        text("combinado", { bold: true, italic: true, underline: true }),
      ]),
    ]);
    expect(parts.documentXml).toContain("<w:b/>");
    expect(parts.documentXml).toContain("<w:i/>");
    expect(parts.documentXml).toMatch(/<w:u\b/);
  });

  it("substitutes resolved variables and keeps pending ones as {{key}}", async () => {
    const model = buildDocumentModel(
      legacyTextToDocument("Comparece {{comprador.nombre}}, cédula {{comprador.cedula}}."),
      { "comprador.nombre": "Cliente Uno" },
    );
    const { parts } = await generateAndRead(model);
    const body = extractDocxText(parts.documentXml);
    expect(body).toContain("Cliente Uno");
    expect(body).toContain("{{comprador.cedula}}");
  });

  it("substitutes every occurrence of a repeated variable", async () => {
    const model = buildDocumentModel(legacyTextToDocument("{{x}} y {{x}}"), {
      x: "V",
    });
    const { parts } = await generateAndRead(model);
    expect(extractDocxText(parts.documentXml)).toBe("V y V");
  });

  it("preserves Unicode, accents, legal symbols and leading zeros", async () => {
    const model = buildDocumentModel(
      legacyTextToDocument("Monto: {{monto}} — Nº {{folio}} §1 «acta»"),
      { monto: "₡1.000.000", folio: "0012" },
    );
    const { parts } = await generateAndRead(model);
    const body = extractDocxText(parts.documentXml);
    expect(body).toContain("₡1.000.000");
    expect(body).toContain("0012");
    expect(body).toContain("Nº");
    expect(body).toContain("§1");
    expect(body).toContain("«acta»");
  });

  it("flattens an optionBlock run into the docx as plain text runs", async () => {
    const block: DocumentRun = {
      kind: "optionBlock",
      blockId: "b1",
      name: "Chasis, VIN y Serie",
      selectedVariantId: "distintos",
      variants: [
        { id: "iguales", label: "Todos iguales" },
        { id: "distintos", label: "Todos distintos" },
      ],
      runs: [
        text("CHASIS "),
        { kind: "variable", key: "vehiculo.chasis", resolved: true, value: "ABC123" },
      ],
    };
    const { parts } = await generateAndRead([
      paragraph([text("Comparecen con "), block, text(".")]),
    ]);
    expect(extractDocxText(parts.documentXml)).toBe(
      "Comparecen con CHASIS ABC123.",
    );
  });

  it("throws a typed error when the paragraph limit is exceeded", async () => {
    const tooMany: DocumentModel = Array.from(
      { length: DOCX_LIMITS.maxParagraphs + 1 },
      () => paragraph([text("x")]),
    );
    await expect(generateDocumentDocx(tooMany)).rejects.toBeInstanceOf(
      DocxGenerationError,
    );
    await expect(generateDocumentDocx(tooMany)).rejects.toMatchObject({
      code: "too_many_paragraphs",
    });
  });

  it("throws a typed error when the total text limit is exceeded", async () => {
    const huge = "a".repeat(DOCX_LIMITS.maxTotalTextLength + 1);
    await expect(
      generateDocumentDocx([paragraph([text(huge)])]),
    ).rejects.toMatchObject({ code: "text_too_long" });
  });
});
