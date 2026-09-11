import { describe, expect, it, vi } from "vitest";
import { DataAccessError } from "./errors";
import { getWorkspaceAccess } from "./auth";

function workspaceClient(result: {
  data: Array<{ workspace_id: string; role: string; status: string }> | null;
  error: { code?: string } | null;
}) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(async () => result),
  };
  return { from: vi.fn(() => query) };
}

describe("getWorkspaceAccess", () => {
  it("does not convert a membership query failure into no workspace access", async () => {
    const supabase = workspaceClient({
      data: null,
      error: { code: "08006" },
    });

    await expect(
      getWorkspaceAccess(supabase as never, "query-error-user"),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("keeps an empty successful membership query as legitimate absence", async () => {
    const supabase = workspaceClient({ data: [], error: null });

    await expect(
      getWorkspaceAccess(supabase as never, "no-membership-user"),
    ).resolves.toEqual({ kind: "none" });
  });
});
