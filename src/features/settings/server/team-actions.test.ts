import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({
  requireWorkspace: vi.fn(async () => ({
    role: "propietario",
    workspaceId: "workspace-a",
    supabase: {},
  })),
}));
vi.mock("@/lib/server/permissions", () => ({
  hasPermission: vi.fn(() => true),
  INVITABLE_ROLES: ["administrador", "asistente", "solo_lectura"],
}));
vi.mock("@/lib/supabase/admin", () => {
  class AdminConfigurationError extends Error {}
  return {
    AdminConfigurationError,
    createAdminClient: vi.fn(() => {
      throw new AdminConfigurationError();
    }),
    findUserIdByEmail: vi.fn(),
  };
});

import { inviteMemberAction } from "./team-actions";

describe("inviteMemberAction", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns a controlled message when the server-only Admin API secret is absent", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const formData = new FormData();
    formData.set("email", "member@example.com");
    formData.set("role", "asistente");

    await expect(inviteMemberAction({}, formData)).resolves.toEqual({
      message:
        "Las invitaciones no están disponibles temporalmente. Contacta al administrador del sistema.",
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      "[team-invite] Supabase Admin API is not configured",
    );
  });
});
