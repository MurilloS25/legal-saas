import { describe, expect, it } from "vitest";
import { NotarialMetadataSchema } from "./notarial";

describe("NotarialMetadataSchema", () => {
  it("normalizes empty strings to null and parses the CR date", () => {
    const result = NotarialMetadataSchema.safeParse({
      instrument_number: "  123-A ",
      act_type: "Compraventa",
      book_reference: "",
      folio_reference: "",
      appearing_parties_summary: "",
      notes: "",
      authorized_at: "2026-07-13T10:35",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instrument_number).toBe("123-A");
      expect(result.data.book_reference).toBeNull();
      expect(result.data.authorized_at).toBe("2026-07-13T16:35:00.000Z");
    }
  });

  it("accepts a fully empty payload (all optional)", () => {
    const result = NotarialMetadataSchema.safeParse({
      instrument_number: "",
      act_type: "",
      book_reference: "",
      folio_reference: "",
      appearing_parties_summary: "",
      notes: "",
      authorized_at: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authorized_at).toBeNull();
      expect(result.data.act_type).toBeNull();
    }
  });

  it("rejects an invalid authorized_at", () => {
    const result = NotarialMetadataSchema.safeParse({
      instrument_number: "1",
      act_type: "x",
      book_reference: "",
      folio_reference: "",
      appearing_parties_summary: "",
      notes: "",
      authorized_at: "ayer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects values that exceed the length limit", () => {
    const result = NotarialMetadataSchema.safeParse({
      instrument_number: "a".repeat(200),
      act_type: "x",
      book_reference: "",
      folio_reference: "",
      appearing_parties_summary: "",
      notes: "",
      authorized_at: "",
    });
    expect(result.success).toBe(false);
  });
});
