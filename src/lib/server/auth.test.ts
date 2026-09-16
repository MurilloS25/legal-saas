import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSessionMissingError } from "@supabase/supabase-js";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (callback: unknown) => callback }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { getWorkspaceAccess, requireApiUser } from "./auth";
import {
  DataAccessError,
  UnauthorizedError,
} from "./errors";

describe("requireApiUser", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps Supabase's missing-session result to UnauthorizedError", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new AuthSessionMissingError(),
        }),
      },
    });

    await expect(requireApiUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("keeps real authentication provider failures operational", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { code: "auth_provider_unavailable" },
        }),
      },
    });

    await expect(requireApiUser()).rejects.toBeInstanceOf(DataAccessError);
  });
});

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
