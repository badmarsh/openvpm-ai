import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Tenant-scoping regression guard (zero-DB). The catastrophic multi-tenant bug
 * is a router that queries data without filtering by practiceId. This asserts
 * every router that touches the database references `practiceId`. It does NOT
 * prove row-level isolation — that needs a live DB + Postgres RLS (Phase 4) —
 * but it stops a whole router shipping with no tenant filter.
 */
const ROUTERS_DIR = fileURLToPath(new URL("../routers", import.meta.url));

// Routers that legitimately query without a practiceId filter, with reasons.
const ALLOWLIST: Record<string, string> = {
  "auth.ts": "operates on users by email/id before a session exists",
  "_app.ts": "router aggregation only",
  "extensions/index.ts": "router aggregation only",
};

function getRouterFiles(dir: string, baseDir = dir): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...getRouterFiles(fullPath, baseDir));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts")
    ) {
      const relPath = fullPath.slice(baseDir.length + 1).replace(/\\/g, "/");
      files.push(relPath);
    }
  }
  return files;
}

describe("tenant scoping", () => {
  const files = getRouterFiles(ROUTERS_DIR);

  it("covers every router file across root and extensions", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  for (const file of files) {
    it(`${file}: DB queries are scoped by practiceId`, () => {
      const src = readFileSync(`${ROUTERS_DIR}/${file}`, "utf8");
      // Excludes JS's built-in Array.from(...), which is not a Drizzle table
      // query and previously produced false positives (e.g. extensions/ai-swarm.ts).
      const dbFromPattern = /(?<!Array)\.from\(/;
      const touchesDb =
        dbFromPattern.test(src) ||
        src.includes(".insert(") ||
        src.includes(".update(") ||
        src.includes(".delete(");
      if (!touchesDb) return; // no DB access, nothing to scope
      if (ALLOWLIST[file]) return;
      expect(
        src.includes("practiceId"),
        `${file} queries the DB but never references practiceId — possible cross-tenant leak`,
      ).toBe(true);
    });
  }

  it("keeps the allowlist small and intentional", () => {
    expect(Object.keys(ALLOWLIST).length).toBeLessThanOrEqual(3);
  });

  it("keeps platform SMS recovery available during operator read-only billing", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../trpc.ts", import.meta.url)),
      "utf8",
    );
    expect(source).toContain('"admin.reconcileSmsSendAttempt"');
    expect(source).toContain('"admin.resendSmsSendAttempt"');
    expect(source).toContain('"admin.reconcileSmsDeliveryEvent"');
  });
});
