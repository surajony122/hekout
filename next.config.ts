import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The test suite builds into its own folder, so it never disturbs a running dev server.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [
      {
        // Repeat visits load quickly, and updates reach customers within about two minutes.
        source: "/widget.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=60, stale-while-revalidate=60" },
        ]
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  }
};

export default nextConfig;
