/** Extract the path used after confirming an email OTP. */
export function extractSafeRedirectPath(next: string | null): string {
  const fallback = "/dashboard";
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;

  let decoded = next;
  for (let pass = 0; pass < 3; pass++) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) break;
      decoded = nextDecoded;
    } catch {
      return fallback;
    }
  }

  if (
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    /^\/?[a-z][a-z\d+.-]*:/i.test(decoded)
  ) {
    return fallback;
  }

  const internalOrigin = "https://internal.invalid";
  const destination = new URL(next, internalOrigin);
  if (destination.origin !== internalOrigin) return fallback;
  return `${destination.pathname}${destination.search}${destination.hash}`;
}
