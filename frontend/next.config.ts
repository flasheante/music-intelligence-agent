import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle so the production image stays small.
  output: "standalone",
};

export default nextConfig;
