import { describe, expect, it } from "vitest";
import { isResourceId, ResourceIdSchema } from "./resource-id";

describe("resource ids", () => {
  it("accepts UUID-shaped resource identifiers", () => {
    const id = "41111111-c000-0000-0000-000000000001";

    expect(isResourceId(id)).toBe(true);
    expect(ResourceIdSchema.safeParse(id).success).toBe(true);
  });

  it.each(["neww", "41111111-c000", "", "  "])(
    "rejects %j before it reaches a UUID database column",
    (id) => {
      expect(isResourceId(id)).toBe(false);
    },
  );
});
