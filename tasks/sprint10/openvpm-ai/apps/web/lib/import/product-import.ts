import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { migrationRuns, practices, products } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import { migrationImportFingerprint } from "./fingerprint";
import type {
  ShepherdProductAdaptation,
  ShepherdProductImportRecord,
} from "./shepherd-product-adapter";

export const PRODUCT_IMPORT_PLAN_VERSION = "product-v1";

type ProductImportRow = typeof products.$inferInsert;

export interface ProductImportPlan {
  version: typeof PRODUCT_IMPORT_PLAN_VERSION;
  practiceId: string;
  source: string;
  planHash: string;
  sourcePayloadHash: string;
  sourcePayloadSizeBytes: number;
  ready: boolean;
  totals: {
    sourceRows: number;
    plannedInsertCount: number;
    duplicateCount: number;
    deferredCount: number;
    excludedCount: number;
    errorCount: number;
  };
  /** Internal insert plan. Never serialize this property into shared evidence. */
  _rows: ProductImportRow[];
}

export interface ProductImportCommitResult {
  planHash: string;
  importedCount: number;
  duplicateCount: number;
  deferredCount: number;
  alreadyCommitted: boolean;
}

export class ProductImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductImportError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function sourcePayload(input: ShepherdProductAdaptation) {
  const payload = JSON.stringify({
    records: input.products,
    coverage: input.coverage,
  });
  return {
    hash: sha256(payload),
    size: Math.max(1, Buffer.byteLength(payload, "utf8")),
  };
}

function productFingerprint(
  source: string,
  record: ShepherdProductImportRecord,
): string {
  return migrationImportFingerprint("products", [
    source,
    record.externalProductId,
    record.name,
    record.sku ?? null,
    record.category ?? null,
    record.sourceType,
    record.unitPrice,
    record.taxable ? "true" : "false",
    "inventory_untracked",
  ]);
}

export async function planProductImport(
  db: Database,
  input: {
    practiceId: string;
    source: string;
    adaptation: ShepherdProductAdaptation;
  },
): Promise<ProductImportPlan> {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(input.source)) {
    throw new ProductImportError("Migration source is invalid.");
  }
  const existing = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      externalSource: products.externalSource,
      externalId: products.externalId,
      importFingerprint: products.importFingerprint,
      deletedAt: products.deletedAt,
    })
    .from(products)
    .where(eq(products.practiceId, input.practiceId));

  const byExternalId = new Map(
    existing
      .filter(
        (row) =>
          row.externalSource === input.source && row.externalId !== null,
      )
      .map((row) => [row.externalId!, row]),
  );
  const byFingerprint = new Map(
    existing
      .filter((row) => row.importFingerprint !== null)
      .map((row) => [row.importFingerprint!, row]),
  );
  const activeNames = new Set(
    existing
      .filter((row) => row.deletedAt === null)
      .map((row) => normalized(row.name))
      .filter(Boolean),
  );
  const activeSkus = new Set(
    existing
      .filter((row) => row.deletedAt === null)
      .map((row) => normalized(row.sku))
      .filter(Boolean),
  );

  const rows: ProductImportRow[] = [];
  let duplicateCount = 0;
  let deferredExistingCount = 0;
  let errorCount = input.adaptation.coverage.errorRows;

  for (const record of input.adaptation.products) {
    const fingerprint = productFingerprint(input.source, record);
    const external = byExternalId.get(record.externalProductId);
    if (external) {
      if (external.deletedAt !== null || external.importFingerprint !== fingerprint) {
        errorCount++;
      } else {
        duplicateCount++;
      }
      continue;
    }
    const sameFingerprint = byFingerprint.get(fingerprint);
    if (sameFingerprint) {
      errorCount++;
      continue;
    }
    const name = normalized(record.name);
    const sku = normalized(record.sku);
    if (activeNames.has(name) || (sku && activeSkus.has(sku))) {
      deferredExistingCount++;
      continue;
    }

    const id = randomUUID();
    rows.push({
      id,
      practiceId: input.practiceId,
      name: record.name,
      sku: record.sku ?? null,
      category: record.category ?? record.sourceType,
      unitPrice: record.unitPrice,
      taxable: record.taxable,
      costPrice: null,
      inventoryTracked: false,
      stockQuantity: 0,
      reorderPoint: null,
      lotNumber: null,
      expirationDate: null,
      externalSource: input.source,
      externalId: record.externalProductId,
      importFingerprint: fingerprint,
    });
    activeNames.add(name);
    if (sku) activeSkus.add(sku);
    byExternalId.set(record.externalProductId, {
      id,
      name: record.name,
      sku: record.sku ?? null,
      externalSource: input.source,
      externalId: record.externalProductId,
      importFingerprint: fingerprint,
      deletedAt: null,
    });
    byFingerprint.set(fingerprint, byExternalId.get(record.externalProductId)!);
  }

  const payload = sourcePayload(input.adaptation);
  const planHash = sha256(
    JSON.stringify({
      version: PRODUCT_IMPORT_PLAN_VERSION,
      practiceId: input.practiceId,
      source: input.source,
      sourcePayloadHash: payload.hash,
      coverage: input.adaptation.coverage,
    }),
  );
  return {
    version: PRODUCT_IMPORT_PLAN_VERSION,
    practiceId: input.practiceId,
    source: input.source,
    planHash,
    sourcePayloadHash: payload.hash,
    sourcePayloadSizeBytes: payload.size,
    ready: errorCount === 0,
    totals: {
      sourceRows: input.adaptation.coverage.sourceRows,
      plannedInsertCount: rows.length,
      duplicateCount,
      deferredCount:
        input.adaptation.coverage.deferredRows + deferredExistingCount,
      excludedCount: input.adaptation.coverage.excludedRows,
      errorCount,
    },
    _rows: rows,
  };
}

