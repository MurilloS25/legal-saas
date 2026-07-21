import { describe, expect, it } from "vitest";
import { NotarialMetadataSchema } from "./notarial-schema";

describe("NotarialMetadataSchema", () => {
  it("normalizes empty strings to null and parses the CR date", () => {
    const result = NotarialMetadataSchema.safeParse({
      instrument_number: "123",
      protocol_book: "",
      initial_folio: "",
      final_folio: "",
      act_name_override: "Compraventa",
      parties_override: "",
      notes: "",
      version: "1",
      authorized_at: "2026-07-13T10:35",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instrument_number).toBe(123);
      expect(result.data.protocol_book).toBeNull();
      expect(result.data.authorized_at).toBe("2026-07-13T16:35:00.000Z");
    }
  });

  it("accepts a fully empty payload (all optional)", () => {
    const result = NotarialMetadataSchema.safeParse({
      instrument_number: "",
      protocol_book: "",
      initial_folio: "",
      final_folio: "",
      act_name_override: "",
      parties_override: "",
      notes: "",
      version: "1",
      authorized_at: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authorized_at).toBeNull();
      expect(result.data.act_name_override).toBeNull();
    }
  });

  it("rejects an invalid authorized_at", () => {
    const result = NotarialMetadataSchema.safeParse({
      instrument_number: "1",
      protocol_book: "",
      initial_folio: "",
      final_folio: "",
      act_name_override: "x",
      parties_override: "",
      notes: "",
      version: "1",
      authorized_at: "ayer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive instrument numbers", () => {
    const result = NotarialMetadataSchema.safeParse({
      instrument_number: "0",
      protocol_book: "",
      initial_folio: "",
      final_folio: "",
      act_name_override: "x",
      parties_override: "",
      notes: "",
      version: "1",
      authorized_at: "",
    });
    expect(result.success).toBe(false);
  });
});
