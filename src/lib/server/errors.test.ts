import { describe, expect, it, vi } from "vitest";
import {
  DataAccessError,
  UnauthorizedError,
  publicErrorDetails,
  throwDataAccessError,
} from "./errors";

describe("server errors", () => {
  it("keeps a safe unauthorized message", () => {
    const error = new UnauthorizedError();

    expect(error.code).toBe("unauthorized");
    expect(error.safeMessage).toBe("No autorizado.");
    expect(publicErrorDetails(error)).toEqual({
      message: "No autorizado.",
      status: 401,
    });
  });

  it("throws an explicit data access error without logging details", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = { code: "PGRST000", details: "sensitive query detail" };

    expect(() => throwDataAccessError("list receivables", cause)).toThrow(
      DataAccessError,
    );
    expect(consoleError).toHaveBeenCalledWith(
      "[data-access] list receivables failed (PGRST000)",
    );
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining(cause.details),
    );

    consoleError.mockRestore();
  });
});
