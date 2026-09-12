import { z } from "zod";
import { eq, and, isNull, or, ilike, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import { products, practices } from "@openpims/db";
import {
  parseWholesalerDeliveryNote,
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
   * Apply delivery note items into inventory (stock adjustments & new product additions).
   */
  apply: staffProcedure
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
            lotNumber: z.string().optional(),
            expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dátum musí byť YYYY-MM-DD").optional(),
            quantity: z.number().int().positive("Množstvo musí byť aspoň 1"),
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
