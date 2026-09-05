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
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-avatar",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "@tanstack/react-query",
      "recharts",
      "sonner",
    ],
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
};

module.exports = withBundleAnalyzer(nextConfig);
