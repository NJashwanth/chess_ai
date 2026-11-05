import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Stockfish build served from /public/stockfish is a classic Web Worker
  // script; nothing else needs special treatment.
  async headers() {
    return [
      {
        source: "/stockfish/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
