const path = require("path");
const {
  capabilityHeaders,
  securityHeaders,
} = require("./lib/security-headers.js");
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  output: process.env.NEXT_STANDALONE === "true" ? "standalone" : undefined,
  poweredByHeader: false,
  transpilePackages: ["@openpims/api", "@openpims/db", "@openpims/email"],
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
};

module.exports = withBundleAnalyzer(nextConfig);
