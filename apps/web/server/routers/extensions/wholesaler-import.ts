import { createHash, randomUUID } from "node:crypto";
import { matchInventoryProduct, normalizeProductName } from "@/lib/inventory/matching";
import { isInventoryOptionalExpirationDateInputValid } from "@/lib/inventory/policy";
import { IMPORT_ERRORS } from "@/lib/inventory/import-errors";
import { z } from "zod";
import { eq, and, isNull, or, ilike, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import { products, extAutomationEvents, extInventoryMetadata, extInventoryReceipts, controlledSubstanceLog } from "@openpims/db";
import { communications } from "@openpims/db";
import { parsePdfInvoice, type InvoiceParserAiConfig } from "@/lib/inventory/pdf-invoice-parser";
import { resolveFeatureConfig } from "@/lib/ai/ai-config-resolver";
import { isControlledSubstanceName } from "@/lib/controlled-substances/policy";
import {
  parseWholesalerDeliveryNote,
  parseDate,
  type WholesalerType,
} from "@/lib/inventory/wholesaler-import";
import { isMissingRelationError } from "@/lib/db/missing-relation";

const staffProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician", "front_desk")
);

const wholesalerTypeSchema = z.enum([
  "CYMEDICA",
  "PHARMOS",
  "SAMOHYL",
  "HENRY_SCHEIN",
  "BIOPHARM",
  "KOMVET",
  "SG_VET",
  "SANVET",
  "PHRAMED",
  "GENERIC_CSV",
  "TOPVET",
  "PHARMACOPOLA",
]);

/** Money input capped to a sane POS range (decimal with max 2 places). */
const importMoneyInput = z
  .string()
  .trim()
  .regex(/^\d+(?:[.,]\d{1,2})?$/, "Price must be nonnegative with at most two decimals")
  .max(16)
  .transform((v) => v.replace(",", "."))
  .refine(v => Number(v) <= 99999999.99, "Price exceeds storage limit");

const confirmItemSchema = z.object({
  action: z.enum(["update_stock", "create_product", "skip"]),
  productId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(255),
  sku: z.string().trim().max(64).optional(),
  category: z.string().trim().max(128).optional(),
  barcode: z.string().trim().max(64).optional(),
  activeSubstance: z.string().trim().max(255).optional(),
  isControlledSubstance: z.boolean().optional(),
  unit: z.string().trim().max(16).optional(),
  /** Purchase (unit) price from the delivery note, without VAT. */
  costPrice: importMoneyInput.optional(),
  /** Confirmed retail price after the markup review (without VAT). */
  retailPrice: importMoneyInput.optional(),
  /** VAT rate from the delivery note (informational, e.g. 5 / 19 / 23). */
  vatRate: z.coerce.number().min(0).max(100).optional(),
  lotNumber: z
    .string()
    .trim()
    .max(64)
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim() : "BEZ-SARZE")),
  expirationDate: z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      if (!v || !v.trim()) return undefined;
      return parseDate(v) || v;
    }).refine(v => !v || isInventoryOptionalExpirationDateInputValid(v), "Invalid expiration date"),
  quantity: z.coerce
    .number()
    .finite().positive().max(10000).multipleOf(0.001),
});

const FALLBACK_MARKUP_MULTIPLIER = 1.30;

/**
 * Derives the retail price for a confirmed line. Returns null when neither
 * the reviewed retail price nor a cost basis exists — callers must then keep
 * the catalog price untouched instead of overwriting it with a guess.
 */
function deriveRetailPrice(
  retailPrice: string | undefined,
  costPrice: string | undefined,
): string | null {
  if (retailPrice) return retailPrice;
  if (costPrice) {
    return (parseFloat(costPrice) * FALLBACK_MARKUP_MULTIPLIER).toFixed(2);
  }
  return null;
}

