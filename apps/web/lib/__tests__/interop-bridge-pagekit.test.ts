/**
 * Secure Interop Bridge v1 → v2 — console & integration pins (Sprint 30).
 * -----------------------------------------------------------------------
 * Locks the delivery contract of the sprint:
 *   1. the operator console follows the Dashboard UI Kit (docs/UIKIT.md),
 *   2. every string is bilingual (`interopBridge.*` leaf symmetry),
 *   3. navigation goes through `config/custom-nav.ts`,
 *   4. the tRPC router is mounted under `extensionsRouter`,
 *   5. the bridge schema is exported from `packages/db/schema/index.ts`,
 *   6. `security/policies/bridge.md` records the enforced security contract.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { customNavItems } from "@/config/custom-nav";

const PAGE_PATH = "app/(dashboard)/admin/interop-bridge/page.tsx";
const pageSource = readFileSync(PAGE_PATH, "utf8");
const routerSource = readFileSync(
  "server/routers/extensions/bridge-v1v2.ts",
  "utf8",
);
const extensionsIndex = readFileSync("server/routers/extensions/index.ts", "utf8");
const schemaIndex = readFileSync("../../packages/db/schema/index.ts", "utf8");
const bridgeSchema = readFileSync(
  "../../packages/db/schema/ext_bridge_v1v2.ts",
  "utf8",
);
const policyDocPath = "../../security/policies/bridge.md";
const sk = JSON.parse(readFileSync("messages/sk.json", "utf8"));
const en = JSON.parse(readFileSync("messages/en.json", "utf8"));

function leafKeys(obj: Record<string, unknown>, prefix = ""): Set<string> {
  const out = new Set<string>();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") {
      for (const child of leafKeys(value as Record<string, unknown>, path)) {
        out.add(child);
      }
    } else {
      out.add(path);
    }
  }
  return out;
}

function resolveKey(dict: Record<string, unknown>, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

describe("interop bridge console adopts the dashboard UI kit", () => {
  it("imports the kit tokens from @/components/layout/page-kit", () => {
    expect(pageSource).toContain('from "@/components/layout/page-kit"');
    for (const token of [
      "pageShellClass",
      "PageHeader",
      "PageToolbar",
      "SearchField",
      "DataTableFrame",
      "KpiGrid",
      "KpiCard",
      "EmptyState",
      "TableSkeleton",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
      "filterControlClass",
    ]) {
      expect(pageSource, token).toContain(token);
    }
  });

  it("uses the page shell class instead of a hand-rolled root spacing block", () => {
    expect(pageSource).toContain("<div className={pageShellClass}>");
    expect(pageSource).not.toContain('<div className="space-y-6">');
  });

  it("renders one frame per tab surface with the empty state wired in", () => {
    expect(pageSource).toContain("<DataTableFrame>");
    expect(pageSource).toContain("<EmptyState");
    expect(pageSource).toContain("<TableSkeleton rows={8} />");
  });

  it("meters clinical flags on the message rows (draft, OPL, sympathy)", () => {
    expect(pageSource).toContain("interopBridge.badge.draft");
    expect(pageSource).toContain("interopBridge.badge.controlled");
    expect(pageSource).toContain("interopBridge.badge.sympathy");
  });
});

describe("interop bridge console is fully bilingual", () => {
  it("keeps interopBridge leaf symmetry between sk.json and en.json", () => {
    const skKeys = leafKeys(sk.interopBridge as Record<string, unknown>, "interopBridge");
    const enKeys = leafKeys(en.interopBridge as Record<string, unknown>, "interopBridge");
    expect([...skKeys].filter((key) => !enKeys.has(key))).toEqual([]);
    expect([...enKeys].filter((key) => !skKeys.has(key))).toEqual([]);
    expect(skKeys.size).toBeGreaterThanOrEqual(100);
  });

  it("defines the console surface keys in both languages", () => {
    const required = [
      "interopBridge.title",
      "interopBridge.subtitle",
      "interopBridge.actions.refresh",
      "interopBridge.actions.selfTest",
      "interopBridge.gates.clinicalDraft",
      "interopBridge.gates.controlledSubstances",
      "interopBridge.gates.sympathyGate",
      "interopBridge.kpi.endpoints",
      "interopBridge.kpi.validated",
      "interopBridge.kpi.attention",
      "interopBridge.tabs.endpoints",
      "interopBridge.tabs.messages",
      "interopBridge.tabs.contracts",
      "interopBridge.tabs.keys",
      "interopBridge.tabs.events",
      "interopBridge.messages.gates",
      "interopBridge.legal.note",
    ];
    for (const key of required) {
      expect(typeof resolveKey(sk, key), `sk ${key}`).toBe("string");
      expect(typeof resolveKey(en, key), `en ${key}`).toBe("string");
    }
  });

  it("translates every bridge failure code the router can persist", () => {
    const codes = [
      "malformed_envelope",
      "unsupported_schema_version",
      "unsupported_algorithm",
      "payload_too_large",
      "direction_not_allowed",
      "message_type_not_allowed",
      "stale_timestamp",
      "replay_detected",
      "unknown_key_id",
      "payload_hash_mismatch",
      "signature_invalid",
      "decryption_failed",
      "payload_invalid",
      "safety_gate_blocked",
    ];
    for (const code of codes) {
      expect(
        typeof resolveKey(sk, `interopBridge.reason.${code}`),
        `sk ${code}`,
      ).toBe("string");
      expect(
        typeof resolveKey(en, `interopBridge.reason.${code}`),
        `en ${code}`,
      ).toBe("string");
    }
  });

  it("avoids hardcoded locale formatters in the console source", () => {
    expect(pageSource).not.toContain('"en-US"');
    expect(pageSource).toContain("locale === \"sk\" ? \"sk-SK\" : \"en-GB\"");
  });
});

describe("interop bridge wiring", () => {
  it("exposes the console through config/custom-nav.ts with a live i18n key", () => {
    const item = customNavItems.find(
      (entry) => entry.href === "/admin/interop-bridge",
    );
    expect(item).toBeDefined();
    expect(item?.roles).toEqual(["admin"]);
    expect(item?.section).toBe("admin");
    expect(item?.i18nKey).toBe("nav.interopBridge");
    expect(typeof resolveKey(sk, "nav.interopBridge")).toBe("string");
    expect(typeof resolveKey(en, "nav.interopBridge")).toBe("string");
  });

  it("mounts the router under extensionsRouter and re-exports it", () => {
    expect(extensionsIndex).toContain(
      'import { bridgeV1V2Router } from "./bridge-v1v2";',
    );
    expect(extensionsIndex).toContain("bridgeV1V2: bridgeV1V2Router,");
    expect(extensionsIndex).toContain("  bridgeV1V2Router,");
  });

  it("keeps the bridge router tenant-scoped and role-gated", () => {
    expect(routerSource).toContain('requireRole("admin", "veterinarian")');
    expect(routerSource).toContain('requireRole("admin")');
    expect(routerSource).toContain("eq(extBridgeMessages.practiceId, ctx.practiceId)");
    // The sealed blob never reaches the browser.
    expect(routerSource).toContain(
      "const { ciphertext: _ciphertext, ...safe } = message;",
    );
  });

  it("records rejected envelopes instead of throwing them away", () => {
    expect(routerSource).toContain("ingestBridgeEnvelope(input.envelope");
    expect(routerSource).toContain("validationIssues: outcome.issues");
    expect(routerSource).toContain('"quarantined"');
    expect(routerSource).toContain('"schema_rejected"');
    expect(routerSource).toContain("failureCode: outcome.failureCode");
  });

  it("forwards legacy suppressions into the canonical suppression log", () => {
    expect(routerSource).toContain("extAutomationSuppressionLog");
    expect(routerSource).toContain('suppressionReason: "deceased_patient"');
    expect(routerSource).toContain("onConflictDoNothing()");
  });

  it("resolves bridge secrets from the deployment environment only", () => {
    expect(routerSource).toContain("process.env[envName]");
    expect(routerSource).toContain("fingerprintBridgeKey(secret)");
    expect(routerSource).not.toContain("secret: z.string()");
  });
});

describe("interop bridge schema and policy", () => {
  it("re-exports the new ext schema from packages/db/schema/index.ts", () => {
    expect(schemaIndex).toContain('export * from "./ext_bridge_v1v2";');
  });

  it("creates the bridge tables as ext_* tables with replay protection", () => {
    for (const table of [
      "ext_bridge_endpoints",
      "ext_bridge_keys",
      "ext_bridge_contracts",
      "ext_bridge_messages",
      "ext_bridge_events",
    ]) {
      expect(bridgeSchema, table).toContain(`"${table}"`);
    }
    expect(bridgeSchema).toContain("ext_bridge_messages_nonce_uq");
    expect(bridgeSchema).toContain("ext_bridge_messages_message_uq");
    // Secrets and plaintext never live in the database.
    expect(bridgeSchema).toContain("secretRef: varchar(\"secret_ref\"");
    expect(bridgeSchema).toContain("fingerprint");
  });

  it("ships the security policy document next to the code", () => {
    expect(existsSync(policyDocPath)).toBe(true);
    const policy = readFileSync(policyDocPath, "utf8");
    expect(policy).toContain("AES-256-GCM");
    expect(policy).toContain("HMAC-SHA256");
    expect(policy).toContain("Zákon č. 39/2007 Z. z.");
    expect(policy).toContain("Zákon č. 139/1998 Z. z.");
    expect(policy).toContain("Sympathy Gate");
    expect(policy).toContain("OPENVPM_BRIDGE_V1_SECRET");
  });
});
