import { describe, expect, it } from "vitest";
import {
  buildClientSearchFilter,
  clientsQueryToParams,
  normalizeIdentificationForSearch,
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

describe("normalizeIdentificationForSearch", () => {
  it("strips hyphens and whitespace and lowercases", () => {
    expect(normalizeIdentificationForSearch("3-101-123456")).toBe("3101123456");
    expect(normalizeIdentificationForSearch(" 3 101  123456 ")).toBe("3101123456");
    expect(normalizeIdentificationForSearch("1-0234-0567")).toBe("102340567");
    expect(normalizeIdentificationForSearch("AB-12")).toBe("ab12");
  });
});

describe("buildClientSearchFilter", () => {
  it("returns null without a search and empty string when nothing is searchable", () => {
    expect(buildClientSearchFilter("  ")).toBeNull();
    expect(buildClientSearchFilter(",.()")).toBe("");
  });

  it("searches only the name when the text has no digits", () => {
    expect(buildClientSearchFilter("sebastian")).toBe("full_name.ilike.%sebastian%");
  });

  it("searches the normalized identification for any spelling of the same number", () => {
    for (const typed of ["3101123456", "3-101-123456", "3 101 123456"]) {
      expect(buildClientSearchFilter(typed)).toBe(
        `full_name.ilike.%${typed}%,identification_search.ilike.%3101123456%`,
      );
    }
  });

  it("never spreads wildcards between digits", () => {
    const filter = buildClientSearchFilter("3101123456")!;
    expect(filter).not.toContain("%3%1%0%");
  });
});
