import { describe, expect, it } from "vitest";
import {
  DOCUMENTS_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  documentsQueryToParams,
  parseDocumentsQuery,
  sanitizeSearchTermForPostgrest,
  sortColumnFor,
} from "./workspace-query";

const UUID = "41111111-c000-0000-0000-000000000001";

describe("parseDocumentsQuery", () => {
  it("normalizes the shared page size whitelist", () => {
    expect(parseDocumentsQuery({}).pageSize).toBe(10);
    expect(parseDocumentsQuery({ pageSize: "5" }).pageSize).toBe(5);
    expect(parseDocumentsQuery({ pageSize: "25" }).pageSize).toBe(25);
    expect(parseDocumentsQuery({ pageSize: "50" }).pageSize).toBe(50);
    expect(parseDocumentsQuery({ pageSize: "12" }).pageSize).toBe(10);
  });
  it("returns safe defaults for an empty query", () => {
    const q = parseDocumentsQuery({});
    expect(q).toMatchObject({
      search: "",
      status: null,
      clientId: null,
      templateId: null,
      sort: "recent",
      page: 1,
      hasActiveFilters: false,
    });
  });

  it("trims and caps the search length", () => {
    const q = parseDocumentsQuery({ search: "  " + "a".repeat(200) });
    expect(q.search.length).toBe(MAX_SEARCH_LENGTH);
    expect(q.hasActiveFilters).toBe(true);
  });

  it("accepts only known statuses", () => {
    expect(parseDocumentsQuery({ status: "draft" }).status).toBe("draft");
    expect(parseDocumentsQuery({ status: "ready" }).status).toBe("ready");
    expect(parseDocumentsQuery({ status: "final" }).status).toBe("final");
    expect(parseDocumentsQuery({ status: "signed" }).status).toBeNull();
    expect(parseDocumentsQuery({ status: "'; drop" }).status).toBeNull();
  });

  it("accepts only valid UUIDs for client and template", () => {
    expect(parseDocumentsQuery({ client: UUID }).clientId).toBe(UUID);
    expect(parseDocumentsQuery({ client: "not-a-uuid" }).clientId).toBeNull();
    expect(parseDocumentsQuery({ template: UUID }).templateId).toBe(UUID);
    expect(parseDocumentsQuery({ template: "x" }).templateId).toBeNull();
  });

  it("falls back to the default sort for unknown values", () => {
    expect(parseDocumentsQuery({ sort: "title_az" }).sort).toBe("title_az");
    expect(parseDocumentsQuery({ sort: "updated_at; delete" }).sort).toBe("recent");
    expect(parseDocumentsQuery({ sort: undefined }).sort).toBe("recent");
  });

  it("clamps the page to a positive integer", () => {
    expect(parseDocumentsQuery({ page: "3" }).page).toBe(3);
    expect(parseDocumentsQuery({ page: "0" }).page).toBe(1);
    expect(parseDocumentsQuery({ page: "-5" }).page).toBe(1);
    expect(parseDocumentsQuery({ page: "abc" }).page).toBe(1);
  });
});

describe("sortColumnFor", () => {
  it("maps each sort value to a whitelisted column", () => {
    expect(sortColumnFor("recent")).toEqual({ column: "updated_at", ascending: false });
    expect(sortColumnFor("oldest")).toEqual({ column: "updated_at", ascending: true });
    expect(sortColumnFor("title_az")).toEqual({ column: "title", ascending: true });
    expect(sortColumnFor("title_za")).toEqual({ column: "title", ascending: false });
  });
});

describe("sanitizeSearchTermForPostgrest", () => {
  it("removes PostgREST filter punctuation while keeping normal text", () => {
    expect(
      sanitizeSearchTermForPostgrest(
        `  Cliente, "Ana" (VIP). 100%_ seguro: O'Connor  `,
      ),
    ).toBe("Cliente Ana VIP 100 seguro O Connor");
  });

  it("returns an empty string when the search only contains filter syntax", () => {
    expect(sanitizeSearchTermForPostgrest(`%,._()'"\\`)).toBe("");
  });

  it("neutralizes a PostgREST OR-filter injection payload", () => {
    expect(
      sanitizeSearchTermForPostgrest("x%,workspace_id.eq.attacker),title.ilike.%"),
    ).toBe("x workspace id eq attacker title ilike");
  });
});

describe("documentsQueryToParams", () => {
  it("omits defaults and empty values", () => {
    expect(documentsQueryToParams({ sort: "recent", page: 1 })).toEqual({});
    expect(
      documentsQueryToParams({
        search: "compra",
        status: "draft",
        clientId: UUID,
        sort: "title_az",
        page: 2,
      }),
    ).toEqual({
      search: "compra",
      status: "draft",
      client: UUID,
      sort: "title_az",
      page: "2",
    });
  });
});

describe("constants", () => {
  it("uses a reasonable page size", () => {
    expect(DOCUMENTS_PAGE_SIZE).toBeGreaterThan(0);
    expect(DOCUMENTS_PAGE_SIZE).toBeLessThanOrEqual(50);
  });
});
