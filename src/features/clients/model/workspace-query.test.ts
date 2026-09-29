import { describe, expect, it } from "vitest";
import {
  buildClientSearchFilter,
  clientsQueryToParams,
  parseClientsQuery,
  sanitizeClientSearchTerm,
} from "./workspace-query";

describe("parseClientsQuery", () => {
  it("trims and bounds the search text", () => {
    expect(parseClientsQuery({ q: "  ana  " }).q).toBe("ana");
    expect(parseClientsQuery({ q: "x".repeat(500) }).q).toHaveLength(100);
    expect(parseClientsQuery({}).q).toBe("");
  });
});

describe("clientsQueryToParams", () => {
  it("keeps q in pagination links and omits defaults", () => {
    expect(clientsQueryToParams({ q: "ana", page: 3 })).toEqual({ q: "ana", page: "3" });
    expect(clientsQueryToParams({ q: "", page: 1 })).toEqual({});
  });
});

describe("sanitizeClientSearchTerm", () => {
  it("drops characters that would break the PostgREST filter", () => {
    expect(sanitizeClientSearchTerm("a,b(c)%_.\"d")).toBe("a b c d");
    expect(sanitizeClientSearchTerm("3-101-123456")).toBe("3-101-123456");
    expect(sanitizeClientSearchTerm("José  Núñez")).toBe("José Núñez");
  });
});

describe("buildClientSearchFilter", () => {
  it("returns null without a search and empty string when nothing is searchable", () => {
    expect(buildClientSearchFilter("  ")).toBeNull();
    expect(buildClientSearchFilter(",.()")).toBe("");
  });

  it("searches name and identification", () => {
    expect(buildClientSearchFilter("sebastian")).toBe(
      "full_name.ilike.%sebastian%,identification_number.ilike.%sebastian%",
    );
  });

  it("tolerates missing hyphens in identifications", () => {
    const filter = buildClientSearchFilter("3101123456")!;
    expect(filter).toContain("identification_number.ilike.%3%1%0%1%1%2%3%4%5%6%");
  });

  it("matches hyphenated input as typed and also tolerant", () => {
    const filter = buildClientSearchFilter("3-101-123456")!;
    expect(filter).toContain("identification_number.ilike.%3-101-123456%");
    expect(filter).toContain("%3%1%0%1%1%2%3%4%5%6%");
  });

  it("does not add the tolerant pattern for short or non-numeric terms", () => {
    expect(buildClientSearchFilter("310")).not.toContain("%3%1%0%");
    expect(buildClientSearchFilter("ab12345")).not.toContain("%a%b%");
  });
});
