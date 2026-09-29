/**
 * Helper to localize invoice statuses consistently across the application.
 */
export function formatInvoiceStatus(
  status: string | null | undefined,
  t: (key: string, fallback?: string) => string,
): string {
  if (!status) return "";
  const normalized = status.toLowerCase().trim();
  const fallback = status.replace(/_/g, " ");
  return t(`billing.status_${normalized}`, fallback);
}
