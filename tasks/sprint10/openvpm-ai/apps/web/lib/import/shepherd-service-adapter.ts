import type { ServiceImportRecord } from "@/lib/csv/import";
import { normalizeKey } from "@/lib/csv/parse";
import type {
  ShepherdBundleRows,
  ShepherdDomainCoverage,
} from "./shepherd-core-adapter";
import type { ShepherdRawRow } from "./shepherd-bundle";

export type ShepherdServiceIssueCode =
  | "deleted_service_excluded"
  | "inactive_service_excluded"
  | "non_service_catalog_item_excluded"
  | "conflicting_service_identity"
  | "missing_service_identity"
  | "missing_service_name"
  | "invalid_service_price"
  | "service_name_too_long"
  | "service_code_too_long"
  | "service_category_too_long";

export interface ShepherdServiceIssue {
  rowIndex: number;
  code: ShepherdServiceIssueCode;
  severity: "warning" | "error";
}

export interface ShepherdServiceAdaptation {
  services: ServiceImportRecord[];
  issues: ShepherdServiceIssue[];
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

function coverage(
  sourceRows: number,
  plannedRows: number,
  deferredRows: number,
  excludedRows: number,
  errorRows: number,
): ShepherdDomainCoverage {
  if (plannedRows + deferredRows + excludedRows + errorRows !== sourceRows) {
    throw new Error("Shepherd service coverage must account for every row.");
  }
  return { sourceRows, plannedRows, deferredRows, excludedRows, errorRows };
}

/**
 * Convert only non-stock Shepherd services. Products, medications, vaccines,
 * and injections stay out of this adapter because they require explicit
 * inventory and clinical semantics rather than a billing-only row copy.
 */
export function adaptShepherdServices(
  bundle: ShepherdBundleRows,
): ShepherdServiceAdaptation {
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
    .filter(
      ({ row }) =>
        !truthy(row.isdeleted) &&
        truthy(row.isactive) &&
        productTypes.get(row.producttypeid ?? "") === "Service",
    );
  const identityCounts = new Map<string, number>();
  for (const { row } of candidates) {
    const name = identity(row.name);
    if (name)
      identityCounts.set(
        `name:${name}`,
        (identityCounts.get(`name:${name}`) ?? 0) + 1,
      );
    const code = identity(row.customid);
    if (code)
      identityCounts.set(
        `code:${code}`,
        (identityCounts.get(`code:${code}`) ?? 0) + 1,
      );
  }
  const conflicts = new Set(
    [...identityCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key),
  );

  const services: ServiceImportRecord[] = [];
  const issues: ShepherdServiceIssue[] = [];
  let deferredRows = 0;
  let excludedRows = 0;
  let errorRows = 0;

  sourceRows.forEach((row, rowIndex) => {
    if (truthy(row.isdeleted)) {
      excludedRows++;
      issues.push({
        rowIndex,
        code: "deleted_service_excluded",
        severity: "warning",
      });
      return;
    }
    if (!truthy(row.isactive)) {
      excludedRows++;
      issues.push({
        rowIndex,
        code: "inactive_service_excluded",
        severity: "warning",
      });
      return;
    }
    if (productTypes.get(row.producttypeid ?? "") !== "Service") {
      excludedRows++;
      issues.push({
        rowIndex,
        code: "non_service_catalog_item_excluded",
        severity: "warning",
      });
      return;
    }
    if (!row.id) {
      errorRows++;
      issues.push({
        rowIndex,
        code: "missing_service_identity",
        severity: "error",
      });
      return;
    }
    if (!row.name) {
      errorRows++;
      issues.push({
        rowIndex,
        code: "missing_service_name",
        severity: "error",
      });
      return;
    }
    const defaultPrice = money(row.price);
    if (!defaultPrice) {
      errorRows++;
      issues.push({
        rowIndex,
        code: "invalid_service_price",
        severity: "error",
      });
      return;
    }
    const category = row.productcategoryid
      ? categories.get(row.productcategoryid)
      : undefined;
    const code = row.customid || undefined;
    if (row.name.length > 255) {
      errorRows++;
      issues.push({
        rowIndex,
        code: "service_name_too_long",
        severity: "error",
      });
      return;
    }
    if ((code?.length ?? 0) > 32) {
      errorRows++;
      issues.push({
        rowIndex,
        code: "service_code_too_long",
        severity: "error",
      });
      return;
    }
    if ((category?.length ?? 0) > 128) {
      errorRows++;
      issues.push({
        rowIndex,
        code: "service_category_too_long",
        severity: "error",
      });
      return;
    }
    if (
      conflicts.has(`name:${identity(row.name)}`) ||
      (code && conflicts.has(`code:${identity(code)}`))
    ) {
      deferredRows++;
      issues.push({
        rowIndex,
        code: "conflicting_service_identity",
        severity: "warning",
      });
      return;
    }

    services.push({
      externalServiceId: row.id,
      name: row.name,
      code,
      category,
      defaultPrice,
      taxable: truthy(row.istaxable),
    });
  });

  return {
    services,
    issues,
    coverage: coverage(
      sourceRows.length,
      services.length,
      deferredRows,
      excludedRows,
      errorRows,
    ),
  };
}
