import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(),
  },
  serverExternalPackages: ['@neondatabase/serverless'],
};

export default nextConfig;
