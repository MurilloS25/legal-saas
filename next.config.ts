import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
