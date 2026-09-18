import { describe, expect, it } from "vitest";
import {
  NOTARIAL_DATE_FILTER_COLUMN,
  NOTARIAL_PAGE_SIZE,
  notarialDateRangeIso,
  notarialQueryToParams,
  notarialSearchHasNoSafeTerm,
  notarialSearchTerm,
  parseNotarialQuery,
} from "./query";

const now = new Date("2026-07-16T14:00:00.000Z");

describe("parseNotarialQuery", () => {
  it("normalizes the shared page size whitelist", () => {
    expect(parseNotarialQuery({}, now).pageSize).toBe(10);
    expect(parseNotarialQuery({ pageSize: "5" }, now).pageSize).toBe(5);
    expect(parseNotarialQuery({ pageSize: "50" }, now).pageSize).toBe(50);
    expect(parseNotarialQuery({ pageSize: "12" }, now).pageSize).toBe(10);
  });
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

describe("NOTARIAL_DATE_FILTER_COLUMN", () => {
  it("filters by effective_index_date, not authorized_at directly", () => {
    // effective_index_date (authorized_at ?? created_at, calculado en la
    // vista notarial_index_entries) nunca es NULL, así que un .gte()/.lte()
    // encadenado ya no excluye las Escrituras incluidas sin fecha de
    // autorización real — a diferencia del bug original que este archivo
    // cubría contra `authorized_at` crudo.
    expect(NOTARIAL_DATE_FILTER_COLUMN).toBe("effective_index_date");
  });
});

describe("helpers", () => {
  it("detects searches that sanitize to an empty PostgREST term", () => {
    expect(notarialSearchHasNoSafeTerm("%_(),'\"\\")).toBe(true);
    expect(notarialSearchHasNoSafeTerm("")).toBe(false);
    expect(notarialSearchTerm("Compraventa %")).toBe("Compraventa");
    expect(
      notarialSearchTerm("x%,workspace_id.eq.attacker),title.ilike.%"),
    ).toBe("x workspace id eq attacker title ilike");
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
