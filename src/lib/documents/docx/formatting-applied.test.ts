import { describe, expect, it } from "vitest";
import { generateDocumentDocx } from "./generate";
import { buildDocumentModel } from "@/lib/editor/render";
import { legacyTextToDocument } from "@/lib/editor/convert";
import { readDocx } from "../../../../test/support/docx";
import type { DocumentFormattingPreferences } from "./formatting";
import type { TemplateDocument } from "@/lib/editor/types";

// Verifica que `generateDocumentDocx` aplica de verdad las preferencias de
// formato al OOXML generado (no solo que las acepta como parámetro): página
// Legal siempre, márgenes del perfil elegido (Frente/Vuelto), fuente/tamaño
// según lo configurado, y el cuerpo documental siempre justificado, sin
// sangrías, con 0 pt antes/después y 24 pt exactos de interlineado.

const model = buildDocumentModel(legacyTextToDocument("Texto de prueba."), {});

/** Atributos `w:*` de la primera aparición de `<w:tag .../>` en el XML. */
function attrs(xml: string, tag: string): Record<string, string> {
  const match = new RegExp(`<w:${tag}\\s([^>]*?)/?>`).exec(xml);
  if (!match) throw new Error(`<w:${tag}> not found`);
  return Object.fromEntries(
    [...match[1].matchAll(/w:(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
  );
}

/** Twips de una medida en pulgadas (unidad de Word). */
const inchesToTwips = (inches: number) => Math.round(inches * 1440);

const REFERENCE_INCHES = { top: 1.44, bottom: 2.22, left: 0.98, right: 0.98 };

function expectReferenceMargins(pgMar: Record<string, string>) {
  // Las medidas se guardan en cm con 2 decimales (3.66/5.64/2.49) y aun así
  // convierten exactamente a los twips de las pulgadas de Word.
  for (const side of ["top", "bottom", "left", "right"] as const) {
    expect(Number(pgMar[side])).toBe(inchesToTwips(REFERENCE_INCHES[side]));
  }
  expect(pgMar.top).toBe("2074");
  expect(pgMar.bottom).toBe("3197");
  expect(pgMar.left).toBe("1411");
  expect(pgMar.right).toBe("1411");
  expect(pgMar.gutter).toBe("0");
}

describe("formatting applied to the generated docx", () => {
  it("uses Legal paper size (8.5 x 14 in) by default, portrait", async () => {
    const buffer = await generateDocumentDocx(model);
    const parts = await readDocx(buffer);
    expect(parts.documentXml).toContain(
      '<w:pgSz w:w="12240" w:h="20160" w:orient="portrait"/>',
    );
  });

  it("Frente (default): Word reference margins, gutter 0, portrait", async () => {
    const parts = await readDocx(await generateDocumentDocx(model));
    expectReferenceMargins(attrs(parts.documentXml, "pgMar"));
    expect(attrs(parts.documentXml, "pgSz").orient).toBe("portrait");
  });

  it("Frente selected explicitly gives the same result as the default", async () => {
    const implicit = await readDocx(await generateDocumentDocx(model));
    const explicit = await readDocx(
      await generateDocumentDocx(model, undefined, "front"),
    );
    expect(attrs(explicit.documentXml, "pgMar")).toEqual(
      attrs(implicit.documentXml, "pgMar"),
    );
  });

  it("Vuelto: Word reference margins too (same initial values as Frente)", async () => {
    const parts = await readDocx(
      await generateDocumentDocx(model, undefined, "back"),
    );
    expectReferenceMargins(attrs(parts.documentXml, "pgMar"));
  });

  it("Frente and Vuelto are independent profiles: each selection applies its own margins", async () => {
    const custom: DocumentFormattingPreferences = {
      fontFamily: "Arial",
      fontSizePt: 11,
      marginsCm: {
        front: { top: 2, bottom: 2.5, left: 3, right: 3.5 },
        back: { top: 4, bottom: 4.5, left: 5, right: 5.5 },
      },
    };
    const front = await readDocx(await generateDocumentDocx(model, custom, "front"));
    const back = await readDocx(await generateDocumentDocx(model, custom, "back"));

    // Nunca top/bottom ni left/right intercambiados, y cada perfil es el suyo.
    expect(attrs(front.documentXml, "pgMar")).toMatchObject({
      top: "1133",
      right: "1984",
      bottom: "1417",
      left: "1700",
    });
    expect(attrs(back.documentXml, "pgMar")).toMatchObject({
      top: "2267",
      right: "3118",
      bottom: "2551",
      left: "2834",
    });
  });

  it("body paragraph format: justified, no indents, 0pt before/after, exactly 24pt", async () => {
    const parts = await readDocx(await generateDocumentDocx(model));

    const pPrDefault = /<w:pPrDefault>[\s\S]*?<\/w:pPrDefault>/.exec(
      parts.stylesXml,
    )![0];
    expect(attrs(pPrDefault, "spacing")).toEqual({
      before: "0",
      after: "0",
      line: "480", // 24 pt = 480 veinteavos de punto
      // "Exactly" en Word = "exact" en OOXML. "exactly" (lo que emitía
      // `LineRuleType.EXACTLY`) no es válido y Word lo lee como "auto".
      lineRule: "exact",
    });
    expect(attrs(pPrDefault, "ind")).toEqual({ left: "0", right: "0" });
    expect(pPrDefault).not.toMatch(/firstLine|hanging/); // sin sangría especial
    expect(attrs(pPrDefault, "jc")).toEqual({ val: "both" });
  });

  it("applies the default font preferences (Times New Roman 12pt)", async () => {
    const parts = await readDocx(await generateDocumentDocx(model));
    expect(parts.stylesXml).toContain('w:ascii="Times New Roman"');
    expect(parts.stylesXml).toContain('<w:sz w:val="24"/>'); // 12pt
  });

  it("applies custom font and size, while paragraph format and page size stay fixed", async () => {
    const custom: DocumentFormattingPreferences = {
      fontFamily: "Arial",
      fontSizePt: 11,
      marginsCm: {
        front: { top: 2, bottom: 2.5, left: 3, right: 3.5 },
        back: { top: 2, bottom: 2.5, left: 3, right: 3.5 },
      },
    };
    const parts = await readDocx(await generateDocumentDocx(model, custom));

    expect(parts.stylesXml).toContain('w:ascii="Arial"');
    expect(parts.stylesXml).toContain('<w:sz w:val="22"/>'); // 11pt
    expect(parts.stylesXml).toContain('w:line="480" w:lineRule="exact"');
    expect(parts.stylesXml).toContain('<w:jc w:val="both"/>');
    expect(parts.documentXml).toContain(
      '<w:pgSz w:w="12240" w:h="20160" w:orient="portrait"/>',
    );
  });

  it("keeps justification and exact line spacing consistent across the whole document, not just the first paragraph", async () => {
    const multiParagraphModel = buildDocumentModel(
      legacyTextToDocument("Uno\nDos\nTres"),
      {},
    );
    const parts = await readDocx(
      await generateDocumentDocx(
        multiParagraphModel,
        {
          fontFamily: "Calibri",
          fontSizePt: 12,
          marginsCm: {
            front: { top: 1, bottom: 1, left: 1, right: 1 },
            back: { top: 1, bottom: 1, left: 1, right: 1 },
          },
        },
        "back",
      ),
    );

    // El formato se declara una sola vez en docDefaults, aplicado a todos los
    // párrafos; ningún párrafo del modelo lo sobreescribe con el suyo.
    expect(parts.stylesXml).toContain('w:line="480" w:lineRule="exact"');
    expect(parts.stylesXml).toContain('<w:jc w:val="both"/>');
    expect(parts.documentXml).not.toMatch(/<w:pPr>[\s\S]*?<w:spacing/);
    expect(parts.documentXml).not.toMatch(/<w:pPr>[\s\S]*?<w:jc/);
    expect(parts.documentXml).not.toMatch(/<w:pPr>[\s\S]*?<w:ind/);
  });

  it("regression: the real OOXML is Word 'Exactly 24 pt' for Machote paragraphs with variables and bold", async () => {
    const machote: TemplateDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Comparece " },
            { type: "templateVariable", attrs: { key: "comprador.nombre" } },
            { type: "text", text: ", mayor de edad", marks: [{ type: "bold" }] },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "Segundo párrafo." }] },
      ],
    };
    const parts = await readDocx(
      await generateDocumentDocx(
        buildDocumentModel(machote, { "comprador.nombre": "Juan Pérez" }),
      ),
    );

    // Valor OOXML válido: nunca "exactly" (Word lo ignora → "auto" → doble).
    expect(parts.stylesXml).not.toContain('w:lineRule="exactly"');
    for (const [, rule] of parts.stylesXml.matchAll(/w:lineRule="([^"]*)"/g)) {
      expect(["auto", "exact", "atLeast"]).toContain(rule);
    }

    const pPrDefault = /<w:pPrDefault>[\s\S]*?<\/w:pPrDefault>/.exec(
      parts.stylesXml,
    )![0];
    expect(attrs(pPrDefault, "spacing")).toEqual({
      before: "0",
      after: "0",
      line: "480",
      lineRule: "exact",
    });
    expect(attrs(pPrDefault, "ind")).toEqual({ left: "0", right: "0" });
    expect(attrs(pPrDefault, "jc")).toEqual({ val: "both" });

    // Nada sobrescribe docDefaults: sin estilo "Normal" propio, sin pStyle
    // ni pPr en los párrafos (incluidos los que tienen variable y negrita).
    expect(parts.stylesXml).not.toMatch(/w:styleId="Normal"/);
    expect(parts.documentXml).not.toContain("<w:pStyle");
    expect(parts.documentXml).not.toContain("<w:pPr>");
    expect(parts.documentXml).toContain("Juan Pérez");
    expect(parts.documentXml).toContain("<w:b/>");
  });
});
