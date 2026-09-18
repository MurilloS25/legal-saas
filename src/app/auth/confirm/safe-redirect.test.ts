import { describe, expect, it } from "vitest";
import { extractSafeRedirectPath } from "./safe-redirect";

describe("extractSafeRedirectPath", () => {
  it.each([
    "/\\audit.example",
    "//audit.example/path",
    "https://audit.example/path",
    "https%3A%2F%2Faudit.example/path",
    "/%5C%5Caudit.example/path",
    "/%2F%2Faudit.example/path",
    "/%252F%252Faudit.example/path",
    "/https%3A%2F%2Faudit.example/path",
    "/javascript%3Aalert(1)",
    "/data%3Atext%2Fhtml%2Cunsafe",
  ])("rejects external or browser-normalized destination %s", (destination) => {
    expect(extractSafeRedirectPath(destination)).toBe("/dashboard");
  });

  it.each([
    ["/dashboard", "/dashboard"],
    ["/settings?tab=profile", "/settings?tab=profile"],
    ["/accept-invite#details", "/accept-invite#details"],
  ])("keeps internal destination %s", (destination, expected) => {
    expect(extractSafeRedirectPath(destination)).toBe(expected);
  });

  it("uses the dashboard when no destination is provided", () => {
    expect(extractSafeRedirectPath(null)).toBe("/dashboard");
  });
});
