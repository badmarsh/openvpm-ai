"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { safeAuthNextPath } from "@/lib/auth-redirect";

/**
 * Preview-only cookie bridge (client half). See lib/preview-cookie-bridge.ts.
 *
 * A full document load still reaches the server without cookies, so the
 * middleware bounces it to `/login`. When `/login` mounts while the browser
 * holds a session cookie, verify the session over (bridged) fetch and resume
 * the requested page with a client-side navigation.
 */

let bounced = false;

export function PreviewCookieBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (bounced || pathname !== "/login") return;
    if (!/(?:^|;\s*)(?:__Secure-)?next-auth\.session-token=/.test(document.cookie)) {
      return;
    }
    bounced = true;
    const nextPath = safeAuthNextPath(searchParams.get("next"), "/post-login");
    void fetch("/api/auth/session")
      .then((response) => (response.ok ? response.json() : null))
      .then((session: { user?: unknown } | null) => {
        if (session?.user) router.replace(nextPath);
      })
      .catch(() => undefined);
  }, [pathname, router, searchParams]);

  return null;
}
