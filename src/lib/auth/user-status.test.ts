import { describe, expect, it } from "vitest";
import { isUserBanned } from "./user-status";

const NOW = new Date("2026-09-17T12:00:00.000Z");

describe("isUserBanned", () => {
  it("blocks a ban that is still active", () => {
    expect(isUserBanned({ banned_until: "2026-09-18T12:00:00.000Z" }, NOW)).toBe(true);
  });

  it("does not block absent, invalid, or expired bans", () => {
    expect(isUserBanned(null, NOW)).toBe(false);
    expect(isUserBanned({ banned_until: "invalid" }, NOW)).toBe(false);
    expect(isUserBanned({ banned_until: "2026-09-16T12:00:00.000Z" }, NOW)).toBe(false);
  });
});
