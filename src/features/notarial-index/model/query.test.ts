import { describe, expect, it } from "vitest";
import {
  NOTARIAL_PAGE_SIZE,
  notarialDateRangeIso,
  notarialQueryToParams,
  notarialSearchHasNoSafeTerm,
  notarialSearchTerm,
  notarialSortAscending,
  parseNotarialQuery,
} from "./query";

describe("parseNotarialQuery", () => {
  it("returns safe defaults", () => {
    expect(parseNotarialQuery({})).toMatchObject({
      search: "",
      completeness: null,
      actType: null,
      from: null,
      to: null,
      sort: "recent",
      page: 1,
      hasActiveFilters: false,
    });
  });

  it("accepts only known completeness filters", () => {
    expect(parseNotarialQuery({ completeness: "complete" }).completeness).toBe(
      "complete",
    );
    expect(parseNotarialQuery({ completeness: "missing" }).completeness).toBe(
      "missing",
    );
    expect(parseNotarialQuery({ completeness: "bogus" }).completeness).toBeNull();
  });

  it("accepts only YYYY-MM-DD dates", () => {
    expect(parseNotarialQuery({ from: "2026-07-01" }).from).toBe("2026-07-01");
    expect(parseNotarialQuery({ from: "07/2026" }).from).toBeNull();
    expect(parseNotarialQuery({ to: "not-a-date" }).to).toBeNull();
  });

  it("clamps the page and validates sort", () => {
    expect(parseNotarialQuery({ page: "-2" }).page).toBe(1);
    expect(parseNotarialQuery({ page: "3" }).page).toBe(3);
    expect(parseNotarialQuery({ sort: "oldest" }).sort).toBe("oldest");
    expect(parseNotarialQuery({ sort: "hack" }).sort).toBe("recent");
  });

  it("flags active filters", () => {
    expect(parseNotarialQuery({ act_type: "Compraventa" }).hasActiveFilters).toBe(
      true,
    );
  });
});

describe("notarialDateRangeIso", () => {
  it("converts CR day boundaries to UTC ISO", () => {
    const range = notarialDateRangeIso(
      parseNotarialQuery({ from: "2026-07-01", to: "2026-07-31" }),
    );
    // 2026-07-01 00:00 CR = 06:00 UTC.
    expect(range.fromIso).toBe("2026-07-01T06:00:00.000Z");
    // 2026-07-31 23:59:59.999 CR = 2026-08-01 05:59:59.999 UTC.
    expect(range.toIso).toBe("2026-08-01T05:59:59.999Z");
  });

  it("returns nulls without dates", () => {
    expect(notarialDateRangeIso(parseNotarialQuery({}))).toEqual({
      fromIso: null,
      toIso: null,
    });
  });
});

describe("helpers", () => {
  it("detects searches that sanitize to an empty PostgREST term", () => {
    expect(notarialSearchHasNoSafeTerm("%_(),'\"\\")).toBe(true);
    expect(notarialSearchHasNoSafeTerm("   % _ ( )   ")).toBe(true);
    expect(notarialSearchHasNoSafeTerm("")).toBe(false);
    expect(notarialSearchHasNoSafeTerm("Compraventa %")).toBe(false);
    expect(notarialSearchTerm("Compraventa %")).toBe("Compraventa");
  });

  it("maps sort to ascending", () => {
    expect(notarialSortAscending("recent")).toBe(false);
    expect(notarialSortAscending("oldest")).toBe(true);
  });

  it("omits defaults in params", () => {
    expect(notarialQueryToParams({ sort: "recent", page: 1 })).toEqual({});
    expect(
      notarialQueryToParams({ completeness: "complete", from: "2026-07-01", page: 2 }),
    ).toEqual({ completeness: "complete", from: "2026-07-01", page: "2" });
  });

  it("uses a reasonable page size", () => {
    expect(NOTARIAL_PAGE_SIZE).toBeGreaterThan(0);
    expect(NOTARIAL_PAGE_SIZE).toBeLessThanOrEqual(50);
  });
});
