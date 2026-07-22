import { describe, expect, it } from "vitest";
import {
  normalizeNotarialValue,
  NOTARIAL_SEMANTIC_TYPES,
} from "./normalization";

describe("notarial semantic destinations", () => {
  it("assigns a deterministic type to every supported destination", () => {
    expect(NOTARIAL_SEMANTIC_TYPES).toEqual({
      instrument_number: "integer",
      protocol_book: "integer",
      initial_folio: "integer",
      final_folio: "integer",
      authorized_date: "date",
      authorized_time: "time",
      act_name: "text",
      parties: "text",
    });
  });
});

describe("normalizeNotarialValue es-CR integers", () => {
  it.each([
    ["7", 7],
    ["07", 7],
    ["siete", 7],
    ["SIETE", 7],
    ["tomo siete", 7],
    ["tomo 7", 7],
    ["número siete", 7],
    ["numero siete", 7],
    ["veinticinco", 25],
    ["ciento treinta y dos", 132],
    ["dos mil veintiséis", 2026],
    ["novecientos noventa y nueve millones novecientos noventa y nueve mil novecientos noventa y nueve", 999_999_999],
  ])("normalizes %s", (value, expected) => {
    expect(
      normalizeNotarialValue({ value, type: "integer", locale: "es-CR" }),
    ).toMatchObject({ ok: true, value: expected });
  });

  it.each(["siete ocho", "uno dos tres", "7 8", "-7", "1.5", "1e3"])(
    "rejects %s without guessing",
    (value) => {
      expect(
        normalizeNotarialValue({ value, type: "integer", locale: "es-CR" }),
      ).toMatchObject({ ok: false, originalValue: value });
    },
  );

  it("rejects values outside the supported range", () => {
    expect(
      normalizeNotarialValue({
        value: "mil millones",
        type: "integer",
        locale: "es-CR",
      }),
    ).toMatchObject({ ok: false, reason: "out_of_range" });
  });
});

describe("normalizeNotarialValue es-CR dates", () => {
  it.each([
    ["25-06-2026", "2026-06-25"],
    ["25/06/2026", "2026-06-25"],
    ["25.06.2026", "2026-06-25"],
    ["2026-06-25", "2026-06-25"],
    ["25 de junio de 2026", "2026-06-25"],
    ["25 junio 2026", "2026-06-25"],
    ["veinticinco de junio de dos mil veintiséis", "2026-06-25"],
  ])("normalizes %s", (value, expected) => {
    expect(
      normalizeNotarialValue({ value, type: "date", locale: "es-CR" }),
    ).toMatchObject({ ok: true, value: expected });
  });

  it.each(["31 de febrero de 2026", "29/02/2025", "2026-13-01"])(
    "rejects invalid calendar date %s",
    (value) => {
      expect(
        normalizeNotarialValue({ value, type: "date", locale: "es-CR" }),
      ).toMatchObject({ ok: false, reason: "invalid" });
    },
  );
});

describe("normalizeNotarialValue es-CR times", () => {
  it.each([
    ["10:30", "10:30"],
    ["10.30", "10:30"],
    ["10 horas", "10:00"],
    ["10 horas con 30 minutos", "10:30"],
    ["diez horas", "10:00"],
    ["diez horas con treinta minutos", "10:30"],
  ])("normalizes %s", (value, expected) => {
    expect(
      normalizeNotarialValue({ value, type: "time", locale: "es-CR" }),
    ).toMatchObject({ ok: true, value: expected });
  });

  it.each(["25:90", "24 horas", "diez y treinta"])(
    "rejects invalid or unsupported time %s",
    (value) => {
      expect(
        normalizeNotarialValue({ value, type: "time", locale: "es-CR" }),
      ).toMatchObject({ ok: false });
    },
  );
});

describe("normalizeNotarialValue text", () => {
  it("trims without reinterpreting legal text", () => {
    expect(
      normalizeNotarialValue({
        value: "  Compraventa número 7  ",
        type: "text",
        locale: "es-CR",
      }),
    ).toEqual({
      ok: true,
      value: "Compraventa número 7",
      source: "structured",
    });
  });

  it("reports empty input consistently", () => {
    expect(
      normalizeNotarialValue({ value: "   ", type: "date", locale: "es-CR" }),
    ).toEqual({ ok: false, reason: "empty", originalValue: "   " });
  });
});
