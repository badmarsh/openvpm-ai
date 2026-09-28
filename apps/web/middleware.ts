import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  applyCapabilitySecurityHeaders,
  applySecurityHeaders,
} from "./lib/security-headers";
import { nextAuthSecret } from "./lib/auth-secret";
import {
  PREVIEW_COOKIE_HEADER,
  isPreviewCookieBridgeEnabled,
} from "./lib/preview-cookie-bridge";

const CAPABILITY_PATH_PREFIXES = [
  "/capture",
  "/sign",
  "/simulation",
  "/simulation.html",
  "/treatment-plan",
  "/api/capture",
  "/api/sign",
  "/api/treatment-plan",
];

const PUBLIC_PATH_PREFIXES = [
  "/accept-invite",
  "/api",
  "/api-docs",
  "/book",
  "/capture",
  "/clinic-fit",
  "/demo",
  "/email-preferences",
  "/forgot-password",
  "/h",
  "/legal",
  "/login",
  "/odhlasenie",
  "/portal",
  "/postop",
  "/register",
  "/reset-password",
  "/sign",
  "/sms",
  "/treatment-plan",
  "/tv",
  "/verify-email",
  "/waiting-room",
];

const PUBLIC_FILE_PATTERN =
  /\.(?:avif|css|gif|html|ico|jpg|jpeg|js|json|map|png|svg|txt|webp|xml)$/i;

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_FILE_PATTERN.test(pathname) ||
    PUBLIC_PATH_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

function isCapabilityPath(pathname: string): boolean {
  return CAPABILITY_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isVercelObservabilityPath(pathname: string): boolean {
  if (pathname.startsWith("/_vercel/insights/")) return true;

  // Vercel may proxy Web Analytics through a deployment-specific base path,
  // e.g. /5691167a7e0cfa40/view or /5691167a7e0cfa40/event.
  return /^\/[a-f0-9]{16}\/(?:script\.js|view|event|session)$/i.test(pathname);
}

const VERCEL_INSIGHTS_STUB_SCRIPT =
  "(function(){window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};})();";

// Preview-only cookie bridge (see lib/preview-cookie-bridge.ts). Some sandbox
// preview proxies drop the request `Cookie` header entirely; when the bridge
// is enabled the browser re-sends `document.cookie` in `x-preview-cookie`
// and we restore it here so NextAuth, `cookies()` and route handlers see it.
const PREVIEW_COOKIE_BRIDGE = isPreviewCookieBridgeEnabled();

function withBridgedCookies(request: NextRequest): NextRequest {
  if (!PREVIEW_COOKIE_BRIDGE || request.headers.has("cookie")) return request;
  const bridged = request.headers.get(PREVIEW_COOKIE_HEADER);
  if (!bridged) return request;
  const headers = new Headers(request.headers);
  headers.set("cookie", bridged);
  headers.delete(PREVIEW_COOKIE_HEADER);
  return new NextRequest(request, { headers });
}

function passThrough(request: NextRequest): NextResponse {
  return PREVIEW_COOKIE_BRIDGE
    ? NextResponse.next({ request: { headers: request.headers } })
    : NextResponse.next();
}

export async function middleware(incomingRequest: NextRequest) {
  const request = withBridgedCookies(incomingRequest);
  const requestUrl = new URL(request.url);
  const pathname = requestUrl.pathname;

  if (isVercelObservabilityPath(pathname)) {
    if (pathname.endsWith("/script.js")) {
      return applySecurityHeaders(
        new NextResponse(VERCEL_INSIGHTS_STUB_SCRIPT, {
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=3600, immutable",
          },
        }),
      );
    }
    return applySecurityHeaders(
      NextResponse.json({ ok: true }, { status: 200 }),
    );
  }

  if (isCapabilityPath(pathname)) {
    return applyCapabilitySecurityHeaders(passThrough(request));
  }

  if (isPublicPath(pathname)) {
    return applySecurityHeaders(passThrough(request));
  }

  const secret = nextAuthSecret();
  const token = secret ? await getToken({ req: request, secret }) : null;

  // Unauthenticated visitors go to the demo login, which offers one-click
  // demo access. (Previously the root path bounced to the marketing site,
  // which dead-ended anyone who came straight to demo.openvpm.com to try it.)
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    const nextPath = `${pathname}${requestUrl.search}`;
    if (nextPath !== "/") {
      loginUrl.searchParams.set("next", nextPath);
    }
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return applySecurityHeaders(passThrough(request));
}

export const config = {
  // Skip the middleware invocation entirely for framework internals and
  // static-file requests (favicons, public images, fonts, …). Security
  // headers for those responses still come from next.config.js `headers()`
  // (`/:path*`), so this only removes a redundant edge hop per asset.
  matcher: [
    "/((?!_next|.*\\.(?:avif|bmp|css|csv|gif|ico|jpg|jpeg|js|json|map|mp4|png|svg|txt|webm|webp|woff2?|xml|webmanifest)$).*)",
  ],
};
