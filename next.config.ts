import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the native Postgres driver out of the server bundle.
  serverExternalPackages: ["postgres"],
  // Compile-time-checked Link/router hrefs.
  typedRoutes: true,
};

export default nextConfig;
