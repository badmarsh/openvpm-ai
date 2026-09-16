import { z } from "zod";
import { eq, and, isNull, or, ilike, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import { products, extAutomationEvents } from "@openpims/db";
import {
  parseWholesalerDeliveryNote,
  parseDate,
  type WholesalerType,
} from "@/lib/inventory/wholesaler-import";

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
]);

/** Money input capped to a sane POS range (decimal with max 2 places). */
const importMoneyInput = z
  .string()
  .trim()
  .regex(/^\d+(?:[.,]\d{1,2})?$/, "Cena musí byť kladné číslo s najviac 2 desatinnými miestami")
  .max(16)
  .transform((v) => v.replace(",", "."));

const confirmItemSchema = z.object({
  action: z.enum(["update_stock", "create_product", "skip"]),
  productId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(255),
  sku: z.string().trim().max(64).optional(),
  category: z.string().trim().max(128).optional(),
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
      return parseDate(v) || (v.match(/^\d{4}-\d{2}-\d{2}$/) ? v : undefined);
    }),
  quantity: z.coerce
    .number()
    .positive("Množstvo musí byť aspoň 1")
    .transform((v) => Math.max(1, Math.round(v))),
});

const FALLBACK_MARKUP_MULTIPLIER = 1.25;

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
  const externalSource = `wholesaler:${input.supplierName}`;

  const buildStockUpdatePayload = (
    item: z.infer<typeof confirmItemSchema>,
  ): Record<string, unknown> => {
    const retailPrice = deriveRetailPrice(item.retailPrice, item.costPrice);
    const updatePayload: Record<string, unknown> = {
      stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`,
    };
    if (retailPrice) updatePayload.unitPrice = retailPrice;
    if (item.lotNumber) updatePayload.lotNumber = item.lotNumber;
    if (item.expirationDate) updatePayload.expirationDate = item.expirationDate;
    if (item.costPrice) updatePayload.costPrice = item.costPrice;
    return updatePayload;
  };

  for (const item of input.items) {
    if (item.action === "skip") {
      skippedCount++;
      continue;
    }

    if (item.action === "update_stock" && item.productId) {
      await tx
        .update(products)
        .set(buildStockUpdatePayload(item))
        .where(
          and(
            eq(products.id, item.productId),
            eq(products.practiceId, ctx.practiceId),
            isNull(products.deletedAt)
          )
        );
      updatedCount++;
      continue;
    }

    // create_product — with idempotency: an identical line from the SAME
    // delivery note (same sku, or same external delivery-note identity) is
    // upgraded to a stock update instead of creating a duplicate product.
    const duplicateCandidates = await tx
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.practiceId, ctx.practiceId),
          isNull(products.deletedAt),
          or(
            item.sku ? eq(products.sku, item.sku) : undefined,
            and(
              eq(products.externalSource, externalSource),
              eq(products.externalId, input.deliveryNoteNumber),
              eq(products.name, item.name),
            ),
          ),
        ),
      )
      .limit(1);

    const duplicate = duplicateCandidates[0] as { id: string } | undefined;
    if (duplicate) {
      await tx
        .update(products)
        .set(buildStockUpdatePayload(item))
        .where(
          and(
            eq(products.id, duplicate.id),
            eq(products.practiceId, ctx.practiceId),
            isNull(products.deletedAt)
          )
        );
      updatedCount++;
      continue;
    }

    await tx.insert(products).values({
      practiceId: ctx.practiceId,
      name: item.name,
      sku: item.sku || null,
      category: item.category || "Lieky a materiály",
      unitPrice:
        deriveRetailPrice(item.retailPrice, item.costPrice) ?? "10.00",
      costPrice: item.costPrice || null,
      stockQuantity: item.quantity,
      inventoryTracked: true,
      lotNumber: item.lotNumber || null,
      expirationDate: item.expirationDate || null,
      externalSource,
      externalId: input.deliveryNoteNumber,
    });
    createdCount++;
  }

  return { updatedCount, createdCount, skippedCount };
}

export const wholesalerImportRouter = createRouter({
  /**
   * Parse delivery note from file content and attempt to match items to existing clinic inventory.
   */
  parse: staffProcedure
    .input(
      z.object({
        content: z.string().min(1, "Obsah dodacieho listu je prázdny").max(5_242_880, "Súbor je príliš veľký (max 5 MB)"),
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
          message: `Chyba pri parsovaní dodacieho listu: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      // Fetch all active products for the practice to match items
      const existingProducts = await ctx.db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          stockQuantity: products.stockQuantity,
          lotNumber: products.lotNumber,
          expirationDate: products.expirationDate,
          unitPrice: products.unitPrice,
          costPrice: products.costPrice,
        })
        .from(products)
        .where(
          and(
            eq(products.practiceId, ctx.practiceId),
            isNull(products.deletedAt)
          )
        );

      const itemsWithMatch = parsed.items.map((item) => {
        // Priority 1: Match by SKU/EAN/SUKL
        const matchBySku = existingProducts.find(
          (p) =>
            (item.sku && p.sku && p.sku.toLowerCase() === item.sku.toLowerCase()) ||
            (item.ean && p.sku && p.sku.toLowerCase() === item.ean.toLowerCase()) ||
            (item.suklOrAdcCode && p.sku && p.sku.toLowerCase() === item.suklOrAdcCode.toLowerCase())
        );

        // Priority 2: Match by exact or partial name
        const matchByName = matchBySku
          ? null
          : existingProducts.find(
              (p) =>
                p.name.toLowerCase() === item.name.toLowerCase() ||
                p.name.toLowerCase().includes(item.name.toLowerCase()) ||
                item.name.toLowerCase().includes(p.name.toLowerCase())
            );

        const matched = matchBySku || matchByName;

        return {
          ...item,
          matchedProduct: matched
            ? {
                id: matched.id,
                name: matched.name,
                sku: matched.sku,
                currentStock: matched.stockQuantity,
                currentLot: matched.lotNumber,
                currentExpiration: matched.expirationDate,
                currentUnitPrice: matched.unitPrice,
              }
            : null,
          suggestedAction: (matched ? "update_stock" : "create_product") as "update_stock" | "create_product",
        };
      });

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
      const q = `%${input.query.trim()}%`;
      return ctx.db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          stockQuantity: products.stockQuantity,
          unitPrice: products.unitPrice,
          lotNumber: products.lotNumber,
          expirationDate: products.expirationDate,
        })
        .from(products)
        .where(
          and(
            eq(products.practiceId, ctx.practiceId),
            isNull(products.deletedAt),
            or(ilike(products.name, q), ilike(products.sku, q)),
          )
        )
        .orderBy(products.name)
        .limit(input.limit);
    }),

  /**
   * Confirm the reviewed delivery note and add the items into stock.
   *
   * Applies confirmed retail prices (after markup), batch/LOT + expiry
   * tracking and creates a durable `inventory_delivery_received` automation
   * event. Duplicate-safe per (supplier, delivery note, sku/name) so a
   * double-confirm cannot create duplicate catalog entries.
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
      const counts = await ctx.db.transaction(async (tx) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        applyConfirmedItems(ctx, tx as any, input),
      );

      // ── Post-commit: emit inventory_delivery_received into the event bus ──
      // Fire-and-forget outside the stock transaction (SKILL.md §7): an event
      // failure must never roll back a completed stock receipt. Idempotent
      // per delivery note via deterministic dedupeKey.
      void (ctx.db as any)
        .insert(extAutomationEvents)
        .values({
          practiceId: ctx.practiceId,
          eventType: "inventory_delivery_received",
          sourceRouter: "wholesalerImport.confirmImport",
          dedupeKey: `inventory_delivery_${ctx.practiceId}_${input.deliveryNoteNumber}`,
          emittedBy: ctx.user?.id ?? null,
          status: "pending",
          availableAt: new Date(),
          payload: {
            deliveryNoteNumber: input.deliveryNoteNumber,
            supplierName: input.supplierName,
            wholesaler: input.wholesaler ?? null,
            updatedCount: counts.updatedCount,
            createdCount: counts.createdCount,
            skippedCount: counts.skippedCount,
          },
        })
        .onConflictDoNothing()
        .catch((err: unknown) => {
          console.error(
            "[automation] inventory_delivery_received event insertion failed",
            err,
          );
        });

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
  applyDeliveryNote: staffProcedure
    .input(
      z.object({
        deliveryNoteNumber: z.string().min(1),
        supplierName: z.string().min(1),
        issueDate: z.string().optional(),
        items: z.array(
          z.object({
            action: z.enum(["update_stock", "create_product", "skip"]),
            productId: z.string().uuid().optional(),
            name: z.string().min(1),
            sku: z.string().optional(),
            category: z.string().optional(),
            unitPrice: z.string().optional(),
            costPrice: z.string().optional(),
            lotNumber: z
              .string()
              .optional()
              .nullable()
              .transform((v) => (v && v.trim() ? v.trim() : "BEZ-SARZE")),
            expirationDate: z
              .string()
              .optional()
              .nullable()
              .transform((v) => {
                if (!v || !v.trim()) return undefined;
                return parseDate(v) || (v.match(/^\d{4}-\d{2}-\d{2}$/) ? v : undefined);
              }),
            quantity: z
              .coerce
              .number()
              .positive("Množstvo musí byť aspoň 1")
              .transform((v) => Math.max(1, Math.round(v))),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let updatedCount = 0;
      let createdCount = 0;
      let skippedCount = 0;

      await ctx.db.transaction(async (tx) => {
        for (const item of input.items) {
          if (item.action === "skip") {
            skippedCount++;
            continue;
          }

          if (item.action === "update_stock" && item.productId) {
            // Update stock and optionally lot / expiration if newer/provided
            const updatePayload: Record<string, unknown> = {
              stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`,
            };
            if (item.lotNumber) {
              updatePayload.lotNumber = item.lotNumber;
            }
            if (item.expirationDate) {
              updatePayload.expirationDate = item.expirationDate;
            }
            if (item.costPrice) {
              updatePayload.costPrice = item.costPrice;
            }

            await tx
              .update(products)
              .set(updatePayload)
              .where(
                and(
                  eq(products.id, item.productId),
                  eq(products.practiceId, ctx.practiceId),
                  isNull(products.deletedAt)
                )
              );
            updatedCount++;
          } else if (item.action === "create_product") {
            const calculatedUnitPrice = item.unitPrice
              ? item.unitPrice
              : item.costPrice
              ? (parseFloat(item.costPrice) * 1.25).toFixed(2)
              : "10.00";

            await tx.insert(products).values({
              practiceId: ctx.practiceId,
              name: item.name,
              sku: item.sku || null,
              category: item.category || "Lieky a materiály",
              unitPrice: calculatedUnitPrice,
              costPrice: item.costPrice || null,
              stockQuantity: item.quantity,
              inventoryTracked: true,
              lotNumber: item.lotNumber || null,
              expirationDate: item.expirationDate || null,
              externalSource: `wholesaler:${input.supplierName}`,
              externalId: input.deliveryNoteNumber,
            });
            createdCount++;
          }
        }
      });

      return {
        success: true,
        deliveryNoteNumber: input.deliveryNoteNumber,
        updatedCount,
        createdCount,
        skippedCount,
      };
    }),
});

