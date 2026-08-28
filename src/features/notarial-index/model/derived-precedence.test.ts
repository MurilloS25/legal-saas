import { describe, expect, it } from "vitest";
import { resolveDerivedPrecedence } from "./derived-precedence";

describe("resolveDerivedPrecedence", () => {
  it("refreshes to the fresh derivation when nothing was ever saved", () => {
    const result = resolveDerivedPrecedence(null, null, "11:00");
    expect(result).toEqual({
      value: "11:00",
      isManualOverride: false,
      sourceChanged: false,
    });
  });

  it("refreshes to the fresh derivation when the saved value still matches the last known derivation (untouched by hand)", () => {
    const result = resolveDerivedPrecedence("10:00", "10:00", "11:00");
    expect(result).toEqual({
      value: "11:00",
      isManualOverride: false,
      sourceChanged: false,
    });
  });

  it("keeps refreshing when the source hasn't changed either", () => {
    const result = resolveDerivedPrecedence("10:00", "10:00", "10:00");
    expect(result).toEqual({
      value: "10:00",
      isManualOverride: false,
      sourceChanged: false,
    });
  });

  it("preserves a manual correction when the source hasn't changed since", () => {
    const result = resolveDerivedPrecedence("10:30", "10:00", "10:00");
    expect(result).toEqual({
      value: "10:30",
      isManualOverride: true,
      sourceChanged: false,
    });
  });

  it("preserves a manual correction but flags sourceChanged when the source diverged since the correction", () => {
    const result = resolveDerivedPrecedence("10:30", "10:00", "11:00");
    expect(result).toEqual({
      value: "10:30",
      isManualOverride: true,
      sourceChanged: true,
    });
  });

  it("never invents a value when nothing can be derived and nothing was saved", () => {
    const result = resolveDerivedPrecedence(null, null, null);
    expect(result).toEqual({
      value: null,
      isManualOverride: false,
      sourceChanged: false,
    });
  });
});
