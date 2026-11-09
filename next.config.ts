import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The dev badge would sit on top of screenshots in the visual parity tests.
  devIndicators: false,
};

export default nextConfig;
