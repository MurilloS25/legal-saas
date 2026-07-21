import { describe, expect, it } from "vitest";
import {
  currentCostaRicaFortnight,
  fortnightForCostaRicaIso,
  fortnightRange,
  parseFortnightSelection,
} from "./fortnight";

describe("notarial fortnight", () => {
  it.each([
    ["2026-07-01T06:00:00.000Z", "FIRST_HALF"],
    ["2026-07-15T23:59:00.000Z", "FIRST_HALF"],
    ["2026-07-16T06:00:00.000Z", "SECOND_HALF"],
    ["2026-08-01T05:59:59.999Z", "SECOND_HALF"],
  ] as const)("classifies Costa Rica boundary %s", (iso, expected) => {
    expect(fortnightForCostaRicaIso(iso)).toBe(expected);
  });

  it("builds inclusive February ranges, including leap years", () => {
    expect(fortnightRange(2028, 2, "SECOND_HALF")).toEqual({
      fromIso: "2028-02-16T06:00:00.000Z",
      toIso: "2028-03-01T05:59:59.999Z",
    });
    expect(fortnightRange(2027, 2, "SECOND_HALF").toIso).toBe(
      "2027-03-01T05:59:59.999Z",
    );
  });

  it("accepts only bounded year, month, and known halves", () => {
    expect(parseFortnightSelection({ year: "2026", month: "7", half: "FIRST_HALF" })).toEqual({
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
    });
    expect(parseFortnightSelection({ year: "x", month: "13", half: "hack" })).toBeNull();
  });

  it("derives the current selection in Costa Rica", () => {
    expect(
      currentCostaRicaFortnight(new Date("2026-07-16T05:59:59.999Z")),
    ).toEqual({ year: 2026, month: 7, half: "FIRST_HALF" });
    expect(
      currentCostaRicaFortnight(new Date("2026-07-16T06:00:00.000Z")),
    ).toEqual({ year: 2026, month: 7, half: "SECOND_HALF" });
  });
});
