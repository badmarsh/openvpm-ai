import type { Instrumentation } from "next";

// Polyfill DOMMatrix for pdfjs-dist 5.x in Node.js server environments.
// pdfjs-dist requires DOMMatrix for transform operations; this minimal stub
// enables text extraction without a canvas implementation.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (typeof DOMMatrix === "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).DOMMatrix = class DOMMatrix {
        m11 = 1; m12 = 0; m13 = 0; m14 = 0;
        m21 = 0; m22 = 1; m23 = 0; m24 = 0;
        m31 = 0; m32 = 0; m33 = 1; m34 = 0;
        m41 = 0; m42 = 0; m43 = 0; m44 = 1;
        isIdentity = true;
        is2D = true;
        constructor(_init?: string | number[]) {}
        scale() { return this; }
        translate() { return this; }
        rotate() { return this; }
        multiply() { return this; }
        inverse() { return this; }
        toFloat32Array() { return new Float32Array(16); }
        toFloat64Array() { return new Float64Array(16); }
        toString() { return "matrix(1,0,0,1,0,0)"; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        static fromMatrix() { return new (globalThis as any).DOMMatrix(); }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        static fromFloat32Array() { return new (globalThis as any).DOMMatrix(); }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        static fromFloat64Array() { return new (globalThis as any).DOMMatrix(); }
      };
    }
  }
}

const REQUEST_ERROR_DEDUPE_MS = 60_000;
const MAX_RECENT_REQUEST_ERRORS = 100;
const recentRequestErrors = new Map<string, number>();

function errorFingerprint(
  error: Error & { digest?: string },
  routePath: string,
  routeType: string
): string {
  return [error.digest ?? error.message, routePath, routeType].join(":");
}

function shouldReportRequestError(key: string, now = Date.now()): boolean {
  const previous = recentRequestErrors.get(key);
  if (previous !== undefined && now - previous < REQUEST_ERROR_DEDUPE_MS) {
    return false;
  }

  recentRequestErrors.set(key, now);
  if (recentRequestErrors.size > MAX_RECENT_REQUEST_ERRORS) {
    for (const [candidate, reportedAt] of recentRequestErrors) {
      if (now - reportedAt >= REQUEST_ERROR_DEDUPE_MS) {
        recentRequestErrors.delete(candidate);
      }
    }
    while (recentRequestErrors.size > MAX_RECENT_REQUEST_ERRORS) {
      const oldest = recentRequestErrors.keys().next().value;
      if (oldest === undefined) break;
      recentRequestErrors.delete(oldest);
    }
  }
  return true;
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  const normalizedError =
    error instanceof Error ? error : new Error("Unhandled request error");
  const digest =
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : undefined;
  const reportableError = Object.assign(normalizedError, { digest });
  const key = errorFingerprint(
    reportableError,
    context.routePath,
    context.routeType
  );
  if (!shouldReportRequestError(key)) return;

  // The ops alert implementation is intentionally Node-only. Edge failures
  // remain visible in Vercel logs without pulling Node dependencies into an
  // Edge bundle.
  if (process.env.NEXT_RUNTIME === "edge") {
    console.error(
      `[next-request-error] ${context.routeType} ${context.routePath} digest=${digest ?? "unavailable"}`
    );
    return;
  }

  const { captureException } = await import("@/lib/error-tracking");
  await captureException({
    source: `next-${context.routeType}`,
    message: normalizedError.message || "Unhandled request error",
    stack: normalizedError.stack ?? null,
    digest: digest ?? null,
    path: request.path,
  });
};

export function resetRequestErrorDedupeForTests(): void {
  if (process.env.NODE_ENV === "test") recentRequestErrors.clear();
}
