import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  INVENTORY_EXPIRY_WARNING_DAYS,
  daysUntilExpiry,
  expiryBadgeTone,
} from "../inventory/alerts";

/**
 * Sprint 27 — Inventory hardening and supplier integration (/inventory).
 *
 * Pins the dashboard UI-kit shell of the stock hub, the expiry-date warning
 * badge tokens, the supplier / category / low-stock toolbar, the KPI strip
 * (SKUs, low stock, expiring soon, controlled substances), the read-only
 * controlled-substance audit trail and the resilient PDF invoice import error
 * state — while guarding the statutory surfaces this sprint must not touch.
 */

const PAGE = "app/(dashboard)/inventory/page.tsx";
const DIALOG = "components/inventory/wholesaler-import-dialog.tsx";
const ROUTER = "server/routers/inventory.ts";
const MESSAGES_DIR = path.join(__dirname, "../../messages");

function source(file: string): string {
  return readFileSync(file, "utf8");
}

function loadMessages(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(MESSAGES_DIR, name), "utf8"));
}

function pageKitImports(src: string): string {
  const match = src.match(
    /import\s*\{([\s\S]*?)\}\s*from "@\/components\/layout\/page-kit"/,
  );
  return match?.[1] ?? "";
}

function resolveKey(dict: Record<string, unknown>, key: string): unknown {
  if (typeof dict[key] === "string") return dict[key];
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

const NEW_KEYS = [
  "inventory.tabs.controlled",
  "inventory.kpi.totalSkus",
  "inventory.kpi.lowStock",
  "inventory.kpi.expiringSoon",
  "inventory.kpi.expiredHint",
  "inventory.kpi.controlled",
  "inventory.kpi.controlledHint",
  "inventory.expiry.expiredDays",
  "inventory.expiry.expiresInDays",
  "inventory.controlled.badge",
  "inventory.controlled.badgeTitle",
  "inventory.controlled.searchPlaceholder",
  "inventory.controlled.readOnlyNotice",
  "inventory.controlled.loadError",
  "inventory.controlled.loading",
  "inventory.controlled.colPerformedAt",
  "inventory.controlled.colDrug",
  "inventory.controlled.colAction",
  "inventory.controlled.colQuantity",
  "inventory.controlled.colPerformer",
  "inventory.controlled.colWitness",
  "inventory.controlled.emptyTitle",
  "inventory.controlled.emptyDesc",
  "inventory.wholesalerImport.importFailedTitle",
  "inventory.wholesalerImport.retryImport",
];

describe("inventory hub page-kit adoption", () => {
  it("imports the dashboard page-kit primitives", () => {
    const imports = pageKitImports(source(PAGE));
    for (const name of [
      "pageShellClass",
      "PageToolbar",
      "SearchField",
      "DataTableFrame",
      "KpiGrid",
      "KpiCard",
      "filterControlClass",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
      "tableHeadClass",
      "tableCellClass",
      "tableRowClass",
    ]) {
      expect(imports, `missing ${name} in page-kit import`).toContain(name);
    }
  });

  it("uses pageShellClass with a Package PageHeader titled Sklad", () => {
    const src = source(PAGE);
    expect(src).toContain("<div className={pageShellClass}>");
    expect(src).toContain("icon={Package}");
    expect(src).toContain('t("inventory.page.title", "Inventory")');
    expect(resolveKey(loadMessages("sk.json"), "inventory.page.title")).toBe(
      "Sklad",
    );
    // Header actions keep the size="sm" contract.
    expect(src).toMatch(/<Button\s+size="sm"\s+variant="outline"/);
  });

  it("keeps category, supplier and low-stock filters in one PageToolbar", () => {
    const src = source(PAGE);
    expect(src).toContain("<PageToolbar>");
    expect(src).toContain("CATEGORIES.map((cat) => (");
    expect(src).toContain('aria-label={t("inventory.page.supplierFilter")}');
    expect(src).toContain('t("inventory.page.allSuppliers")');
    expect(src).toContain('t("inventory.page.onlyBelowMinimum")');
    expect(src).toContain("onChange={(e) => setBelowMinimum(e.target.checked)}");
    expect(src).toContain("supplierName: supplierName || undefined");
    expect(src).toContain("belowMinimum,");
  });

  it("shows SKUs, low stock, expiring soon and controlled counts in the KpiGrid", () => {
    const src = source(PAGE);
    expect(src).toContain("<KpiGrid>");
    for (const key of [
      "totalSkus",
      "lowStock",
      "expiringSoon",
      "controlled",
    ]) {
      expect(src).toContain(`t("inventory.kpi.${key}"`);
      expect(src).toContain(`productsQuery.data.alertCounts.${key}`);
    }
    expect(src).toContain('onClick={() => setAlertFilter("low_stock")}');
    expect(src).toContain('onClick={() => setAlertFilter("expiring_soon")}');
    expect(src).toContain('onClick={() => setTab("controlled")}');
  });

  it("frames the register in DataTableFrame with shared table tokens", () => {
    const src = source(PAGE);
    expect(src.match(/<DataTableFrame>/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(src.match(/<\/DataTableFrame>/g)?.length ?? 0).toBe(
      src.match(/<DataTableFrame>/g)?.length ?? 0,
    );
    expect(src).toContain("<th className={tableHeadClass}>");
    expect(src).toContain("className={tableRowClass}");
    expect(src).not.toContain('<div className="overflow-x-auto rounded-lg border border-border">');
  });
});

describe("expiry-date warning badges", () => {
  it("classifies lots by the 30-day warning window", () => {
    expect(INVENTORY_EXPIRY_WARNING_DAYS).toBe(30);
    const today = "2026-09-25";
    expect(expiryBadgeTone("2026-09-24", today)).toBe("expired");
    expect(expiryBadgeTone("2026-09-25", today)).toBe("warning");
    expect(expiryBadgeTone("2026-10-25", today)).toBe("warning");
    expect(expiryBadgeTone("2026-10-26", today)).toBeNull();
    expect(expiryBadgeTone(null, today)).toBeNull();
    expect(expiryBadgeTone("not-a-date", today)).toBeNull();
  });

  it("reports whole days until expiry in both directions", () => {
    const today = "2026-09-25";
    expect(daysUntilExpiry("2026-09-25", today)).toBe(0);
    expect(daysUntilExpiry("2026-10-05", today)).toBe(10);
    expect(daysUntilExpiry("2026-09-15", today)).toBe(-10);
    expect(daysUntilExpiry(undefined, today)).toBeNull();
  });

  it("renders the badge with warning / destructive tokens, not raw palette colours", () => {
    const src = source(PAGE);
    expect(src).toContain("function expiryWarningBadge(");
    expect(src).toContain("bg-warning-muted text-warning-muted-foreground");
    expect(src).toContain("bg-destructive/10 text-destructive");
    expect(src).toContain('t("inventory.expiry.expiredDays"');
    expect(src).toContain('t("inventory.expiry.expiresInDays"');
    expect(src).not.toContain("bg-orange-100");
    expect(src).not.toContain("bg-red-100");
    expect(src).not.toContain("bg-amber-100");
    expect(src).not.toContain("bg-green-100");
  });
});

describe("controlled-substance audit trail", () => {
  it("renders a read-only ledger tab fed by the controlled-substances list query", () => {
    const src = source(PAGE);
    expect(src).toContain('type InventoryTab = "products" | "suppliers" | "controlled";');
    expect(src).toContain('<TabsTrigger value="controlled"');
    expect(src).toContain("function ControlledAuditTrail()");
    expect(src).toContain("trpc.controlledSubstances.list.useQuery(");
    expect(src).toContain('"inventory.controlled.readOnlyNotice"');
    expect(src).toContain('"inventory.controlled.emptyTitle"');
    expect(src).toContain('{tab === "controlled" && <ControlledAuditTrail />}');
    // Read-only: the inventory page never writes to the narcotics ledger.
    expect(src).not.toContain("trpc.controlledSubstances.create");
    expect(src).not.toContain("controlledSubstances.update");
  });

  it("badges controlled products from the server-side name match", () => {
    const page = source(PAGE);
    const router = source(ROUTER);
    expect(page).toContain("product.isControlledSubstance &&");
    expect(page).toContain('t("inventory.controlled.badge", "Controlled")');
    expect(router).toContain("isControlledSubstance: isControlledSubstanceName(p.name)");
    expect(router).toContain("CONTROLLED_SUBSTANCES_PATTERN_SOURCE");
    expect(router).toContain("controlled: Number(controlledCount[0]?.count ?? 0)");
    expect(router).toContain("totalSkus: Number(skuCount[0]?.count ?? 0)");
  });
});

describe("PDF invoice import resilience", () => {
  const src = source(DIALOG);

  it("keeps a persistent error state with the file name and a retry button", () => {
    expect(src).toContain("const [importError, setImportError] = useState<");
    expect(src).toContain("{ fileName: string; messageKey: string } | null");
    expect(src).toContain("const lastFileRef = useRef<File | null>(null);");
    expect(src).toContain("const retryImport = () => {");
    expect(src).toContain('role="alert"');
    expect(src).toContain("{importError.fileName}");
    expect(src).toContain("{t(importError.messageKey)}");
    expect(src).toContain('"inventory.wholesalerImport.importFailedTitle"');
    expect(src).toContain('t("inventory.wholesalerImport.retryImport"');
    expect(src).toContain("onClick={retryImport}");
  });

  it("clears the error on a successful parse and reuses the shared error tokens", () => {
    expect(src).toContain("setImportError(null);");
    expect(src).toContain('importErrorKey(err.message)');
    expect(src).toContain('messageKey: "inventory.wholesalerImport.errors.tooLarge"');
  });

  it("keeps the controlled-substance import block untouched", () => {
    expect(src).toContain("item.isControlledSubstance ? \"skip\"");
    expect(src).toContain("isControlledSubstanceName");
  });
});

describe("inventory i18n", () => {
  const en = loadMessages("en.json");
  const sk = loadMessages("sk.json");

  it("defines every sprint key in both SK and EN", () => {
    for (const key of NEW_KEYS) {
      const enValue = resolveKey(en, key);
      const skValue = resolveKey(sk, key);
      expect(typeof enValue, `en ${key}`).toBe("string");
      expect(typeof skValue, `sk ${key}`).toBe("string");
      expect((enValue as string).trim().length, `en ${key}`).toBeGreaterThan(0);
      expect((skValue as string).trim().length, `sk ${key}`).toBeGreaterThan(0);
    }
  });

  it("uses the Slovak stock vocabulary", () => {
    expect(resolveKey(sk, "inventory.page.title")).toBe("Sklad");
    expect(resolveKey(sk, "inventory.tabs.products")).toBe("Produkty");
    expect(resolveKey(sk, "inventory.tabs.suppliers")).toBe("Dodávatelia");
    expect(resolveKey(sk, "inventory.tabs.controlled")).toBe(
      "Audit omamných látok",
    );
    expect(resolveKey(en, "inventory.page.title")).toBe("Inventory");
  });

  it("resolves every inventory.* key the page and dialog use in both locales", () => {
    const keys = [
      ...new Set(
        [...`${source(PAGE)}\n${source(DIALOG)}`.matchAll(
          /\bt\(\s*["'`](inventory\.[a-zA-Z0-9_.]+)["'`]/g,
        )].map((match) => match[1]!),
      ),
    ];
    expect(keys.length).toBeGreaterThan(80);
    const missing = keys.filter(
      (key) =>
        typeof resolveKey(en, key) !== "string" ||
        typeof resolveKey(sk, key) !== "string",
    );
    expect(missing).toEqual([]);
  });
});
