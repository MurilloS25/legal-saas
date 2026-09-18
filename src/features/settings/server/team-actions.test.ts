import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  inviteUserByEmail: vi.fn(),
  deleteUser: vi.fn(),
  findUserIdByEmail: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "localhost:3000" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({
  requireWorkspace: vi.fn(async () => ({
    role: "propietario",
    workspaceId: "workspace-a",
    supabase: { rpc: mocks.rpc },
  })),
}));
vi.mock("@/lib/server/permissions", () => ({
  hasPermission: vi.fn(() => true),
  INVITABLE_ROLES: ["administrador", "asistente", "solo_lectura"],
}));
vi.mock("@/lib/supabase/admin", () => {
  class AdminConfigurationError extends Error {}
  class AdminRequestError extends Error {}
  return {
    AdminConfigurationError,
    AdminRequestError,
    createAdminClient: mocks.createAdminClient,
    findUserIdByEmail: mocks.findUserIdByEmail,
  };
});

import {
  AdminConfigurationError,
  AdminRequestError,
} from "@/lib/supabase/admin";
import { inviteMemberAction } from "./team-actions";

function input(): FormData {
  const formData = new FormData();
  formData.set("email", "member@example.com");
  formData.set("role", "asistente");
  return formData;
}

describe("inviteMemberAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAdminClient.mockReturnValue({
      auth: {
        admin: {
          inviteUserByEmail: mocks.inviteUserByEmail,
          deleteUser: mocks.deleteUser,
        },
      },
    });
    mocks.findUserIdByEmail.mockResolvedValue(null);
    mocks.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: "new-user" } },
      error: null,
    });
    mocks.deleteUser.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("returns a controlled message when the Admin API is absent", async () => {
    mocks.createAdminClient.mockImplementation(() => {
      throw new AdminConfigurationError();
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(inviteMemberAction({}, input())).resolves.toEqual({
      message:
        "Las invitaciones no están disponibles temporalmente. Contacta al administrador del sistema.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[team-invite] Supabase Admin API is not configured",
    );
  });

  it("does not invite when the existing-user lookup fails", async () => {
    mocks.findUserIdByEmail.mockRejectedValue(new AdminRequestError());
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(inviteMemberAction({}, input())).resolves.toMatchObject({
      message:
        "Las invitaciones no están disponibles temporalmente. Contacta al administrador del sistema.",
    });
    expect(mocks.inviteUserByEmail).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[team-invite] Supabase Admin API lookup failed",
    );
  });

  it("registers an existing user without sending or deleting an Auth invitation", async () => {
    mocks.findUserIdByEmail.mockResolvedValue("existing-user");

    await expect(inviteMemberAction({}, input())).resolves.toMatchObject({ success: true });
    expect(mocks.inviteUserByEmail).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("invite_workspace_member", {
      p_user_id: "existing-user",
      p_role: "asistente",
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("compensates only a user created by this attempt when DB registration fails", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "XX000" } });

    await expect(inviteMemberAction({}, input())).resolves.toMatchObject({
      message: "No fue posible registrar la invitación. Intenta de nuevo.",
    });
    expect(mocks.deleteUser).toHaveBeenCalledWith("new-user");
  });

  it("never deletes an existing user when DB registration fails", async () => {
    mocks.findUserIdByEmail.mockResolvedValue("existing-user");
    mocks.rpc.mockResolvedValue({ error: { code: "XX000" } });

    await inviteMemberAction({}, input());
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("treats email_exists races as existing accounts and never compensates them", async () => {
    mocks.findUserIdByEmail
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("raced-user");
    mocks.inviteUserByEmail.mockResolvedValue({
      data: { user: null },
      error: { code: "email_exists" },
    });
    mocks.rpc.mockResolvedValue({ error: { code: "XX000" } });

    await inviteMemberAction({}, input());
    expect(mocks.rpc).toHaveBeenCalledWith("invite_workspace_member", {
      p_user_id: "raced-user",
      p_role: "asistente",
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("leaves a failed compensation observable and allows a later retry", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.rpc
      .mockResolvedValueOnce({ error: { code: "XX000" } })
      .mockResolvedValueOnce({ error: null });
    mocks.deleteUser.mockResolvedValue({ error: { code: "provider_failure" } });
    mocks.findUserIdByEmail
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("new-user");

    await inviteMemberAction({}, input());
    await expect(inviteMemberAction({}, input())).resolves.toMatchObject({ success: true });

    expect(mocks.inviteUserByEmail).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[team-invite] Auth compensation failed (provider_failure)",
    );
  });
});
