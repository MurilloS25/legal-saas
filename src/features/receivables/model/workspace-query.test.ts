import { describe, expect, it } from "vitest";
import {
  parseReceivablesQuery,
  receivablesQueryToParams,
  searchHasNoSafeTerm,
  sanitizeSearchTermForPostgrest,
} from "./workspace-query";

describe("parseReceivablesQuery", () => {
  it("defaults to an empty, unfiltered first page", () => {
    const q = parseReceivablesQuery({});
    expect(q.page).toBe(1);
    expect(q.sort).toBe("recent");
    expect(q.hasActiveFilters).toBe(false);
    expect(q.status).toBeNull();
    expect(q.currency).toBeNull();
  });

  it("keeps valid filters and drops invalid ones", () => {
    const q = parseReceivablesQuery({
      status: "overdue",
      currency: "USD",
      doc: "with",
      client: "41111111-c000-0000-0000-000000000001",
      document: "not-a-uuid",
      issued_from: "2026-01-01",
      issued_to: "bad-date",
      due_from: "2026-06-01",
      sort: "amount_high",
      page: "3",
    });
    expect(q.status).toBe("overdue");
    expect(q.currency).toBe("USD");
    expect(q.docPresence).toBe("with");
    expect(q.clientId).toBe("41111111-c000-0000-0000-000000000001");
    expect(q.documentId).toBeNull();
    expect(q.issuedFrom).toBe("2026-01-01");
    expect(q.issuedTo).toBeNull();
    expect(q.dueFrom).toBe("2026-06-01");
    expect(q.sort).toBe("amount_high");
    expect(q.page).toBe(3);
    expect(q.hasActiveFilters).toBe(true);
  });

  it("rejects unknown status, currency and doc presence", () => {
    const q = parseReceivablesQuery({
      status: "cancelled",
      currency: "EUR",
      doc: "maybe",
    });
    expect(q.status).toBeNull();
    expect(q.currency).toBeNull();
    expect(q.docPresence).toBeNull();
    expect(q.hasActiveFilters).toBe(false);
  });

  it("clamps invalid pages to 1", () => {
    expect(parseReceivablesQuery({ page: "0" }).page).toBe(1);
    expect(parseReceivablesQuery({ page: "-5" }).page).toBe(1);
    expect(parseReceivablesQuery({ page: "abc" }).page).toBe(1);
  });
});

describe("receivablesQueryToParams", () => {
  it("omits defaults and empty values", () => {
    const params = receivablesQueryToParams(parseReceivablesQuery({}));
    expect(params).toEqual({});
  });

  it("serializes active filters for shareable URLs", () => {
    const params = receivablesQueryToParams(
      parseReceivablesQuery({ status: "partial", currency: "CRC", page: "2" }),
    );
    expect(params).toEqual({ status: "partial", currency: "CRC", page: "2" });
  });
});

describe("sanitizeSearchTermForPostgrest", () => {
  it("strips PostgREST filter punctuation", () => {
    expect(sanitizeSearchTermForPostgrest("a,b.c()%_'\"")).toBe("a b c");
    expect(sanitizeSearchTermForPostgrest("  Honorarios  2026 ")).toBe(
      "Honorarios 2026",
    );
  });

  it("detects searches that sanitize to an empty term", () => {
    expect(searchHasNoSafeTerm("%_(),'\"\\")).toBe(true);
    expect(searchHasNoSafeTerm("   % _ ( )   ")).toBe(true);
    expect(searchHasNoSafeTerm("")).toBe(false);
    expect(searchHasNoSafeTerm("Honorarios %")).toBe(false);
  });
});
