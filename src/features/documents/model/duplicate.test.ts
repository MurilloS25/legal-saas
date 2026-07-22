import { describe, expect, it } from "vitest";
import { buildDuplicateDocumentTitle } from "./duplicate";

describe("buildDuplicateDocumentTitle", () => {
  it("prefixes a plain title with 'Copia de '", () => {
    expect(buildDuplicateDocumentTitle("Contrato de compraventa")).toBe(
      "Copia de Contrato de compraventa",
    );
  });

  it("does not chain the prefix when the title is already a copy", () => {
    expect(buildDuplicateDocumentTitle("Copia de Contrato")).toBe(
      "Copia de Contrato",
    );
  });

  it("does not chain the prefix across repeated duplications", () => {
    const first = buildDuplicateDocumentTitle("Poder especial");
    const second = buildDuplicateDocumentTitle(first);
    expect(second).toBe("Copia de Poder especial");
  });

  it("treats the prefix case-sensitively (only the exact convention short-circuits)", () => {
    expect(buildDuplicateDocumentTitle("copia de algo")).toBe(
      "Copia de copia de algo",
    );
  });
});