export async function commitProductImport(
  db: Database,
  input: {
    practiceId: string;
    actorId: string;
    source: string;
    expectedPlanHash: string;
    adaptation: ShepherdProductAdaptation;
  },
): Promise<ProductImportCommitResult> {
  return db.transaction(async (tx) => {
    const database = tx as unknown as Database;
    const [practice] = await database
      .select({ id: practices.id, recoveryHold: practices.recoveryHold })
      .from(practices)
      .where(
        and(eq(practices.id, input.practiceId), isNull(practices.deletedAt)),
      )
      .limit(1)
      .for("update");
    if (!practice) throw new ProductImportError("Practice not found.");
    if (!practice.recoveryHold) {
      throw new ProductImportError(
        "Product migration requires an active practice recovery hold.",
      );
    }

    const plan = await planProductImport(database, input);
    if (!plan.ready) {
      throw new ProductImportError(
        "Product migration plan contains unresolved structural errors.",
      );
    }
    if (plan.planHash !== input.expectedPlanHash) {
      throw new ProductImportError("Product migration plan changed after review.");
    }

    const [prior] = await database
      .select({ id: migrationRuns.id })
      .from(migrationRuns)
      .where(
        and(
          eq(migrationRuns.practiceId, input.practiceId),
          eq(migrationRuns.mode, "products"),
          eq(migrationRuns.source, input.source),
          eq(migrationRuns.fileHash, plan.sourcePayloadHash),
          eq(migrationRuns.status, "committed"),
          isNull(migrationRuns.deletedAt),
        ),
      )
      .limit(1);
    if (prior) {
      if (plan._rows.length !== 0) {
        throw new ProductImportError(
          "Committed product evidence does not match current catalog rows.",
        );
      }
      return {
        planHash: plan.planHash,
        importedCount: 0,
        duplicateCount: plan.totals.duplicateCount,
        deferredCount: plan.totals.deferredCount,
        alreadyCommitted: true,
      };
    }

    for (let offset = 0; offset < plan._rows.length; offset += 500) {
      await database.insert(products).values(plan._rows.slice(offset, offset + 500));
    }
    const now = new Date();
    await database.insert(migrationRuns).values({
      id: randomUUID(),
      practiceId: input.practiceId,
      createdBy: input.actorId,
      committedBy: input.actorId,
      mode: "products",
      source: input.source,
      fileHash: plan.sourcePayloadHash,
      reviewedPlanHash: plan.planHash,
      fileSizeBytes: plan.sourcePayloadSizeBytes,
      status: "committed",
      sourceRowCount: plan.totals.sourceRows,
      plannedInsertCount: plan.totals.plannedInsertCount,
      duplicateCount: plan.totals.duplicateCount,
      unmatchedCount: plan.totals.deferredCount,
      errorCount: plan.totals.errorCount,
      importedCount: plan._rows.length,
      previewExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      committedAt: now,
    });
    return {
      planHash: plan.planHash,
      importedCount: plan._rows.length,
      duplicateCount: plan.totals.duplicateCount,
      deferredCount: plan.totals.deferredCount,
      alreadyCommitted: false,
    };
  });
}
