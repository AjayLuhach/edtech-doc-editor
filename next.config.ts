import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Postgres driver external, and load a single shared yjs instance on the server
  // (bundling it per-route creates multiple instances and breaks Yjs constructor checks).
  serverExternalPackages: ["postgres", "yjs", "@aws-sdk/client-bedrock-runtime"],
  // Compile-time-checked Link/router hrefs.
  typedRoutes: true,
  // Snapshots ship full Yjs document states through server actions; raise the default 1 MB body cap.
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};

export default nextConfig;
