import { describe, expect, it } from "vitest";
import { readDocumentNotarialSnapshot } from "./notarial-snapshot";

describe("readDocumentNotarialSnapshot", () => {
  it("reads the version-2 historical notarial member", () => {
    expect(
      readDocumentNotarialSnapshot({
        version: 2,
        document: { type: "doc", content: [] },
        fields: [],
        notarial: { templateName: "Compraventa v1", configuration: null },
      }),
    ).toEqual({ templateName: "Compraventa v1", configuration: null });
  });

  it("returns null for version-1 and pre-snapshot documents", () => {
    expect(readDocumentNotarialSnapshot(null)).toBeNull();
    expect(
      readDocumentNotarialSnapshot({ version: 1, document: {}, fields: [] }),
    ).toBeNull();
  });

  it("rejects malformed version-2 data instead of falling back to the current Machote", () => {
    expect(() =>
      readDocumentNotarialSnapshot({ version: 2, notarial: {} }),
    ).toThrow("El snapshot notarial del machote no es válido.");
  });
});
