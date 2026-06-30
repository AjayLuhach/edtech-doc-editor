import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Postgres driver external, and load a single shared yjs instance on the server
  // (bundling it per-route creates multiple instances and breaks Yjs constructor checks).
  serverExternalPackages: ["postgres", "yjs"],
  // Compile-time-checked Link/router hrefs.
  typedRoutes: true,
};

export default nextConfig;
