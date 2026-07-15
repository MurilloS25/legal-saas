import { describe, expect, it } from "vitest";
import {
  isNotarialComplete,
  notarialCompleteness,
  type NotarialMetadata,
} from "./notarial";

const full: NotarialMetadata = {
  instrument_number: "123",
  authorized_at: "2026-07-13T16:35:00.000Z",
  act_type: "Compraventa",
  book_reference: null,
  folio_reference: null,
  appearing_parties_summary: null,
  notes: null,
};

describe("isNotarialComplete", () => {
  it("is complete with the three core fields present", () => {
    expect(isNotarialComplete(full)).toBe(true);
  });

  it("is incomplete when any core field is missing or blank", () => {
    expect(isNotarialComplete({ ...full, instrument_number: null })).toBe(false);
    expect(isNotarialComplete({ ...full, authorized_at: null })).toBe(false);
    expect(isNotarialComplete({ ...full, act_type: "   " })).toBe(false);
  });

  it("ignores non-core fields for completeness", () => {
    expect(
      isNotarialComplete({ ...full, book_reference: null, notes: null }),
    ).toBe(true);
  });

  it("treats null metadata as incomplete", () => {
    expect(isNotarialComplete(null)).toBe(false);
  });
});

describe("notarialCompleteness", () => {
  it("maps to missing / incomplete / complete", () => {
    expect(notarialCompleteness(null)).toBe("missing");
    expect(notarialCompleteness({ ...full, act_type: null })).toBe("incomplete");
    expect(notarialCompleteness(full)).toBe("complete");
  });
});
