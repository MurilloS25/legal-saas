import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: buildSecurityHeaders(process.env.NODE_ENV === "production"),
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/dashboard/team",
        destination: "/settings?tab=workspace",
        permanent: true,
      },
      ...[
        "clients",
        "templates",
        "documents",
        "notarial-index",
        "receivables",
        "settings",
      ].map((module) => ({
        source: `/dashboard/${module}/:path*`,
        destination: `/${module}/:path*`,
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
