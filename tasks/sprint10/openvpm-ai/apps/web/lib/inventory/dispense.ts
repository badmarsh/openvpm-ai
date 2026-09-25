/**
 * Pure inventory dispensing logic. Given a set of invoice/dispense line items,
 * compute how much to decrement from each product's stock. Services and lines
 * without a linked product id are ignored; quantities for the same product are
 * aggregated. No I/O — the caller performs the actual stock update.
 */

export interface DispensableItem {
  itemType: "service" | "product";
  itemId?: string | null;
  quantity: number;
}

export interface StockDeduction {
  productId: string;
  quantity: number;
}

export function computeStockDeductions(items: DispensableItem[]): StockDeduction[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.itemType !== "product") continue;
    if (!item.itemId) continue;
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) continue;
    totals.set(item.itemId, (totals.get(item.itemId) ?? 0) + item.quantity);
  }
  return [...totals.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}
