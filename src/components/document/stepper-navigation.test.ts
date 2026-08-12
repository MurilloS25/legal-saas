import { describe, expect, it } from "vitest";
import { hasNavigableStep, nextNavigableStepId } from "./stepper-navigation";

type Id = "a" | "b" | "c" | "d" | "e";

function steps(overrides: Partial<Record<Id, "complete" | "current" | "upcoming" | "locked">> = {}) {
  const base: Record<Id, "complete" | "current" | "upcoming" | "locked"> = {
    a: "complete",
    b: "current",
    c: "upcoming",
    d: "locked",
    e: "locked",
  };
  const merged = { ...base, ...overrides };
  return (Object.keys(merged) as Id[]).map((id) => ({ id, status: merged[id] }));
}

describe("nextNavigableStepId", () => {
  it("moves forward to the next unlocked step", () => {
    expect(nextNavigableStepId(steps(), "b", 1, true)).toBe("c");
  });

  it("moves backward to the previous unlocked step", () => {
    expect(nextNavigableStepId(steps(), "b", -1, true)).toBe("a");
  });

  it("skips locked steps without wrapping past the end", () => {
    expect(nextNavigableStepId(steps(), "c", 1, false)).toBeNull();
  });

  it("wraps around when wrap=true", () => {
    // from "c" going forward skips locked d/e and wraps to a
    expect(nextNavigableStepId(steps(), "c", 1, true)).toBe("a");
    expect(nextNavigableStepId(steps({ e: "upcoming" }), "d", 1, true)).toBe("e");
  });

  it("does not wrap when wrap=false", () => {
    expect(nextNavigableStepId(steps(), "a", -1, false)).toBeNull();
  });

  it("returns null for an id not present in the list", () => {
    expect(nextNavigableStepId(steps(), "z" as Id, 1, true)).toBeNull();
  });

  it("returns null when every other step is locked", () => {
    const onlyOneOpen = steps({ a: "locked", c: "locked" });
    expect(nextNavigableStepId(onlyOneOpen, "b", 1, true)).toBeNull();
  });
});

describe("hasNavigableStep", () => {
  it("is true when a non-locked step exists ahead", () => {
    expect(hasNavigableStep(steps(), "a", 1)).toBe(true);
  });

  it("is false when only locked steps remain ahead", () => {
    expect(hasNavigableStep(steps(), "c", 1)).toBe(false);
  });

  it("is false at the first step going backward", () => {
    expect(hasNavigableStep(steps(), "a", -1)).toBe(false);
  });
});
