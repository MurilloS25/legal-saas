import { describe, expect, it } from "vitest";
import { findAdjacentVariableKey } from "./variable-navigation";

describe("findAdjacentVariableKey", () => {
  const keys = ["a", "b", "c"];

  it("returns the next key", () => {
    expect(findAdjacentVariableKey(keys, "a", 1)).toBe("b");
    expect(findAdjacentVariableKey(keys, "b", 1)).toBe("c");
  });

  it("returns the previous key", () => {
    expect(findAdjacentVariableKey(keys, "c", -1)).toBe("b");
    expect(findAdjacentVariableKey(keys, "b", -1)).toBe("a");
  });

  it("returns undefined past the last key", () => {
    expect(findAdjacentVariableKey(keys, "c", 1)).toBeUndefined();
  });

  it("returns undefined before the first key", () => {
    expect(findAdjacentVariableKey(keys, "a", -1)).toBeUndefined();
  });

  it("returns undefined when the current key is not in the list", () => {
    expect(findAdjacentVariableKey(keys, "z", 1)).toBeUndefined();
  });

  it("skips consecutive duplicate occurrences of the current key", () => {
    const withDuplicates = ["a", "a", "b", "c"];
    expect(findAdjacentVariableKey(withDuplicates, "a", 1)).toBe("b");
  });

  it("moves from a later occurrence of a repeated key using the first occurrence as the anchor", () => {
    // indexOf finds the first "a"; from there the next distinct key is "b".
    const repeated = ["a", "b", "a", "c"];
    expect(findAdjacentVariableKey(repeated, "a", 1)).toBe("b");
  });
});
