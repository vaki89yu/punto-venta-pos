import type { NextConfig } from "next";

// En Vercel NO se usa 'standalone' (Vercel gestiona el empaquetado).
// En self-hosting / Docker sí conviene activarlo.
const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  ...(isVercel ? {} : { output: "standalone" as const }),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "chedrauimx.vtexassets.com",
      },
    ],
  },
};

export default nextConfig;
