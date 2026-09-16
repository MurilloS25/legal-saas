import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import {
  AUXILIARY_QUERY_LIMIT,
  ensureWithinResultLimit,
} from "./bounded-results";

describe("ensureWithinResultLimit", () => {
  it("returns a bounded auxiliary result unchanged", () => {
    expect(ensureWithinResultLimit([1, 2], 2, "clientes")).toEqual([1, 2]);
  });

  it("fails explicitly when the sentinel row proves truncation", () => {
    expect(() =>
      ensureWithinResultLimit(
        Array.from({ length: AUXILIARY_QUERY_LIMIT + 1 }, (_, index) => index),
        AUXILIARY_QUERY_LIMIT,
        "clientes",
      ),
    ).toThrow(ValidationError);
  });
});
