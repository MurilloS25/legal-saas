import { describe, expect, it } from "vitest";
import {
  NOTARIAL_PAGE_SIZE,
  notarialDateRangeIso,
  notarialQueryToParams,
  notarialSearchHasNoSafeTerm,
  notarialSearchTerm,
  parseNotarialQuery,
} from "./query";

const now = new Date("2026-07-16T14:00:00.000Z");

describe("parseNotarialQuery", () => {
  it("uses the current Costa Rica fortnight as a safe default", () => {
    expect(parseNotarialQuery({}, now)).toMatchObject({
      search: "",
      completeness: null,
      actType: null,
      selection: { year: 2026, month: 7, half: "SECOND_HALF" },
      page: 1,
      hasActiveFilters: false,
    });
  });

  it("accepts only a complete valid fortnight selection", () => {
    expect(
      parseNotarialQuery(
        { year: "2028", month: "2", half: "FIRST_HALF" },
        now,
      ).selection,
    ).toEqual({ year: 2028, month: 2, half: "FIRST_HALF" });
    expect(
      parseNotarialQuery(
        { year: "2028", month: "13", half: "hack" },
        now,
      ).selection,
    ).toEqual({ year: 2026, month: 7, half: "SECOND_HALF" });
  });

  it("accepts only known completeness filters", () => {
    expect(parseNotarialQuery({ completeness: "complete" }, now).completeness).toBe(
      "complete",
    );
    expect(parseNotarialQuery({ completeness: "bogus" }, now).completeness).toBeNull();
  });

  it("clamps the page", () => {
    expect(parseNotarialQuery({ page: "-2" }, now).page).toBe(1);
    expect(parseNotarialQuery({ page: "3" }, now).page).toBe(3);
  });
});

describe("notarialDateRangeIso", () => {
  it("uses inclusive Costa Rica fortnight boundaries", () => {
    const range = notarialDateRangeIso(
      parseNotarialQuery(
        { year: "2026", month: "7", half: "FIRST_HALF" },
        now,
      ),
    );
    expect(range.fromIso).toBe("2026-07-01T06:00:00.000Z");
    expect(range.toIso).toBe("2026-07-16T05:59:59.999Z");
  });
});

describe("helpers", () => {
  it("detects searches that sanitize to an empty PostgREST term", () => {
    expect(notarialSearchHasNoSafeTerm("%_(),'\"\\")).toBe(true);
    expect(notarialSearchHasNoSafeTerm("")).toBe(false);
    expect(notarialSearchTerm("Compraventa %")).toBe("Compraventa");
  });

  it("keeps the selected fortnight in links", () => {
    expect(
      notarialQueryToParams({
        selection: { year: 2026, month: 7, half: "FIRST_HALF" },
        completeness: "complete",
        page: 2,
      }),
    ).toEqual({
      year: "2026",
      month: "7",
      half: "FIRST_HALF",
      completeness: "complete",
      page: "2",
    });
  });

  it("uses a reasonable page size", () => {
    expect(NOTARIAL_PAGE_SIZE).toBeGreaterThan(0);
    expect(NOTARIAL_PAGE_SIZE).toBeLessThanOrEqual(50);
  });
});
