import {
  isInventoryCurrencyAmountInputValid,
  INVENTORY_MONEY_AMOUNT_MAX,
} from "./policy";
import { moneyToCents, centsToMoney } from "@/lib/billing/invoice-balance";

export function priceWithMarkup(cost: string, markup: string): string | null {
  if (
    !isInventoryCurrencyAmountInputValid(cost) ||
    !/^\d+(?:\.\d{1,2})?$/.test(markup.trim())
  )
    return null;
  const percent = Number(markup);
  if (!Number.isFinite(percent) || percent > 100000) return null;
  const cents = Number(
    (BigInt(moneyToCents(cost)) * BigInt(10000 + Math.round(percent * 100)) +
      5000n) /
      10000n,
  );
  if (cents > INVENTORY_MONEY_AMOUNT_MAX * 100) return null;
  return centsToMoney(cents);
}

/** Display gross retail; catalog unitPrice remains NET to avoid double taxation in billing. */
export function priceIncludingVat(net: string, vat: number): string | null {
  if (!Number.isFinite(vat) || vat < 0 || vat > 100) return null;
  return priceWithMarkup(net.replace(",", "."), String(vat));
}
export const CATEGORY_MARKUPS: Record<string, string> = {
  medication: "30", supply: "50", food: "30", vaccine: "30",
};
