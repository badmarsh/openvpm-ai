"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency } from "./format";

/**
 * Returns a currency formatter bound to the current practice's region
 * (currency + country), so amounts render with the right symbol and locale
 * instead of being hardcoded to USD. React Query dedupes the underlying
 * getTaxConfig request across every component that calls this.
 */
export function useCurrencyFormatter() {
  const { data } = trpc.billing.getTaxConfig.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const currency =
    data?.currency && data.currency.toLowerCase() !== "usd"
      ? data.currency
      : "eur";
  const country =
    data?.country && data.country.toUpperCase() !== "US"
      ? data.country
      : "SK";
  return (value: number | string | null | undefined) =>
    formatCurrency(value, currency, country);
}
