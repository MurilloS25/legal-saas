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
      instrument_number_derived_snapshot: "",
      authorized_date_derived_snapshot: "",
      authorized_time_derived_snapshot: "",
      protocol_book_derived_snapshot: "",
      initial_folio_derived_snapshot: "",
      final_folio_derived_snapshot: "",
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
      instrument_number_derived_snapshot: "",
      authorized_date_derived_snapshot: "",
      authorized_time_derived_snapshot: "",
      protocol_book_derived_snapshot: "",
      initial_folio_derived_snapshot: "",
      final_folio_derived_snapshot: "",
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

describe("NotarialMetadataSchema — folios Frente/Vuelto", () => {
  const base = {
    instrument_number: "",
    protocol_book: "",
    initial_folio: "",
    final_folio: "",
    act_name_override: "",
    parties_override: "",
    notes: "",
    version: "1",
    authorized_at: "",
    instrument_number_derived_snapshot: "",
    authorized_date_derived_snapshot: "",
    authorized_time_derived_snapshot: "",
    protocol_book_derived_snapshot: "",
    initial_folio_derived_snapshot: "",
    final_folio_derived_snapshot: "",
  };

  it.each([
    ["20 frente", "20 vuelto", "20F", "20V"],
    ["20 F", "21 v", "20F", "21V"],
    ["23F", "23V", "23F", "23V"],
    ["40", "41", "40", "41"],
  ])("stores %j / %j as %j / %j", (initial, final, expectedInitial, expectedFinal) => {
    const result = NotarialMetadataSchema.safeParse({
      ...base,
      initial_folio: initial,
      final_folio: final,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.initial_folio).toBe(expectedInitial);
      expect(result.data.final_folio).toBe(expectedFinal);
    }
  });

  it("keeps an empty folio as null (still optional)", () => {
    const result = NotarialMetadataSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.initial_folio).toBeNull();
  });

  it.each(["20 fte", "F 20", "20-21", "20 frente vuelto"])(
    "rejects the ambiguous folio %j with a clear message",
    (value) => {
      const result = NotarialMetadataSchema.safeParse({
        ...base,
        final_folio: value,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.final_folio?.[0]).toMatch(
          /20 frente/,
        );
      }
    },
  );
});
