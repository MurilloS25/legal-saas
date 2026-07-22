import { describe, expect, it } from "vitest";
import { findAdjacentVariableOccurrence } from "./variable-navigation";

const occurrences = [
  { nodeId: "a-1", variableKey: "a" },
  { nodeId: "b-1", variableKey: "b" },
  { nodeId: "a-2", variableKey: "a" },
  { nodeId: "c-1", variableKey: "c" },
];

describe("findAdjacentVariableOccurrence", () => {
  it("anchors navigation to the concrete nodeId", () => {
    expect(findAdjacentVariableOccurrence(occurrences, "a-1", 1)).toEqual(
      occurrences[1],
    );
    expect(findAdjacentVariableOccurrence(occurrences, "a-2", 1)).toEqual(
      occurrences[3],
    );
  });

  it("moves backwards from the concrete occurrence", () => {
    expect(findAdjacentVariableOccurrence(occurrences, "a-2", -1)).toEqual(
      occurrences[1],
    );
  });

  it("skips adjacent occurrences that share the same value", () => {
    const adjacent = [
      { nodeId: "a-1", variableKey: "a" },
      { nodeId: "a-2", variableKey: "a" },
      { nodeId: "b-1", variableKey: "b" },
    ];
    expect(findAdjacentVariableOccurrence(adjacent, "a-1", 1)).toEqual(
      adjacent[2],
    );
  });

  it("returns undefined at a boundary or for an unknown node", () => {
    expect(
      findAdjacentVariableOccurrence(occurrences, "a-1", -1),
    ).toBeUndefined();
    expect(
      findAdjacentVariableOccurrence(occurrences, "c-1", 1),
    ).toBeUndefined();
    expect(
      findAdjacentVariableOccurrence(occurrences, "missing", 1),
    ).toBeUndefined();
  });
});
