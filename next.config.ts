import type { NextConfig } from "next";

const mediaBase = (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").trim();
const remotePatterns = mediaBase
  ? (() => {
      const url = new URL(mediaBase);
      return [
        {
          protocol: url.protocol.replace(":", "") as "http" | "https",
          hostname: url.hostname,
          ...(url.port ? { port: url.port } : {}),
        },
      ];
    })()
  : [];

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns,
  },
};

export default nextConfig;
