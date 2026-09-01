import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Preview and some browsers hit 127.0.0.1 while the dev server advertises localhost.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
