import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // .next/standalone: a minimal server with only the files it needs, for the Docker image
  output: "standalone",
};

export default nextConfig;
