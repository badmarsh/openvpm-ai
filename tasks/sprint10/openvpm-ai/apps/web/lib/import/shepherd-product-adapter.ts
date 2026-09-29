import { normalizeKey } from "@/lib/csv/parse";
import type {
  ShepherdBundleRows,
  ShepherdDomainCoverage,
} from "./shepherd-core-adapter";
import type { ShepherdRawRow } from "./shepherd-bundle";

export interface ShepherdProductImportRecord {
  externalProductId: string;
  name: string;
  sku?: string;
  category?: string;
  sourceType: "product" | "medication" | "vaccine";
  unitPrice: string;
  taxable: boolean;
}

export type ShepherdProductIssueCode =
  | "deleted_product_excluded"
  | "inactive_product_excluded"
  | "service_excluded"
  | "unsupported_product_type"
  | "conflicting_product_identity"
  | "missing_product_identity"
  | "missing_product_name"
  | "invalid_product_price"
  | "product_name_too_long"
  | "product_sku_too_long"
  | "product_category_too_long";

export interface ShepherdProductIssue {
  rowIndex: number;
  code: ShepherdProductIssueCode;
  severity: "warning" | "error";
}

export interface ShepherdProductAdaptation {
  products: ShepherdProductImportRecord[];
  issues: ShepherdProductIssue[];
  coverage: ShepherdDomainCoverage;
}

type NormalizedRow = Record<string, string | undefined>;

function normalized(row: ShepherdRawRow): NormalizedRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      normalizeKey(key),
      value?.trim(),
    ]),
  );
}

function rows(
  bundle: ShepherdBundleRows,
  kind: "product" | "product_type" | "product_category",
): NormalizedRow[] {
  return (bundle[kind] ?? []).map(normalized);
}

function truthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "y"].includes(value?.toLowerCase() ?? "");
}

function identity(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function money(value: string | undefined): string | undefined {
  if (!value || !/^\d+(?:\.\d{1,2})?$/.test(value)) return undefined;
  const [whole, fraction = ""] = value.split(".");
  const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > 9_999_999_999n) return undefined;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

function sourceType(value: string | undefined) {
  const normalizedValue = identity(value);
  if (normalizedValue === "product") return "product" as const;
  if (normalizedValue === "medication") return "medication" as const;
  if (normalizedValue === "vaccine") return "vaccine" as const;
  return null;
}

function coverage(
  sourceRows: number,
  plannedRows: number,
  deferredRows: number,
  excludedRows: number,
  errorRows: number,
): ShepherdDomainCoverage {
  if (plannedRows + deferredRows + excludedRows + errorRows !== sourceRows) {
    throw new Error("Shepherd product coverage must account for every row.");
  }
  return { sourceRows, plannedRows, deferredRows, excludedRows, errorRows };
}

/**
 * Convert active stock-bearing catalog entries into inventory-untracked
 * products. Source quantities and lots are intentionally not copied: Shepherd
 * can represent decimal, multi-lot stock while OpenVPM's operational stock is
 * a clinic-attested starting balance. Imported catalog rows can be billed but
 * cannot dispense or emit low-stock claims until staff starts tracking them.
 */
export function adaptShepherdProducts(
  bundle: ShepherdBundleRows,
): ShepherdProductAdaptation {
  const productTypes = new Map(
    rows(bundle, "product_type")
      .filter((row) => row.id && row.name)
      .map((row) => [row.id!, row.name!] as const),
  );
  const categories = new Map(
    rows(bundle, "product_category")
      .filter((row) => row.id && row.name)
      .map((row) => [row.id!, row.name!] as const),
  );
  const sourceRows = rows(bundle, "product");
  const candidates = sourceRows
    .map((row, rowIndex) => ({ row, rowIndex }))
    .filter(({ row }) => {
      if (truthy(row.isdeleted) || !truthy(row.isactive)) return false;
      return sourceType(productTypes.get(row.producttypeid ?? "")) !== null;
    });
  const identityCounts = new Map<string, number>();
  for (const { row } of candidates) {
    const name = identity(row.name);
    if (name) {
      identityCounts.set(
        `name:${name}`,
        (identityCounts.get(`name:${name}`) ?? 0) + 1,
      );
    }
    const sku = identity(row.customid);
    if (sku) {
      identityCounts.set(
        `sku:${sku}`,
        (identityCounts.get(`sku:${sku}`) ?? 0) + 1,
      );
    }
  }
  const conflicts = new Set(
    [...identityCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key),
  );

  const products: ShepherdProductImportRecord[] = [];
  const issues: ShepherdProductIssue[] = [];
  let deferredRows = 0;
  let excludedRows = 0;
  let errorRows = 0;

  sourceRows.forEach((row, rowIndex) => {
    if (truthy(row.isdeleted)) {
      excludedRows++;
      issues.push({ rowIndex, code: "deleted_product_excluded", severity: "warning" });
      return;
    }
    if (!truthy(row.isactive)) {
      excludedRows++;
      issues.push({ rowIndex, code: "inactive_product_excluded", severity: "warning" });
      return;
    }
    const rawType = productTypes.get(row.producttypeid ?? "");
    if (identity(rawType) === "service") {
      excludedRows++;
      issues.push({ rowIndex, code: "service_excluded", severity: "warning" });
      return;
    }
    const type = sourceType(rawType);
    if (!type) {
      excludedRows++;
      issues.push({ rowIndex, code: "unsupported_product_type", severity: "warning" });
      return;
    }
    if (!row.id) {
      errorRows++;
      issues.push({ rowIndex, code: "missing_product_identity", severity: "error" });
      return;
    }
    if (!row.name) {
      errorRows++;
      issues.push({ rowIndex, code: "missing_product_name", severity: "error" });
      return;
    }
    const unitPrice = money(row.price);
    if (!unitPrice) {
      errorRows++;
      issues.push({ rowIndex, code: "invalid_product_price", severity: "error" });
      return;
    }
    const sku = row.customid || undefined;
    const category = row.productcategoryid
      ? categories.get(row.productcategoryid)
      : undefined;
    if (row.name.length > 255) {
      errorRows++;
      issues.push({ rowIndex, code: "product_name_too_long", severity: "error" });
      return;
    }
    if ((sku?.length ?? 0) > 64) {
      errorRows++;
      issues.push({ rowIndex, code: "product_sku_too_long", severity: "error" });
      return;
    }
    if ((category?.length ?? 0) > 128) {
      errorRows++;
      issues.push({ rowIndex, code: "product_category_too_long", severity: "error" });
      return;
    }
    if (
      conflicts.has(`name:${identity(row.name)}`) ||
      (sku && conflicts.has(`sku:${identity(sku)}`))
    ) {
      deferredRows++;
      issues.push({ rowIndex, code: "conflicting_product_identity", severity: "warning" });
      return;
    }
    products.push({
      externalProductId: row.id,
      name: row.name,
      sku,
      category,
      sourceType: type,
      unitPrice,
      taxable: truthy(row.istaxable),
    });
  });

  return {
    products,
    issues,
    coverage: coverage(
      sourceRows.length,
      products.length,
      deferredRows,
      excludedRows,
      errorRows,
    ),
  };
}
