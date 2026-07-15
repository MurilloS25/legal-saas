import { describe, it, expect } from "vitest";
import {
  DocumentTitleSchema,
  DocumentValuesSchema,
  DocumentRenderedContentSchema,
  DocumentIdSchema,
  DocumentStatusSchema,
  OptionalClientIdSchema,
  mergeDocumentDraftValues,
} from "./document-schema";

describe("DocumentTitleSchema", () => {
  it("accepts a normal title", () => {
    expect(DocumentTitleSchema.safeParse("Compraventa — Borrador").success).toBe(
      true,
    );
  });

  it("trims surrounding whitespace", () => {
    const result = DocumentTitleSchema.safeParse("  Compraventa  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("Compraventa");
  });

  it("rejects an empty title", () => {
    expect(DocumentTitleSchema.safeParse("").success).toBe(false);
  });

  it("rejects a whitespace-only title", () => {
    expect(DocumentTitleSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects a title longer than 200 characters", () => {
    expect(DocumentTitleSchema.safeParse("a".repeat(201)).success).toBe(false);
  });

  it("accepts a title of exactly 200 characters", () => {
    expect(DocumentTitleSchema.safeParse("a".repeat(200)).success).toBe(true);
  });
});

describe("DocumentValuesSchema", () => {
  it("accepts a flat map of field keys to strings", () => {
    const result = DocumentValuesSchema.safeParse({
      "buyer_1.full_name": "Test Client One",
      edad: "veintiséis años",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object", () => {
    expect(DocumentValuesSchema.safeParse({}).success).toBe(true);
  });

  it("preserves text exactly, including leading zeros and symbols", () => {
    const result = DocumentValuesSchema.safeParse({
      placa: "012-ABC #7 (usada)",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data["placa"]).toBe("012-ABC #7 (usada)");
  });

  it("rejects arrays", () => {
    expect(DocumentValuesSchema.safeParse(["a", "b"]).success).toBe(false);
  });

  it("rejects null", () => {
    expect(DocumentValuesSchema.safeParse(null).success).toBe(false);
  });

  it("rejects nested objects as values", () => {
    expect(
      DocumentValuesSchema.safeParse({ buyer: { name: "x" } }).success,
    ).toBe(false);
  });

  it("rejects numbers as values", () => {
    expect(DocumentValuesSchema.safeParse({ edad: 26 }).success).toBe(false);
  });

  it("rejects arrays as values", () => {
    expect(DocumentValuesSchema.safeParse({ partes: ["a"] }).success).toBe(false);
  });

  it("rejects keys with invalid format", () => {
    expect(
      DocumentValuesSchema.safeParse({ "Nombre Compareciente": "x" }).success,
    ).toBe(false);
  });

  it("rejects dangerous keys", () => {
    for (const key of ["__proto__", "constructor", "prototype"]) {
      expect(
        DocumentValuesSchema.safeParse({ [key]: "x" }).success,
        `key ${key} should be rejected`,
      ).toBe(false);
    }
  });

  it("rejects dangerous keys on null-prototype objects", () => {
    const values = Object.create(null) as Record<string, string>;
    values["__proto__"] = "x";
    expect(DocumentValuesSchema.safeParse(values).success).toBe(false);
  });

  it("rejects keys longer than 120 characters", () => {
    expect(
      DocumentValuesSchema.safeParse({ ["k".repeat(121)]: "x" }).success,
    ).toBe(false);
  });

  it("rejects values longer than 20000 characters", () => {
    expect(
      DocumentValuesSchema.safeParse({ texto: "x".repeat(20001) }).success,
    ).toBe(false);
  });

  it("accepts a long but reasonable value", () => {
    expect(
      DocumentValuesSchema.safeParse({ texto: "x".repeat(5000) }).success,
    ).toBe(true);
  });

  it("rejects maps with more than 200 keys", () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 201; i++) big[`campo_${i}`] = "x";
    expect(DocumentValuesSchema.safeParse(big).success).toBe(false);
  });
});

describe("DocumentRenderedContentSchema", () => {
  it("accepts rendered plain text", () => {
    expect(
      DocumentRenderedContentSchema.safeParse("Comparece Test Client One.")
        .success,
    ).toBe(true);
  });

  it("rejects content longer than 200000 characters", () => {
    expect(
      DocumentRenderedContentSchema.safeParse("x".repeat(200001)).success,
    ).toBe(false);
  });
});

describe("mergeDocumentDraftValues", () => {
  it("preserves historical values that are no longer editable", () => {
    const result = mergeDocumentDraftValues(
      {
        "buyer_1.full_name": "Nombre viejo",
        "legacy.field": "valor historico",
      },
      {
        "buyer_1.full_name": "Nombre nuevo",
      },
      ["buyer_1.full_name"],
    );

    expect(result).toEqual({
      "buyer_1.full_name": "Nombre nuevo",
      "legacy.field": "valor historico",
    });
  });

  it("preserves exact text in current and historical values", () => {
    const result = mergeDocumentDraftValues(
      {
        "legacy.lines": "linea uno\nlinea dos",
      },
      {
        price: "  1.000.000,50  ",
        code: "007",
      },
      ["price", "code"],
    );

    expect(result["legacy.lines"]).toBe("linea uno\nlinea dos");
    expect(result.price).toBe("  1.000.000,50  ");
    expect(result.code).toBe("007");
  });
});

describe("DocumentIdSchema", () => {
  it("accepts a valid uuid", () => {
    expect(
      DocumentIdSchema.safeParse("31111111-0000-0000-0000-000000000002")
        .success,
    ).toBe(true);
  });

  it("rejects a non-uuid string", () => {
    expect(DocumentIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(DocumentIdSchema.safeParse("").success).toBe(false);
  });
});

describe("OptionalClientIdSchema", () => {
  it("normalizes an empty string to null (Sin cliente)", () => {
    const result = OptionalClientIdSchema.safeParse("");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("trims whitespace-only input to null", () => {
    const result = OptionalClientIdSchema.safeParse("   ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("accepts a valid UUID", () => {
    const uuid = "41111111-c000-0000-0000-000000000001";
    const result = OptionalClientIdSchema.safeParse(uuid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(uuid);
  });

  it("rejects a non-UUID value", () => {
    for (const value of ["not-a-uuid", "123", "'; drop table"]) {
      expect(OptionalClientIdSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("DocumentStatusSchema", () => {
  it("accepts draft", () => {
    expect(DocumentStatusSchema.safeParse("draft").success).toBe(true);
  });

  it("rejects statuses that are not implemented yet", () => {
    for (const status of ["completed", "signed", "sent", "archived"]) {
      expect(DocumentStatusSchema.safeParse(status).success).toBe(false);
    }
  });
});
