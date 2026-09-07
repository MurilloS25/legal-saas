import { describe, expect, it } from "vitest";
import {
  canConfirmNotarialIndex,
  isNotarialComplete,
  joinMissingFieldLabels,
  notarialCompleteness,
  notarialConfirmationState,
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
  notarial_confirmed_at: null,
  notarial_confirmed_by: null,
  notarial_review_required: false,
  instrument_number_derived_snapshot: null,
  authorized_date_derived_snapshot: null,
  authorized_time_derived_snapshot: null,
  protocol_book_derived_snapshot: null,
  initial_folio_derived_snapshot: null,
  final_folio_derived_snapshot: null,
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

describe("notarialConfirmationState", () => {
  it("is pending when incomplete, never confirmed, no review pending", () => {
    expect(notarialConfirmationState(null, false)).toBe("pending");
    expect(
      notarialConfirmationState(
        { notarial_confirmed_at: null, notarial_review_required: false },
        false,
      ),
    ).toBe("pending");
  });

  it("is ready_to_confirm once complete, still unconfirmed", () => {
    expect(
      notarialConfirmationState(
        { notarial_confirmed_at: null, notarial_review_required: false },
        true,
      ),
    ).toBe("ready_to_confirm");
  });

  it("is confirmed whenever notarial_confirmed_at is set, regardless of completeness", () => {
    expect(
      notarialConfirmationState(
        {
          notarial_confirmed_at: "2026-07-13T16:35:00.000Z",
          notarial_review_required: false,
        },
        true,
      ),
    ).toBe("confirmed");
  });

  it("is review_required after an invalidated confirmation, even if already complete again", () => {
    expect(
      notarialConfirmationState(
        { notarial_confirmed_at: null, notarial_review_required: true },
        false,
      ),
    ).toBe("review_required");
    expect(
      notarialConfirmationState(
        { notarial_confirmed_at: null, notarial_review_required: true },
        true,
      ),
    ).toBe("review_required");
  });

  it("confirmed_at takes priority over review_required (defensive — should never coexist)", () => {
    expect(
      notarialConfirmationState(
        {
          notarial_confirmed_at: "2026-07-13T16:35:00.000Z",
          notarial_review_required: true,
        },
        true,
      ),
    ).toBe("confirmed");
  });
});

describe("canConfirmNotarialIndex", () => {
  it("requires completeness", () => {
    expect(canConfirmNotarialIndex("pending", false)).toBe(false);
    expect(canConfirmNotarialIndex("review_required", false)).toBe(false);
  });

  it("allows confirming once complete, from ready_to_confirm or review_required", () => {
    expect(canConfirmNotarialIndex("ready_to_confirm", true)).toBe(true);
    expect(canConfirmNotarialIndex("review_required", true)).toBe(true);
  });

  it("never re-offers confirming an already-confirmed state", () => {
    expect(canConfirmNotarialIndex("confirmed", true)).toBe(false);
  });
});
