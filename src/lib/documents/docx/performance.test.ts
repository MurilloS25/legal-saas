import { describe, expect, it } from "vitest";
import { generateDocumentDocx } from "./generate";
import type { DocumentModel, DocumentParagraph } from "@/lib/editor/render";

// Medición razonable, no benchmark formal: confirma que la generación de
// documentos pequeños, medianos y cercanos al límite termina en un tiempo
// acotado y reporta tiempo y tamaño del buffer.

function paragraphs(count: number, chars: number): DocumentModel {
  const line = "palabra ".repeat(Math.ceil(chars / 8)).slice(0, chars);
  const paragraph: DocumentParagraph = {
    kind: "paragraph",
    runs: [
      {
        kind: "text",
        text: line,
        marks: { bold: false, italic: false, underline: false },
      },
    ],
  };
  return Array.from({ length: count }, () => paragraph);
}

async function measure(label: string, model: DocumentModel, maxMs: number) {
  const start = performance.now();
  const buffer = await generateDocumentDocx(model);
  const elapsed = performance.now() - start;
  console.info(
    `[docx-perf] ${label}: ${elapsed.toFixed(0)}ms, ${(
      buffer.byteLength / 1024
    ).toFixed(1)} KiB`,
  );
  expect(buffer.byteLength).toBeGreaterThan(0);
  expect(elapsed).toBeLessThan(maxMs);
}

describe("docx generation performance", () => {
  it("generates a small document quickly", async () => {
    await measure("small (5 párrafos)", paragraphs(5, 80), 2_000);
  });

  it("generates a medium document within bounds", async () => {
    await measure("medium (500 párrafos)", paragraphs(500, 120), 5_000);
  });

  it("generates a near-limit document within bounds", async () => {
    await measure("near-limit (4900 párrafos)", paragraphs(4_900, 120), 20_000);
  });
});
