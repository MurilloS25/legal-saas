import { describe, expect, it } from "vitest";
import { generateDocumentDocx } from "./generate";
import { buildDocumentModel } from "@/lib/editor/render";
import { legacyTextToDocument } from "@/lib/editor/convert";
import { readDocx } from "../../../../test/support/docx";
import type { DocumentFormattingPreferences } from "./formatting";

// Verifica que `generateDocumentDocx` aplica de verdad las preferencias de
// formato al OOXML generado (no solo que las acepta como parámetro): página
// Legal siempre, y márgenes/fuente/tamaño/interlineado según lo configurado.

const model = buildDocumentModel(legacyTextToDocument("Texto de prueba."), {});

describe("formatting applied to the generated docx", () => {
  it("uses Legal paper size (8.5 x 14 in) by default, portrait", async () => {
    const buffer = await generateDocumentDocx(model);
    const parts = await readDocx(buffer);
    expect(parts.documentXml).toContain(
      '<w:pgSz w:w="12240" w:h="20160" w:orient="portrait"/>',
    );
  });

  it("applies the default formatting preferences (Times New Roman 12pt, 1.5 spacing, product default margins)", async () => {
    const buffer = await generateDocumentDocx(model);
    const parts = await readDocx(buffer);

    expect(parts.stylesXml).toContain('w:ascii="Times New Roman"');
    expect(parts.stylesXml).toContain('<w:sz w:val="24"/>'); // 12pt
    expect(parts.stylesXml).toContain('w:line="360" w:lineRule="auto"'); // 1.5

    // Márgenes default: 4.7/4.7 top-bottom, 3.2/3.2 left-right (en twips).
    expect(parts.documentXml).toContain(
      '<w:pgMar w:top="2664" w:right="1814" w:bottom="2664" w:left="1814"',
    );
  });

  it("applies a fully custom set of preferences end to end", async () => {
    const custom: DocumentFormattingPreferences = {
      fontFamily: "Arial",
      fontSizePt: 11,
      lineSpacing: 2,
      marginsCm: { top: 2, bottom: 2.5, left: 3, right: 3.5 },
    };
    const buffer = await generateDocumentDocx(model, custom);
    const parts = await readDocx(buffer);

    // Fuente y tamaño (11pt = 22 half-points).
    expect(parts.stylesXml).toContain('w:ascii="Arial"');
    expect(parts.stylesXml).toContain('<w:sz w:val="22"/>');
    // Interlineado doble.
    expect(parts.stylesXml).toContain('w:line="480" w:lineRule="auto"');
    // Márgenes distintos en cada lado — nunca top/bottom ni left/right
    // intercambiados.
    expect(parts.documentXml).toContain(
      '<w:pgMar w:top="1133" w:right="1984" w:bottom="1417" w:left="1700"',
    );
    // Papel Legal se mantiene sin importar la configuración del usuario.
    expect(parts.documentXml).toContain(
      '<w:pgSz w:w="12240" w:h="20160" w:orient="portrait"/>',
    );
  });

  it("keeps line spacing consistent across the whole document, not just the first paragraph", async () => {
    const multiParagraphModel = buildDocumentModel(
      legacyTextToDocument("Uno\nDos\nTres"),
      {},
    );
    const buffer = await generateDocumentDocx(multiParagraphModel, {
      fontFamily: "Calibri",
      fontSizePt: 12,
      lineSpacing: 1.5,
      marginsCm: { top: 1, bottom: 1, left: 1, right: 1 },
    });
    const parts = await readDocx(buffer);

    // El interlineado se declara una sola vez en el default del documento
    // (docDefaults), aplicado a todos los párrafos que no lo sobreescriben —
    // ningún párrafo del modelo define su propio spacing.
    expect(parts.stylesXml).toContain('w:line="360" w:lineRule="auto"');
    expect(parts.documentXml).not.toMatch(/<w:pPr>[\s\S]*?<w:spacing/);
  });
});
