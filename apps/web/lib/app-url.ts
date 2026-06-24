/**
 * App URL + auth-link exposure helpers, shared by flows that build auth links
 * (signup verification, password reset, staff invites).
 */

export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  );
}

/**
 * Whether to return raw auth links (verify/reset/invite URLs) in API responses
 * so they're testable in dev/preview. Never true in production.
 */
export function exposeAuthLinksForPreview(): boolean {
  return (
    process.env.OPENVPM_EXPOSE_AUTH_LINKS === "true" ||
    process.env.NODE_ENV !== "production"
  );
}
