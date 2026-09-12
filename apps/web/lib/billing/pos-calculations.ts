/**
 * Pure POS cart math shared by the POS checkout page and the e-Kasa backend.
 * Keeps discount rounding behaviour consistent between the UI and the receipt.
 */

export interface PosCartLine {
  quantity: number;
  unitPrice: number;
  /** Line discount in percent (0–100). */
  discountPercent?: number;
}

function clampDiscount(discountPercent: number | undefined): number {
  if (discountPercent === undefined || Number.isNaN(discountPercent)) return 0;
  return Math.min(100, Math.max(0, discountPercent));
}

/** Net line price after applying the line discount. */
export function discountedUnitPrice(
  unitPrice: number,
  discountPercent: number | undefined
): number {
  const d = clampDiscount(discountPercent);
  const net = unitPrice * (1 - d / 100);
  return Math.round(net * 100) / 100;
}

/** Net line total (unitPrice * qty, discount applied). */
export function discountedLineTotal(line: PosCartLine): number {
  const qty = line.quantity > 0 ? line.quantity : 1;
  return Math.round(discountedUnitPrice(line.unitPrice, line.discountPercent) * qty * 100) / 100;
}

export interface PosTotals {
  subtotal: number;
  discount: number;
  total: number;
}

/** Cart-level totals: subtotal before discount, total discount, net total. */
export function computePosTotals(lines: PosCartLine[]): PosTotals {
  let subtotal = 0;
  let total = 0;
  for (const line of lines) {
    const lineSubtotal = Math.round(line.unitPrice * Math.max(1, line.quantity) * 100) / 100;
    subtotal = Math.round((subtotal + lineSubtotal) * 100) / 100;
    total = Math.round((total + discountedLineTotal(line)) * 100) / 100;
  }
  const discount = Math.round((subtotal - total) * 100) / 100;
  return { subtotal, discount, total };
}
