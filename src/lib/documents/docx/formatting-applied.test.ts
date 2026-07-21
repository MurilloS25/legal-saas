import { describe, expect, it } from "vitest";
import { generateDocumentDocx } from "./generate";
import { buildDocumentModel } from "@/lib/editor/render";
import { legacyTextToDocument } from "@/lib/editor/convert";
import { readDocx } from "../../../../test/support/docx";
import type { DocumentFormattingPreferences } from "./formatting";

// Verifica que `generateDocumentDocx` aplica de verdad las preferencias de
// formato al OOXML generado (no solo que las acepta como parámetro): página
// Legal siempre, márgenes/fuente/tamaño según lo configurado, y el cuerpo
// documental siempre justificado con interlineado fijo de 24pt exacto —
// independiente de la preferencia de interlineado guardada.

const model = buildDocumentModel(legacyTextToDocument("Texto de prueba."), {});

describe("formatting applied to the generated docx", () => {
  it("uses Legal paper size (8.5 x 14 in) by default, portrait", async () => {
    const buffer = await generateDocumentDocx(model);
    const parts = await readDocx(buffer);
    expect(parts.documentXml).toContain(
      '<w:pgSz w:w="12240" w:h="20160" w:orient="portrait"/>',
    );
  });

  it("applies the default formatting preferences (Times New Roman 12pt, product default margins), justified with 24pt exact spacing", async () => {
    const buffer = await generateDocumentDocx(model);
    const parts = await readDocx(buffer);

    expect(parts.stylesXml).toContain('w:ascii="Times New Roman"');
    expect(parts.stylesXml).toContain('<w:sz w:val="24"/>'); // 12pt
    expect(parts.stylesXml).toContain('w:line="480" w:lineRule="exactly"'); // 24pt exact
    expect(parts.stylesXml).toContain('<w:jc w:val="both"/>'); // justified

    // Márgenes default: 4.7/4.7 top-bottom, 3.2/3.2 left-right (en twips).
    expect(parts.documentXml).toContain(
      '<w:pgMar w:top="2664" w:right="1814" w:bottom="2664" w:left="1814"',
    );
  });

  it("applies a fully custom set of margins/font/size end to end, but line spacing and alignment stay fixed regardless of the preference", async () => {
    const custom: DocumentFormattingPreferences = {
      fontFamily: "Arial",
      fontSizePt: 11,
      lineSpacing: 2, // debe ignorarse: el interlineado del DOCX es siempre 24pt exacto.
      marginsCm: { top: 2, bottom: 2.5, left: 3, right: 3.5 },
    };
    const buffer = await generateDocumentDocx(model, custom);
    const parts = await readDocx(buffer);

    // Fuente y tamaño (11pt = 22 half-points).
    expect(parts.stylesXml).toContain('w:ascii="Arial"');
    expect(parts.stylesXml).toContain('<w:sz w:val="22"/>');
    // Interlineado siempre 24pt exacto, sin importar `lineSpacing: 2`. (No
    // se afirma "sin auto en todo el documento": los estilos de nota al pie
    // que aporta la propia librería `docx` usan "auto" independientemente
    // de nuestros docDefaults — lo relevante es que el default del cuerpo
    // documental sea "exactly".)
    expect(parts.stylesXml).toContain(
      '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="480" w:lineRule="exactly"/><w:jc w:val="both"/></w:pPr></w:pPrDefault>',
    );
    // Siempre justificado.
    expect(parts.stylesXml).toContain('<w:jc w:val="both"/>');
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

  it("keeps justification and exact line spacing consistent across the whole document, not just the first paragraph", async () => {
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

    // El interlineado y la alineación se declaran una sola vez en el
    // default del documento (docDefaults), aplicado a todos los párrafos
    // que no lo sobreescriben — ningún párrafo del modelo define los suyos.
    expect(parts.stylesXml).toContain('w:line="480" w:lineRule="exactly"');
    expect(parts.stylesXml).toContain('<w:jc w:val="both"/>');
    expect(parts.documentXml).not.toMatch(/<w:pPr>[\s\S]*?<w:spacing/);
    expect(parts.documentXml).not.toMatch(/<w:pPr>[\s\S]*?<w:jc/);
  });
});
