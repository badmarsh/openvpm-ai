import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../app/api");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

const INTENTIONALLY_PUBLIC = [
  "app/api/health/route.ts",
  "app/api/health/live/route.ts",
  "app/api/health/ready/route.ts",
  "app/api/auth/[...nextauth]/route.ts",
  "app/api/funnel-event/route.ts",
  "app/api/error-report/route.ts",
  "app/api/demo-access/route.ts",
];

function hasAuthControl(source: string): boolean {
  return (
    /cronAuthError|isCronAuthorized/.test(source) ||
    /authenticateApiKey/.test(source) ||
    /getServerSession|getToken\(|createTRPCContext/.test(source) ||
    /constructEvent|webhook|STRIPE_WEBHOOK|TELNYX_PUBLIC_KEY|RESEND_WEBHOOK|twilio/.test(
      source,
    ) ||
    /portalSession|timingSafeEqual/.test(source) ||
    /params\.token|searchParams\.get\([\"']token|isCalendarFeedTokenShape|isCaptureTokenShape|isTreatmentPlanPresentationTokenShape|receiptToken/.test(
      source,
    )
  );
}

describe("public /api route auth inventory", () => {
  it("every route.ts either is an allowlisted public probe or contains an auth control", () => {
    const routes = walk(apiRoot);
    expect(routes.length).toBeGreaterThan(20);

    const missing: string[] = [];
    for (const file of routes) {
      const rel = relative(join(apiRoot, "../.."), file).replaceAll("\\", "/");
      if (INTENTIONALLY_PUBLIC.includes(rel)) continue;
      const source = readFileSync(file, "utf8");
      if (!hasAuthControl(source)) missing.push(rel);
    }

    expect(missing).toEqual([]);
  });
});
