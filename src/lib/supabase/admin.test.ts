import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AdminConfigurationError,
  createAdminClient,
  findUserIdByEmail,
} from "./admin";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;

  if (originalServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
});

describe("Supabase Admin API configuration", () => {
  it("fails with a typed operational error when the service-role key is absent", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => createAdminClient()).toThrow(AdminConfigurationError);
  });

  it("does not attempt an Admin API request when configuration is absent", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(findUserIdByEmail("member@example.com")).rejects.toBeInstanceOf(
      AdminConfigurationError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
