import { describe, expect, it } from "vitest";
import {
  generateConfiguredPartiesPreview,
  generateIndexParties,
} from "./parties";

describe("generateIndexParties", () => {
  it("normalizes, orders, deduplicates, and uppercases configured values", () => {
    expect(
      generateIndexParties({
        fields: [
          { templateFieldId: "buyer", order: 2, value: " María  Rodríguez " },
          { templateFieldId: "seller", order: 1, value: "Juan   Pérez" },
          { templateFieldId: "buyer-copy", order: 3, value: "maría rodríguez" },
        ],
        separator: " y ",
        fixedSuffix: null,
      }),
    ).toBe("JUAN PÉREZ Y MARÍA RODRÍGUEZ");
  });

  it("ignores empty values and appends normalized fixed text", () => {
    expect(
      generateIndexParties({
        fields: [
          { templateFieldId: "empty", order: 1, value: "  " },
          { templateFieldId: "company", order: 2, value: "Acme, S.A." },
        ],
        separator: " / ",
        fixedSuffix: " representada por su apoderado ",
      }),
    ).toBe("ACME, S.A. / REPRESENTADA POR SU APODERADO");
  });

  it("returns an empty value for an explicitly empty configuration", () => {
    expect(
      generateIndexParties({
        fields: [],
        separator: " Y ",
        fixedSuffix: null,
      }),
    ).toBe("");
  });

  it("uses template field id as the deterministic order tie-breaker", () => {
    expect(
      generateIndexParties({
        fields: [
          { templateFieldId: "z", order: 1, value: "Segundo" },
          { templateFieldId: "a", order: 1, value: "Primero" },
        ],
        separator: ", ",
        fixedSuffix: null,
      }),
    ).toBe("PRIMERO, SEGUNDO");
  });
});

describe("generateConfiguredPartiesPreview", () => {
  it("resolves configured field ids against structured values", () => {
    expect(
      generateConfiguredPartiesPreview(
        {
          mappingsValid: true,
          partySeparator: " Y ",
          fixedSuffix: null,
          fields: [{ templateFieldId: "seller", order: 0 }],
        },
        [{ id: "seller", fieldKey: "seller.name" }],
        { "seller.name": "Juan Pérez" },
      ),
    ).toBe("JUAN PÉREZ");
  });

  it("returns null for incomplete or stale configurations", () => {
    const configuration = {
      mappingsValid: true,
      partySeparator: " Y ",
      fixedSuffix: null,
      fields: [{ templateFieldId: "missing", order: 0 }],
    };
    expect(generateConfiguredPartiesPreview(configuration, [], {})).toBeNull();
    expect(
      generateConfiguredPartiesPreview(
        { ...configuration, mappingsValid: false },
        [{ id: "missing", fieldKey: "party.name" }],
        { "party.name": "Ana" },
      ),
    ).toBeNull();
  });
});