async function applyConfirmedItems(
  ctx: { practiceId: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  input: {
    deliveryNoteNumber: string;
    supplierName: string;
    items: z.infer<typeof confirmItemSchema>[];
  },
): Promise<{
  updatedCount: number;
  createdCount: number;
  skippedCount: number;
}> {
  let updatedCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  // Resolve catalog identities before any write; client names cannot disguise a controlled target.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ctx.practiceId + ":inventory-receipt"}))`);
  const catalog = await tx.select().from(products).where(and(
    eq(products.practiceId, ctx.practiceId), isNull(products.deletedAt),
  )).for("update");
  const metadataRows = await tx.select().from(extInventoryMetadata).where(eq(extInventoryMetadata.practiceId, ctx.practiceId));
  const controlledReview: Array<{ name: string; line: number }> = [];
  const targets = input.items.map((item, line) => {
    const candidates = item.productId ? catalog.filter((p: any) => p.id === item.productId)
      : item.sku ? catalog.filter((p: any) => p.sku?.toLowerCase() === item.sku?.toLowerCase()) : [];
    if (candidates.length > 1 && item.action !== "skip") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Ambiguous product code: choose a catalog product explicitly" });
    }
    const target = candidates[0];
    const controlled = item.isControlledSubstance || isControlledSubstanceName(item.name)
      || isControlledSubstanceName(item.activeSubstance ?? "") || isControlledSubstanceName(target?.name ?? "")
      || isControlledSubstanceName(metadataRows.find((m: any) => m.productId === target?.id)?.activeSubstance ?? "");
    if (controlled) {
      if (item.action !== "skip") throw new TRPCError({ code: "FORBIDDEN", message: IMPORT_ERRORS.controlled });
      controlledReview.push({ name: target && isControlledSubstanceName(target.name) ? target.name : item.name, line: line + 1 });
    }
    if (item.action === "update_stock" && !target) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    }
    return target;
  });
  const receiptKey = createHash("sha256").update(JSON.stringify([
    input.supplierName.trim().toLowerCase(), input.deliveryNoteNumber.trim().toLowerCase(),
  ])).digest("hex");
  const claimed = await tx.insert(extInventoryReceipts).values({
    practiceId: ctx.practiceId, receiptKey, supplierName: input.supplierName,
    deliveryNoteNumber: input.deliveryNoteNumber, controlledReview,
  }).onConflictDoNothing().returning({ id: extInventoryReceipts.id });
  if (!claimed.length) throw new TRPCError({ code: "CONFLICT", message: "Delivery note already imported" });

  for (const [index, item] of input.items.entries()) {
    if (item.action === "skip") { skippedCount++; continue; }
    const target = targets[index];
    const id = target?.id ?? randomUUID();
    if (target && target.stockQuantity + item.quantity > 2147483647) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Stock quantity exceeds the supported limit" });
    }
    const retailPrice = deriveRetailPrice(item.retailPrice, item.costPrice);
    if (target) {
      // Refuse silent mixing of different batches in the upstream single-lot stock model.
      if (target.stockQuantity > 0 && target.lotNumber && item.lotNumber && target.lotNumber !== item.lotNumber) {
        throw new TRPCError({ code: "CONFLICT", message: "Different batch: create a separate product or reconcile existing stock first" });
      }
      await tx.update(products).set({
        inventoryTracked: true,
        stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`,
        ...(retailPrice ? { unitPrice: retailPrice } : {}),
        ...(item.costPrice ? { costPrice: item.costPrice } : {}),
        ...(item.lotNumber ? { lotNumber: item.lotNumber } : {}),
        ...(item.expirationDate ? { expirationDate: item.expirationDate } : {}),
        ...(item.vatRate !== undefined ? { taxable: item.vatRate !== 0 } : {}),
      }).where(and(eq(products.id, id), eq(products.practiceId, ctx.practiceId), isNull(products.deletedAt)));
      updatedCount++;
    } else {
      if (!retailPrice) throw new TRPCError({ code: "BAD_REQUEST", message: "A reviewed price is required" });
      await tx.insert(products).values({
        id, practiceId: ctx.practiceId, name: item.name, sku: item.sku || null,
        category: item.category || null, unitPrice: retailPrice, costPrice: item.costPrice || null,
        taxable: item.vatRate !== 0, stockQuantity: item.quantity, inventoryTracked: true,
        lotNumber: item.lotNumber || null, expirationDate: item.expirationDate || null,
        // Receipt provenance belongs to ext_inventory_receipts, not migration identity columns.
      });
      createdCount++;
    }
    const metadata = {
      supplierName: input.supplierName, supplierCode: item.sku || null,
      ...(item.barcode ? { barcode: item.barcode } : {}),
      ...(item.activeSubstance ? { activeSubstance: item.activeSubstance } : {}),
      ...(item.vatRate !== undefined ? { vatRate: String(item.vatRate) } : {}),
    };
    await tx.insert(extInventoryMetadata).values({ practiceId: ctx.practiceId, productId: id, ...metadata })
      .onConflictDoUpdate({ target: [extInventoryMetadata.practiceId, extInventoryMetadata.productId], set: metadata });
  }
  return { updatedCount, createdCount, skippedCount };
}

function missingInventoryImportSchema(err: unknown) {
  return (
    isMissingRelationError(err, "ext_inventory_metadata") ||
    isMissingRelationError(err, "ext_inventory_receipts")
  );
}

function missingInventoryImportSchemaError() {
  return new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "Inventory import tables are missing. Apply database migrations (pnpm db:migrate or pnpm db:push) and retry.",
  });
}

async function importCatalog(ctx: { db: any; practiceId: string }, supplierName: string) {
  const catalogWhere = and(eq(products.practiceId, ctx.practiceId), isNull(products.deletedAt));
  try {
    const rows = await ctx.db.select({
      id: products.id, name: products.name, sku: products.sku,
      stockQuantity: products.stockQuantity, lotNumber: products.lotNumber,
      expirationDate: products.expirationDate, unitPrice: products.unitPrice,
      category: products.category,
      barcode: extInventoryMetadata.barcode, supplierCode: extInventoryMetadata.supplierCode,
      supplierName: extInventoryMetadata.supplierName, activeSubstance: extInventoryMetadata.activeSubstance,
    }).from(products).leftJoin(extInventoryMetadata, and(
      eq(products.id, extInventoryMetadata.productId), eq(extInventoryMetadata.practiceId, ctx.practiceId),
    )).where(catalogWhere);
    return rows.map((p: any) => ({ ...p, supplierCode: p.supplierName === supplierName ? p.supplierCode : null }));
  } catch (err) {
    if (!isMissingRelationError(err, "ext_inventory_metadata")) throw err;
    const rows = await ctx.db.select({
      id: products.id, name: products.name, sku: products.sku,
      stockQuantity: products.stockQuantity, lotNumber: products.lotNumber,
      expirationDate: products.expirationDate, unitPrice: products.unitPrice,
      category: products.category,
    }).from(products).where(catalogWhere);
    return rows.map((p: any) => ({
      ...p,
      barcode: null,
      supplierCode: null,
      supplierName: null,
      activeSubstance: null,
    }));
  }
}

function matchItems(items: any[], catalog: any[]) {
  return items.map(item => {
    const matched = matchInventoryProduct(item, catalog);
    const controlled = !!item.isControlledSubstance || isControlledSubstanceName(item.name) || isControlledSubstanceName(matched?.name ?? "")
      || isControlledSubstanceName(matched?.activeSubstance ?? "");
    return { ...item, isControlledSubstance: controlled,
      category: matched?.category?.toLowerCase() ?? "medication",
      matchedProduct: matched ? { id: matched.id, name: matched.name, sku: matched.sku,
        currentStock: matched.stockQuantity, currentLot: matched.lotNumber,
        currentExpiration: matched.expirationDate, currentUnitPrice: matched.unitPrice } : null,
      suggestedAction: controlled || item.quantity <= 0 ? "skip" : matched ? "update_stock" : "create_product",
    };
  });
}
async function parsePdfForImport(buffer: Buffer, ctx: { db: any; practiceId: string }) {
  let config: InvoiceParserAiConfig | undefined;
  try {
    const resolved = await resolveFeatureConfig(ctx.db, ctx.practiceId, "invoiceParser");
    if (resolved.baseUrl && resolved.apiKey) config = { baseUrl: resolved.baseUrl, apiKey: resolved.apiKey, model: resolved.modelId };
  } catch { /* deterministic parser remains available */ }
  let extraction;
  try { extraction = await parsePdfInvoice(buffer, config); }
  catch (error) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error && Object.values(IMPORT_ERRORS).some(v => v === error.message) ? error.message : IMPORT_ERRORS.corrupted });
  }
  if (!extraction.items.length) throw new TRPCError({ code: "BAD_REQUEST", message: IMPORT_ERRORS.noItems });
  return {
    deliveryNote: { wholesaler: undefined, deliveryNoteNumber: extraction.invoiceNumber,
      issueDate: extraction.issueDate, supplierName: extraction.supplierName,
      totalWithoutVat: extraction.totalWithoutVat, totalWithVat: extraction.totalWithVat },
    items: matchItems(extraction.items, await importCatalog(ctx, extraction.supplierName)),
  };
}

export const wholesalerImportRouter = createRouter({
  parsePdf: staffProcedure.input(z.object({ base64: z.string().min(1).max(6_990_508) }))
    .mutation(({ ctx, input }) => parsePdfForImport(Buffer.from(input.base64, "base64"), ctx)),
  linkControlledReview: protectedProcedure.use(requireRole("veterinarian", "admin"))
    .input(z.object({ receiptId: z.string().uuid(), line: z.number().int().positive(), entryId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => ctx.db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ctx.practiceId + ":opl-review:" + input.entryId}))`);
      const used = await tx.select({ id: extInventoryReceipts.id }).from(extInventoryReceipts).where(and(
        eq(extInventoryReceipts.practiceId, ctx.practiceId),
        sql`${extInventoryReceipts.controlledReview} @> ${JSON.stringify([{ ledgerId: input.entryId }])}::jsonb`,
      )).limit(1);
      if (used.length) throw new TRPCError({ code: "CONFLICT", message: "This manual receipt is already linked" });
      const [receipt] = await tx.select().from(extInventoryReceipts).where(and(
        eq(extInventoryReceipts.id, input.receiptId), eq(extInventoryReceipts.practiceId, ctx.practiceId),
      )).for("update");
      const review = receipt?.controlledReview.find(r => r.line === input.line);
      const [entry] = await tx.select().from(controlledSubstanceLog).where(and(
        eq(controlledSubstanceLog.id, input.entryId), eq(controlledSubstanceLog.practiceId, ctx.practiceId),
        eq(controlledSubstanceLog.action, "received"), eq(controlledSubstanceLog.performedBy, ctx.user.id),
        isNull(controlledSubstanceLog.deletedAt),
      ));
      if (!review || review.ledgerId || !entry || normalizeProductName(entry.drugName) !== normalizeProductName(review.name)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Manual receipt entry must match the source drug and reviewing clinician" });
      }
      await tx.update(extInventoryReceipts).set({ controlledReview: receipt.controlledReview.map(r =>
        r.line === input.line ? { ...r, ledgerId: entry.id } : r,
      ) }).where(and(eq(extInventoryReceipts.id, receipt.id), eq(extInventoryReceipts.practiceId, ctx.practiceId)));
      return { success: true };
    })),
  pendingControlledReviews: protectedProcedure.use(requireRole("admin", "veterinarian"))
    .query(({ ctx }) => ctx.db.select().from(extInventoryReceipts).where(and(
      eq(extInventoryReceipts.practiceId, ctx.practiceId),
      sql`jsonb_path_exists(${extInventoryReceipts.controlledReview}, '$[*] ? (!exists(@.ledgerId))')`,
    )).orderBy(extInventoryReceipts.createdAt).limit(100)),

  /**
   * Parse delivery note from file content and attempt to match items to existing clinic inventory.
   */
  parse: staffProcedure
    .input(
      z.object({
        content: z.string().min(1, "Delivery note is empty").max(5_242_880, "File exceeds 5 MB"),
        wholesaler: wholesalerTypeSchema.optional(),
        filename: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let parsed;
      try {
        parsed = parseWholesalerDeliveryNote({
          content: input.content,
          wholesaler: input.wholesaler,
          filename: input.filename,
        });
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to parse delivery note",
        });
      }

      if (!parsed.items.length) throw new TRPCError({ code: "BAD_REQUEST", message: IMPORT_ERRORS.noItems });
      const itemsWithMatch = matchItems(parsed.items, await importCatalog(ctx, parsed.supplierName));

      return {
        deliveryNote: {
          wholesaler: parsed.wholesaler,
          deliveryNoteNumber: parsed.deliveryNoteNumber,
          issueDate: parsed.issueDate,
          supplierName: parsed.supplierName,
          supplierIco: parsed.supplierIco,
          totalWithoutVat: parsed.totalWithoutVat,
          totalVat: parsed.totalVat,
          totalWithVat: parsed.totalWithVat,
        },
        items: itemsWithMatch,
      };
    }),
  /**
   * Parse a PDF invoice attachment from the inbox and return items in the
   * format WholesalerImportDialog expects, with product matching applied.
   */
  parseAttachmentForImport: staffProcedure
    .input(
      z.object({
        communicationId: z.string().uuid(),
        attachmentId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [comm] = await ctx.db
        .select({
          id: communications.id,
          providerMessageId: communications.providerMessageId,
          channel: communications.channel,
        })
        .from(communications)
        .where(
          and(
            eq(communications.id, input.communicationId),
            eq(communications.practiceId, ctx.practiceId),
            isNull(communications.deletedAt)
          )
        )
        .limit(1);

      if (!comm) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Communication not found" });
      }
      if (comm.channel !== "email") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only email attachments are supported" });
      }
      if (!comm.providerMessageId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No provider email ID for this communication" });
      }

      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Resend API key not configured" });
      }

      const resendUrl =
        "https://api.resend.com/emails/receiving/" +
        comm.providerMessageId +
        "/attachments/" +
        input.attachmentId;
      const attRes = await fetch(resendUrl, {
        headers: { Authorization: "Bearer " + apiKey },
      });
      if (!attRes.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to fetch attachment from Resend: " + attRes.status,
        });
      }

      const attData = (await attRes.json()) as { download_url?: string };
      const downloadUrl = attData.download_url;
      if (!downloadUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Resend attachment download URL not found" });
      }

      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to download PDF from Resend CDN: " + fileRes.status,
        });
      }

      const pdfBuffer = Buffer.from(await fileRes.arrayBuffer());

      return parsePdfForImport(pdfBuffer, ctx);
    }),


  /**
   * Search the practice inventory catalog so staff can manually link an
   * unmatched delivery-note line to an existing product.
   */
  searchProducts: staffProcedure
    .input(
      z.object({
        query: z.string().trim().min(1).max(128),
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const q = `%${input.query.trim().replace(/[%_\\]/g, "\\$&")}%`;
      const columns = {
        id: products.id,
        name: products.name,
        sku: products.sku,
        stockQuantity: products.stockQuantity,
        unitPrice: products.unitPrice,
        lotNumber: products.lotNumber,
        expirationDate: products.expirationDate,
      };
      const scoped = [
        eq(products.practiceId, ctx.practiceId),
        isNull(products.deletedAt),
      ] as const;
      try {
        return await ctx.db
          .select(columns)
          .from(products)
          .where(
            and(
              ...scoped,
              or(
                ilike(products.name, q),
                ilike(products.sku, q),
                sql`exists (select 1 from ${extInventoryMetadata} m where m.practice_id = ${ctx.practiceId} and m.product_id = ${products.id} and m.barcode ilike ${q})`,
              ),
            ),
          )
          .orderBy(products.name)
          .limit(input.limit);
      } catch (err) {
        if (!isMissingRelationError(err, "ext_inventory_metadata")) throw err;
        return ctx.db
          .select(columns)
          .from(products)
          .where(and(...scoped, or(ilike(products.name, q), ilike(products.sku, q))))
          .orderBy(products.name)
          .limit(input.limit);
      }
    }),

  /**
   * Confirm the reviewed delivery note and add the items into stock.
   *
   * Applies confirmed retail prices (after markup), batch/LOT + expiry
   * tracking and creates a durable `inventory_delivery_received` automation
   * event. Duplicate-safe per (practice, supplier, delivery note) so a
   * double-confirm cannot add stock twice.
   */
  confirmImport: staffProcedure
    .input(
      z.object({
        deliveryNoteNumber: z.string().trim().min(1).max(64),
        supplierName: z.string().trim().min(1).max(255),
        wholesaler: wholesalerTypeSchema.optional(),
        issueDate: z.string().optional(),
        items: z.array(confirmItemSchema).min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let counts;
      try {
      counts = await ctx.db.transaction(async tx => {
        const result = await applyConfirmedItems(ctx, tx, input);
        // Durable outbox: commit stock, pending OPL and event atomically. Workers run after commit.
        await tx.insert(extAutomationEvents).values({
          practiceId: ctx.practiceId, eventType: "inventory_delivery_received",
          sourceRouter: "wholesalerImport.confirmImport",
          dedupeKey: `inventory_delivery_${ctx.practiceId}_${createHash("sha256").update(input.supplierName + ":" + input.deliveryNoteNumber).digest("hex")}`,
          emittedBy: ctx.user.id, status: "pending", availableAt: new Date(),
          payload: { deliveryNoteNumber: input.deliveryNoteNumber, supplierName: input.supplierName,
            wholesaler: input.wholesaler ?? null, ...result },
        }).onConflictDoNothing();
        return result;
      });
      } catch (err) {
        if (missingInventoryImportSchema(err)) throw missingInventoryImportSchemaError();
        throw err;
      }

      return {
        success: true,
        deliveryNoteNumber: input.deliveryNoteNumber,
        ...counts,
      };
    }),

  /**
   * Apply delivery note items into inventory (stock adjustments & new product additions).
   * @deprecated Prefer confirmImport — kept for backward compatibility with the
   * legacy dialog and existing integrations.
   */
  applyDeliveryNote: staffProcedure.input(z.object({
    deliveryNoteNumber: z.string().trim().min(1).max(64),
    supplierName: z.string().trim().min(1).max(255),
    items: z.array(confirmItemSchema.extend({ unitPrice: importMoneyInput.optional() })).min(1).max(500),
  })).mutation(async ({ ctx, input }) => {
    try {
      const counts = await ctx.db.transaction(tx => applyConfirmedItems(ctx, tx, {
        ...input, items: input.items.map(item => ({ ...item, retailPrice: item.retailPrice ?? item.unitPrice })),
      }));
      return { success: true, deliveryNoteNumber: input.deliveryNoteNumber, ...counts };
    } catch (err) {
      if (missingInventoryImportSchema(err)) throw missingInventoryImportSchemaError();
      throw err;
    }
  }),
});
