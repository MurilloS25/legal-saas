import { describe, expect, it } from "vitest";
import {
  isNotarialComplete,
  joinMissingFieldLabels,
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
  updated_at: "2026-07-13T16:35:00.000Z",
};

describe("isNotarialComplete", () => {
  it("uses snapshots when manual overrides are blank", () => {
    expect(
      isNotarialComplete({
        instrument_number: 1,
        authorized_at: "2026-07-15T12:00:00.000Z",
        protocol_book: "08",
        initial_folio: "1F",
        final_folio: "1V",
        act_name_snapshot: "Compraventa",
        act_name_override: "   ",
        generated_parties: "ANA Y BETO",
        parties_override: "",
      }),
    ).toBe(true);
  });
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

  it("reports every core field when metadata is null", () => {
    expect(notarialMissingFields(null)).toEqual([
      "protocol_book",
      "initial_folio",
      "final_folio",
      "instrument_number",
      "authorized_at",
      "act_name",
      "parties",
    ]);
  });
});

describe("joinMissingFieldLabels", () => {
  it("returns an empty string for no missing fields", () => {
    expect(joinMissingFieldLabels([])).toBe("");
  });

  it("returns a single label as-is", () => {
    expect(joinMissingFieldLabels(["instrument_number"])).toBe(
      "número de instrumento",
    );
  });

  it("joins two labels with 'y'", () => {
    expect(joinMissingFieldLabels(["instrument_number", "authorized_at"])).toBe(
      "número de instrumento y fecha y hora de autorización",
    );
  });

  it("joins three or more labels with commas and a final 'y'", () => {
    expect(
      joinMissingFieldLabels(["instrument_number", "authorized_at", "parties"]),
    ).toBe("número de instrumento, fecha y hora de autorización y partes");
  });
});
