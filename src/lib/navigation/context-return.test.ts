import { describe, expect, it } from "vitest";
import {
  appendReturnTo,
  buildDocumentReceivablesReturnTo,
  parseDocumentReceivablesReturnTo,
} from "./context-return";

const VALID_ID = "8a25f803-4f2f-4fe4-83f4-0cedc24903f4";

describe("buildDocumentReceivablesReturnTo", () => {
  it("builds the canonical return path for a document", () => {
    expect(buildDocumentReceivablesReturnTo(VALID_ID)).toBe(
      `/dashboard/documents/${VALID_ID}?section=cobro`,
    );
  });
});

describe("parseDocumentReceivablesReturnTo", () => {
  it("accepts a value built by buildDocumentReceivablesReturnTo", () => {
    const built = buildDocumentReceivablesReturnTo(VALID_ID);
    expect(parseDocumentReceivablesReturnTo(built)).toBe(built);
  });

  it("rejects null and undefined", () => {
    expect(parseDocumentReceivablesReturnTo(null)).toBeNull();
    expect(parseDocumentReceivablesReturnTo(undefined)).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(parseDocumentReceivablesReturnTo("")).toBeNull();
  });

  it("rejects external URLs (http/https)", () => {
    expect(
      parseDocumentReceivablesReturnTo("https://example.com"),
    ).toBeNull();
    expect(
      parseDocumentReceivablesReturnTo(
        `http://evil.example.com/dashboard/documents/${VALID_ID}?section=cobro`,
      ),
    ).toBeNull();
  });

  it("rejects protocol-relative URLs", () => {
    expect(parseDocumentReceivablesReturnTo("//example.com")).toBeNull();
  });

  it("rejects javascript: URLs", () => {
    expect(parseDocumentReceivablesReturnTo("javascript:alert(1)")).toBeNull();
  });

  it("rejects internal routes outside the allowed pattern", () => {
    expect(parseDocumentReceivablesReturnTo("/dashboard/settings")).toBeNull();
    expect(parseDocumentReceivablesReturnTo("/dashboard/clients")).toBeNull();
    expect(
      parseDocumentReceivablesReturnTo(`/dashboard/documents/${VALID_ID}`),
    ).toBeNull();
    expect(
      parseDocumentReceivablesReturnTo(
        `/dashboard/documents/${VALID_ID}?section=document`,
      ),
    ).toBeNull();
  });

  it("rejects a malformed document id", () => {
    expect(
      parseDocumentReceivablesReturnTo(
        "/dashboard/documents/invalid?section=cobro",
      ),
    ).toBeNull();
    expect(
      parseDocumentReceivablesReturnTo(
        "/dashboard/documents/../../etc/passwd?section=cobro",
      ),
    ).toBeNull();
  });

  it("rejects trailing garbage appended after the valid pattern", () => {
    expect(
      parseDocumentReceivablesReturnTo(
        `/dashboard/documents/${VALID_ID}?section=cobro&extra=1`,
      ),
    ).toBeNull();
    expect(
      parseDocumentReceivablesReturnTo(
        `/dashboard/documents/${VALID_ID}?section=cobroX`,
      ),
    ).toBeNull();
  });

  it("is case-insensitive on the UUID but not on the route shape", () => {
    expect(
      parseDocumentReceivablesReturnTo(
        `/dashboard/documents/${VALID_ID.toUpperCase()}?section=cobro`,
      ),
    ).toBe(
      `/dashboard/documents/${VALID_ID.toUpperCase()}?section=cobro`,
    );
    expect(
      parseDocumentReceivablesReturnTo(
        `/Dashboard/documents/${VALID_ID}?section=cobro`,
      ),
    ).toBeNull();
  });
});

describe("appendReturnTo", () => {
  it("appends an encoded returnTo to an href without a query string", () => {
    const returnTo = buildDocumentReceivablesReturnTo(VALID_ID);
    expect(appendReturnTo("/dashboard/receivables/new", returnTo)).toBe(
      `/dashboard/receivables/new?returnTo=${encodeURIComponent(returnTo)}`,
    );
  });

  it("appends an encoded returnTo to an href that already has a query string", () => {
    const returnTo = buildDocumentReceivablesReturnTo(VALID_ID);
    expect(
      appendReturnTo(`/dashboard/receivables/${VALID_ID}?created=1`, returnTo),
    ).toBe(
      `/dashboard/receivables/${VALID_ID}?created=1&returnTo=${encodeURIComponent(returnTo)}`,
    );
  });

  it("leaves the href unchanged when returnTo is null", () => {
    expect(appendReturnTo("/dashboard/receivables/new", null)).toBe(
      "/dashboard/receivables/new",
    );
  });
});
