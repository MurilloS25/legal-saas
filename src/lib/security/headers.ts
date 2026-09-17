const BASE_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
];

export function buildContentSecurityPolicy(production: boolean): string {
  const script = production
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  const connect = production
    ? "connect-src 'self' https://*.supabase.co wss://*.supabase.co"
    : "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*";
  const directives = [...BASE_DIRECTIVES, script, connect];
  if (production) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function buildSecurityHeaders(production: boolean) {
  return [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(production) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
}
