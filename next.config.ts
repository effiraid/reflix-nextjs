import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
  headers: async () => [
    {
      source: "/:path(videos|previews)/:file*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Content-Disposition", value: "inline" },
        { key: "Cache-Control", value: "private, no-store" },
        { key: "X-Robots-Tag", value: "noindex" },
      ],
    },
  ],
};

export default withSentryConfig(nextConfig, {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: Boolean(process.env.SENTRY_AUTH_TOKEN),
});
