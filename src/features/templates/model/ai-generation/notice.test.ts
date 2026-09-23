import { describe, expect, it } from "vitest";
import { aiNoticeState } from "./notice";

describe("aiNoticeState", () => {
  it("is pending review right after generation (created before the ledger closed)", () => {
    expect(
      aiNoticeState({
        templateUpdatedAt: "2026-09-23T20:00:00.100Z",
        generatedAt: "2026-09-23T20:00:00.400Z",
      }),
    ).toBe("pending_review");
  });

  it("is reviewed once the Machote was saved with changes after generation", () => {
    expect(
      aiNoticeState({
        templateUpdatedAt: "2026-09-23T20:05:00.000Z",
        generatedAt: "2026-09-23T20:00:00.400Z",
      }),
    ).toBe("reviewed");
  });

  it("falls back to pending review on unparseable timestamps", () => {
    expect(aiNoticeState({ templateUpdatedAt: "x", generatedAt: "y" })).toBe("pending_review");
  });
});
