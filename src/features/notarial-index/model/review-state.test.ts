import { describe, expect, it } from "vitest";
import { requiresNotarialReview } from "./review-state";

describe("requiresNotarialReview", () => {
  it("requires review when document content changed after metadata was saved", () => {
    expect(
      requiresNotarialReview(
        "2026-07-16T18:00:00.000Z",
        "2026-07-16T17:00:00.000Z",
      ),
    ).toBe(true);
  });

  it("does not require review when metadata is newer than document content", () => {
    expect(
      requiresNotarialReview(
        "2026-07-16T17:00:00.000Z",
        "2026-07-16T18:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("does not require review without a content update", () => {
    expect(requiresNotarialReview(null, "2026-07-16T18:00:00.000Z")).toBe(
      false,
    );
  });
});
