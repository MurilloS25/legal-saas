import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./same-origin";

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe("isSameOriginRequest", () => {
  it("accepts a request whose Origin matches the host", () => {
    expect(
      isSameOriginRequest(headers({ origin: "http://localhost:3000", host: "localhost:3000" })),
    ).toBe(true);
  });

  it("prefers x-forwarded-host behind a proxy", () => {
    expect(
      isSameOriginRequest(
        headers({
          origin: "https://app.example.test",
          host: "internal:3000",
          "x-forwarded-host": "app.example.test",
        }),
      ),
    ).toBe(true);
  });

  it("rejects a cross-site origin", () => {
    expect(
      isSameOriginRequest(headers({ origin: "https://evil.example", host: "app.example.test" })),
    ).toBe(false);
  });

  it("rejects requests without Origin or with a malformed Origin", () => {
    expect(isSameOriginRequest(headers({ host: "app.example.test" }))).toBe(false);
    expect(isSameOriginRequest(headers({ origin: "null", host: "app.example.test" }))).toBe(false);
  });
});
