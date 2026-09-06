import { describe, expect, it } from "vitest";
import { normalizePage, normalizePageSize, PAGE_SIZE_OPTIONS } from "./pagination";

describe("normalizePage", () => {
  it("defaults to 1 for missing, non-numeric, zero or negative values", () => {
    expect(normalizePage(undefined)).toBe(1);
    expect(normalizePage("")).toBe(1);
    expect(normalizePage("abc")).toBe(1);
    expect(normalizePage("0")).toBe(1);
    expect(normalizePage("-5")).toBe(1);
  });

  it("parses a valid positive integer", () => {
    expect(normalizePage("1")).toBe(1);
    expect(normalizePage("42")).toBe(42);
  });

  it("caps an absurdly large page at the safety ceiling", () => {
    expect(normalizePage("999999999")).toBe(100_000);
  });
});

describe("normalizePageSize", () => {
  it("exposes exactly the expected whitelist", () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([5, 10, 25, 50]);
  });

  it("falls back to the module default for missing or invalid values", () => {
    expect(normalizePageSize(undefined, 10)).toBe(10);
    expect(normalizePageSize("", 10)).toBe(10);
    expect(normalizePageSize("abc", 10)).toBe(10);
    // Not in the whitelist, even though it's a valid positive integer —
    // arbitrary page sizes are rejected, not clamped.
    expect(normalizePageSize("100", 10)).toBe(10);
    expect(normalizePageSize("7", 25)).toBe(25);
  });

  it("accepts any whitelisted option regardless of the module default", () => {
    for (const option of PAGE_SIZE_OPTIONS) {
      expect(normalizePageSize(String(option), 10)).toBe(option);
    }
  });
});
