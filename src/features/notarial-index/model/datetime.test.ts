import { describe, expect, it } from "vitest";
import {
  costaRicaLocalToIso,
  formatCostaRicaDate,
  formatCostaRicaTime,
  isoToCostaRicaLocal,
} from "./datetime";

describe("costaRicaLocalToIso", () => {
  it("interprets the wall-clock value as Costa Rica time (UTC-6)", () => {
    // 10:35 en CR = 16:35 UTC.
    expect(costaRicaLocalToIso("2026-07-13T10:35")).toBe(
      "2026-07-13T16:35:00.000Z",
    );
  });

  it("returns null for empty or malformed values", () => {
    expect(costaRicaLocalToIso("")).toBeNull();
    expect(costaRicaLocalToIso("   ")).toBeNull();
    expect(costaRicaLocalToIso("13/07/2026")).toBeNull();
    expect(costaRicaLocalToIso("2026-13-40T99:99")).toBeNull();
  });
});

describe("isoToCostaRicaLocal", () => {
  it("round-trips with costaRicaLocalToIso", () => {
    const local = "2026-07-13T10:35";
    const iso = costaRicaLocalToIso(local)!;
    expect(isoToCostaRicaLocal(iso)).toBe(local);
  });

  it("converts a UTC instant to Costa Rica wall clock", () => {
    // 00:30 UTC = 18:30 del día anterior en CR.
    expect(isoToCostaRicaLocal("2026-07-14T00:30:00.000Z")).toBe(
      "2026-07-13T18:30",
    );
  });

  it("returns an empty string for null or invalid input", () => {
    expect(isoToCostaRicaLocal(null)).toBe("");
    expect(isoToCostaRicaLocal("not-a-date")).toBe("");
  });
});

describe("formatCostaRicaDate / Time", () => {
  it("formats date and time in Costa Rica", () => {
    const iso = "2026-07-13T16:35:00.000Z"; // 10:35 CR
    expect(formatCostaRicaTime(iso)).toBe("10:35");
    expect(formatCostaRicaDate(iso)).toMatch(/2026/);
    expect(formatCostaRicaDate(iso)).toMatch(/13/);
  });

  it("returns empty strings for null", () => {
    expect(formatCostaRicaDate(null)).toBe("");
    expect(formatCostaRicaTime(null)).toBe("");
  });
});
