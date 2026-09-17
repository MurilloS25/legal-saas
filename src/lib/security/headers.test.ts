import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, buildSecurityHeaders } from "./headers";

describe("security headers", () => {
  it("denies framing and limits Supabase connections in production", () => {
    const csp = buildContentSecurityPolicy(true);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("allows the Next development runtime without weakening production", () => {
    expect(buildContentSecurityPolicy(false)).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy(false)).toContain("http://127.0.0.1:*");
  });

  it("adds MIME, referrer and browser capability policies", () => {
    expect(buildSecurityHeaders(true)).toEqual(
      expect.arrayContaining([
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ]),
    );
  });
});
