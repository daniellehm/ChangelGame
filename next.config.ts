import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The dev badge would sit on top of screenshots in the visual parity tests.
  devIndicators: false,
  // The share images read these TTFs at runtime (app/api/og).
  outputFileTracingIncludes: { "/api/og": ["./assets/fonts/**"] },
  // About was merged into How to play (DECISIONS.md 2026-11-09).
  async redirects() {
    return [{ source: "/about", destination: "/how-to-play", permanent: true }];
  },
};

export default nextConfig;
