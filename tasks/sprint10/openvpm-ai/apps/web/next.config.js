const path = require("path");
const {
  capabilityHeaders,
  securityHeaders,
} = require("./lib/security-headers.js");
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/**
 * Extra dev origins allowed to request dev-only assets (HMR, /_next/*), used
 * by the sandboxed live preview ("3001-<sandbox>.e2b.app,*.e2b.app").
 * Unset in normal dev and production, so behaviour there is unchanged.
 */
function previewDevOrigins() {
  const raw = process.env.PREVIEW_DEV_ORIGINS?.trim();
  if (!raw) return undefined;
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  output: process.env.NEXT_STANDALONE === "true" ? "standalone" : undefined,
  poweredByHeader: false,
  allowedDevOrigins: previewDevOrigins(),
  transpilePackages: ["@openpims/api", "@openpims/db", "@openpims/email"],
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/pdfjs-dist/*",
    ],
  },

  eslint: {
    // lib/pdf/fonts/roboto-regular.ts is auto-generated (227 KB) and causes
    // ESLint to exceed its call-stack limit. ESLint is run separately in CI.
    ignoreDuringBuilds: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    ...(process.env.NODE_ENV === "production"
      ? {
          optimizePackageImports: [
            "lucide-react",
            "@radix-ui/react-avatar",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@tanstack/react-query",
            "recharts",
            "sonner",
          ],
        }
      : {}),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      { source: "/capture/:path*", headers: capabilityHeaders },
      { source: "/sign/:path*", headers: capabilityHeaders },
      { source: "/treatment-plan/:path*", headers: capabilityHeaders },
      { source: "/api/capture/:path*", headers: capabilityHeaders },
      { source: "/api/sign/:path*", headers: capabilityHeaders },
      { source: "/api/treatment-plan/:path*", headers: capabilityHeaders },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/_vercel/insights/script.js",
        destination: "/api/vercel-insights",
      },
      {
        source: "/_vercel/insights/:match*",
        destination: "/api/vercel-insights",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/marketing/tv",
        destination: "/waiting-room",
        permanent: true,
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
