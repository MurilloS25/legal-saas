import { describe, expect, it, vi } from "vitest";
import { revokeAndClearSession } from "./logout";

describe("revokeAndClearSession", () => {
  it("clears the browser session after successful global revocation", async () => {
    const clearLocal = vi.fn().mockResolvedValue(undefined);
    const signOut = vi.fn().mockResolvedValue({ error: null });

    await revokeAndClearSession({ auth: { signOut } }, clearLocal);

    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(clearLocal).toHaveBeenCalledOnce();
  });

  it("still clears locally and logs only an error code when remote revocation fails", async () => {
    const clearLocal = vi.fn().mockResolvedValue(undefined);
    const warn = vi.fn();
    const signOut = vi.fn().mockResolvedValue({
      error: { code: "auth_provider_unavailable", message: "sensitive detail" },
    });

    await revokeAndClearSession({ auth: { signOut } }, clearLocal, warn);

    expect(clearLocal).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "[auth] global sign-out failed (auth_provider_unavailable)",
    );
    expect(warn.mock.calls.flat().join(" ")).not.toContain("sensitive detail");
  });
});
