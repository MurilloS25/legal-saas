import { describe, expect, it } from "vitest";
import { extractDocxText, readDocx } from "../../../../test/support/docx";
import type { NotarialIndexRow } from "../model/notarial-index-row";
import { generateNotarialIndexDocx } from "./notarial-docx";

const selection = { year: 2026, month: 7, half: "FIRST_HALF" } as const;
const row: NotarialIndexRow = {
  document_id: "10000000-0000-0000-0000-000000000001",
  title: "Escritura fake",
  client_name: null,
  instrument_number: 61,
  authorized_at: "2026-07-01T22:00:00.000Z",
  protocol_book: "08",
  initial_folio: "23F",
  final_folio: "23V",
  act_name: "COMPRAVENTA",
  parties: "PERSONA UNO Y PERSONA DOS",
  period_year: 2026,
  period_month: 7,
  period_half: "FIRST_HALF",
  version: 1,
  has_metadata: true,
  is_complete: true,
};

function wordAttributes(xml: string, tag: string): Record<string, string> {
  const match = xml.match(new RegExp(`<w:${tag}\\s+([^>]+?)/?>`));
  if (!match) return {};
  return Object.fromEntries(
    [...match[1].matchAll(/w:([\w]+)="([^"]*)"/g)].map((attribute) => [
      attribute[1],
      attribute[2],
    ]),
  );
}

describe("notarial index DOCX", () => {
  it("generates a landscape OOXML document with headers and rows", async () => {
    const buffer = await generateNotarialIndexDocx({
      rows: [row],
      selection,
      notaryName: "Abogada Prueba",
      generatedAt: new Date("2026-07-16T14:00:00.000Z"),
    });
    const parts = await readDocx(buffer);
    const text = extractDocxText(parts.documentXml);

    expect(parts.entryNames).toContain("word/document.xml");
    const pageSize = wordAttributes(parts.documentXml, "pgSz");
    const pageMargins = wordAttributes(parts.documentXml, "pgMar");
    const pageWidth = Number(pageSize.w);
    const usableWidth =
      pageWidth - Number(pageMargins.left) - Number(pageMargins.right);
    const columnWidths = [
      ...parts.documentXml.matchAll(/<w:gridCol w:w="(\d+)"\/>/g),
    ].map((match) => Number(match[1]));
    const tableWidth = Number(wordAttributes(parts.documentXml, "tblW").w);

    expect(pageSize).toMatchObject({
      w: "16838",
      h: "11906",
      orient: "landscape",
    });
    expect(pageWidth).toBeGreaterThan(Number(pageSize.h));
    expect(pageMargins).toMatchObject({ left: "567", right: "567" });
    expect(columnWidths).toHaveLength(8);
    expect(columnWidths.reduce((sum, width) => sum + width, 0)).toBe(tableWidth);
    expect(tableWidth).toBeLessThanOrEqual(usableWidth);
    expect(columnWidths[6]).toBeGreaterThan(Math.max(...columnWidths.slice(0, 6)));
    expect(columnWidths[7]).toBeGreaterThan(columnWidths[6]);
    expect(parts.documentXml).toContain("<w:tblHeader/>");
    expect(text).toContain(
      "Índice de instrumentos autorizados por el Notario Abogada Prueba",
    );
    expect(text).toContain("TomoFolio InicialFolio FinalNúmeroFechaHoraActo o ContratoPartes");
    expect(text).toContain("0823F23V6101/07/202616:00hrsCOMPRAVENTAPERSONA UNO Y PERSONA DOS");
    expect(text).toContain("16 DE JULIO DEL 2026");
    expect(text).toContain("LIC. ABOGADA PRUEBA");
  });

  it("supports an empty fortnight without persisting a file", async () => {
    const parts = await readDocx(
      await generateNotarialIndexDocx({
        rows: [],
        selection,
        notaryName: "Abogada Prueba",
        generatedAt: new Date("2026-07-16T14:00:00.000Z"),
      }),
    );
    expect(extractDocxText(parts.documentXml)).toContain(
      "No hay instrumentos registrados para esta quincena.",
    );
  });
});
