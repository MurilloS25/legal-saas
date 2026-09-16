import { describe, expect, it } from "vitest";
import {
  buildPageSizeOptions,
  normalizePage,
  normalizePageSize,
  PAGE_SIZE_OPTIONS,
} from "./pagination";

describe("normalizePage", () => {
  it("defaults invalid pages to 1 and caps oversized pages", () => {
    for (const value of [undefined, "", "abc", "0", "-5"]) {
      expect(normalizePage(value)).toBe(1);
    }
    expect(normalizePage("42")).toBe(42);
    expect(normalizePage("999999999")).toBe(100_000);
  });
});

describe("normalizePageSize", () => {
  it("accepts exactly 5, 10, 25 and 50", () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([5, 10, 25, 50]);
    for (const option of PAGE_SIZE_OPTIONS) {
      expect(normalizePageSize(String(option))).toBe(option);
    }
  });

  it("defaults missing and invalid values to 10", () => {
    for (const value of [undefined, "", "abc", "0", "7", "100"]) {
      expect(normalizePageSize(value)).toBe(10);
    }
  });
});

describe("buildPageSizeOptions", () => {
  it("builds serializable links for every valid option", () => {
    expect(buildPageSizeOptions((value) => `/items?pageSize=${value}`)).toEqual([
      { value: 5, href: "/items?pageSize=5" },
      { value: 10, href: "/items?pageSize=10" },
      { value: 25, href: "/items?pageSize=25" },
      { value: 50, href: "/items?pageSize=50" },
    ]);
  });
});
