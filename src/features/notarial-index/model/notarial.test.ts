import { describe, expect, it } from "vitest";
import {
  isNotarialComplete,
  notarialCompleteness,
  notarialMissingFields,
  type NotarialMetadata,
} from "./notarial";

const full: NotarialMetadata = {
  instrument_number: 123,
  authorized_at: "2026-07-13T16:35:00.000Z",
  protocol_book: "08",
  initial_folio: "23F",
  final_folio: "23V",
  act_name_snapshot: "Compraventa",
  act_name_override: null,
  generated_parties: "JUAN PEREZ Y MARIA ROJAS",
  parties_override: null,
  notes: null,
  version: 1,
};

describe("isNotarialComplete", () => {
  it("is complete with all eight index values present", () => {
    expect(isNotarialComplete(full)).toBe(true);
  });

  it("is incomplete when any core field is missing or blank", () => {
    expect(isNotarialComplete({ ...full, instrument_number: null })).toBe(false);
    expect(isNotarialComplete({ ...full, authorized_at: null })).toBe(false);
    expect(isNotarialComplete({ ...full, protocol_book: "   " })).toBe(false);
    expect(isNotarialComplete({ ...full, generated_parties: null })).toBe(false);
  });

  it("treats null metadata as incomplete", () => {
    expect(isNotarialComplete(null)).toBe(false);
  });
});

describe("notarialCompleteness", () => {
  it("maps to missing / incomplete / complete", () => {
    expect(notarialCompleteness(null)).toBe("missing");
    expect(notarialCompleteness({ ...full, act_name_snapshot: null })).toBe("incomplete");
    expect(notarialCompleteness(full)).toBe("complete");
  });
});

describe("notarialMissingFields", () => {
  it("reports only missing effective values", () => {
    expect(
      notarialMissingFields({
        ...full,
        initial_folio: null,
        parties_override: "CORRECCION MANUAL",
        generated_parties: null,
      }),
    ).toEqual(["initial_folio"]);
  });
});
