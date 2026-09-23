import { and, eq, isNull } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../../trpc";
import { extInventoryMetadata, suppliers } from "@openpims/db";
export const inventoryMetadataRouter = createRouter({
  suppliers: protectedProcedure.query(async ({ ctx }) => {
    const [imported, catalog] = await Promise.all([
      ctx.db.selectDistinct({ name: extInventoryMetadata.supplierName }).from(extInventoryMetadata)
        .where(eq(extInventoryMetadata.practiceId, ctx.practiceId)),
      ctx.db.select({ name: suppliers.name }).from(suppliers)
        .where(and(eq(suppliers.practiceId, ctx.practiceId), isNull(suppliers.deletedAt))),
    ]);
    return [...new Set([...imported, ...catalog].map(s => s.name))].sort();
  }),
});
