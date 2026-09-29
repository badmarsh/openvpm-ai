/** Exact identifiers first; conservative name matching never drops strength/pack size. */
export function normalizeProductName(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2").replace(/\s+/g, " ").trim();
}
interface Matchable {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  supplierCode?: string | null;
}
export function matchInventoryProduct<T extends Matchable>(
  item: { name: string; sku?: string; ean?: string; suklOrAdcCode?: string },
  products: T[],
): T | null {
  const code = (v?: string | null) => v?.trim().toLowerCase();
  const codes = [item.sku, item.ean, item.suklOrAdcCode].map(code).filter(Boolean);
  const byCode = products.filter(p => [p.sku, p.barcode, p.supplierCode].some(v => v && codes.includes(code(v))));
  if (byCode.length) return byCode.length === 1 ? byCode[0] : null;
  const name = normalizeProductName(item.name);
  const byName = products.filter(p => name && normalizeProductName(p.name) === name);
  return byName.length === 1 ? byName[0] : null;
}
