import { describe, expect, it } from "vitest";
import { stripSearchParams } from "./strip-search-params";

describe("stripSearchParams", () => {
  it("removes a single matching param", () => {
    expect(stripSearchParams("/receivables/1", "?created=1", [
      "created",
    ])).toBe("/receivables/1");
  });

  it("removes only the listed params, keeping the rest", () => {
    expect(
      stripSearchParams(
        "/documents/1",
        "?saved=1&section=receivables",
        ["saved"],
      ),
    ).toBe("/documents/1?section=receivables");
  });

  it("removes multiple params at once", () => {
    expect(
      stripSearchParams("/receivables/1", "?created=1&paid=1", [
        "created",
        "paid",
      ]),
    ).toBe("/receivables/1");
  });

  it("returns the original pathname+search unchanged when no param matches", () => {
    expect(
      stripSearchParams("/documents/1", "?section=receivables", [
        "saved",
      ]),
    ).toBe("/documents/1?section=receivables");
  });

  it("returns just the pathname when there is no search string at all", () => {
    expect(stripSearchParams("/templates/1", "", ["created"])).toBe(
      "/templates/1",
    );
  });

  it("is a no-op for an empty params list", () => {
    expect(
      stripSearchParams("/templates/1", "?created=1", []),
    ).toBe("/templates/1?created=1");
  });
});
