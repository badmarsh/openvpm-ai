import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { customNavItems } from "@/config/custom-nav";

/**
 * IA-PHASE4-NAV-COUNT — the consolidated sidebar must expose exactly the
 * canonical set of entries per role, with no href rendered twice.
 *
 * `vanillaSections` is a module-local literal inside a "use client" component,
 * so it is parsed from source the same way `heavy-client-imports.test.ts`
 * inspects page sources. `customNavItems` is imported directly because the
 * sidebar merges it in at render time.
 */

const ALL_ROLES = [
  "admin",
  "veterinarian",
  "technician",
  "front_desk",
  "viewer",
] as const;
type Role = (typeof ALL_ROLES)[number];

interface ParsedItem {
  href: string;
  roles: Role[];
  section: string;
}

function parseVanillaSections(): ParsedItem[] {
  const src = readFileSync("components/layout/sidebar.tsx", "utf8");
  const start = src.indexOf("const vanillaSections: NavSection[] = [");
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf("\n];", start);
  const block = src.slice(start, end);

  const items: ParsedItem[] = [];
  for (const section of block.split(/\n {2}\{\n {4}id: "/).slice(1)) {
    const sectionId = section.slice(0, section.indexOf('"'));
    for (const chunk of section.split(/\n {6}\{\n/).slice(1)) {
      const href = /href: "([^"]+)"/.exec(chunk)?.[1];
      if (!href) continue;
      const rolesLiteral = /roles: ([^\n]+),/.exec(chunk)?.[1] ?? "";
      const roles = (
        rolesLiteral.includes("allRoles")
          ? [...ALL_ROLES]
          : ((rolesLiteral.match(/"([^"]+)"/g) ?? []).map((s) =>
              s.replace(/"/g, ""),
            ) as Role[])
      ).filter((role) => (ALL_ROLES as readonly string[]).includes(role));
      items.push({ href, roles, section: sectionId });
    }
  }
  return items;
}

/** Everything the sidebar renders for a role: overview + vanilla + custom. */
function visibleHrefs(role: Role): string[] {
  const vanilla = parseVanillaSections();
  const merged = [
    // overviewItem — always rendered above the sections, every role.
    { href: "/", roles: [...ALL_ROLES] as Role[] },
    ...vanilla,
    ...customNavItems.map((item) => ({
      href: item.href,
      roles: item.roles,
    })),
  ];

  // Mirrors the `seenGlobalHrefs` dedup guard in sidebar.tsx.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of merged) {
    if (!item.roles.includes(role)) continue;
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    out.push(item.href);
  }
  return out;
}

describe("IA-PHASE4-NAV-COUNT: canonical sidebar entries", () => {
  it("exposes exactly 32 canonical entries to an admin", () => {
    const hrefs = visibleHrefs("admin");
    expect(hrefs).toHaveLength(32);
    expect(new Set(hrefs).size).toBe(32);
  });

  it("never renders the same href twice for any role", () => {
    for (const role of ALL_ROLES) {
      const hrefs = visibleHrefs(role);
      expect(new Set(hrefs).size, `duplicate href for ${role}`).toBe(
        hrefs.length,
      );
    }
  });

  it("keeps clinical tools away from non-clinical roles", () => {
    expect(visibleHrefs("admin")).toContain("/controlled-substances");
    expect(visibleHrefs("front_desk")).not.toContain("/controlled-substances");
    expect(visibleHrefs("viewer")).not.toContain("/agent");
    expect(visibleHrefs("viewer")).not.toContain("/settings");
  });

  it("keeps the H6 canonical labels wired through i18n keys", () => {
    const sk = JSON.parse(
      readFileSync("messages/sk.json", "utf8"),
    ) as Record<string, unknown>;
    const en = JSON.parse(
      readFileSync("messages/en.json", "utf8"),
    ) as Record<string, unknown>;

    const resolve = (dict: Record<string, unknown>, dotted: string) =>
      dotted.split(".").reduce<unknown>((node, part) => {
        if (node && typeof node === "object" && part in node) {
          return (node as Record<string, unknown>)[part];
        }
        return undefined;
      }, dict);

    for (const key of ["nav.encounters", "nav.marketingMessages"]) {
      expect(resolve(sk, key), `${key} missing in sk.json`).toEqual(
        expect.any(String),
      );
      expect(resolve(en, key), `${key} missing in en.json`).toEqual(
        expect.any(String),
      );
    }
  });
});
