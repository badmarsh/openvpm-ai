"use client";

import { ReceiptEuro } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useCurrencyFormatter } from "@/lib/locale/useCurrency";
import { PatientHeaderSkeleton, PatientSnapshotSkeleton } from "@/components/ui/content-skeletons";

function PatientDetailErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
      {message}
    </div>
  );
}

function PatientDetailLoadingPanel({ label }: { label: string }) {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-32 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

const invoiceStatusStyles: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  void: "bg-gray-100 text-gray-400",
};

export function InvoicesTab({ patientId }: { patientId: string }) {
  const { t } = useI18n();
  const formatCurrency = useCurrencyFormatter();
  const { data, isLoading, error } = trpc.billing.listInvoices.useQuery({
    patientId,
    limit: 50,
  });
  const invoicesMissing = !isLoading && !error && !data;

  if (error) {
    return (
      <PatientDetailErrorPanel
        message={`Unable to load invoices. ${error.message}`}
      />
    );
  }
  if (invoicesMissing) {
    return (
      <PatientDetailErrorPanel
        message={t(
          "common.error_retry",
          "Unable to load invoices. Please retry.",
        )}
      />
    );
  }
  if (isLoading) {
    return (
      <PatientDetailLoadingPanel
        label={t("patients.invoicesTab.loading", "Loading invoices...")}
      />
    );
  }
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={ReceiptEuro}
        title={t("patients.invoicesTab.empty", "No invoices yet")}
        description={t(
          "patients.invoicesTab.emptyDesc",
          "Invoices created in Billing for this patient will show up here.",
        )}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
              {t("patients.invoicesTab.colCreated", "Created")}
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              {t("patients.invoicesTab.colTotal", "Total")}
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              {t("patients.invoicesTab.colDue", "Paid")}
            </th>
            <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
              {t("patients.invoicesTab.colStatus", "Status")}
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {data.items.map((invoice) => (
            <tr
              key={invoice.id}
              className="border-b border-border last:border-0"
            >
              <td className="px-4 py-3 text-muted-foreground">
                {invoice.createdAt
                  ? new Date(invoice.createdAt).toLocaleDateString()
                  : "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">
                {formatCurrency(invoice.total)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {formatCurrency(invoice.paidAmount)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    invoiceStatusStyles[
                      invoice.isEstimate ? "draft" : invoice.status
                    ] ?? "bg-gray-100 text-gray-600",
                  )}
                >
                  {invoice.isEstimate ? "estimate" : invoice.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href="/billing"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("patients.invoicesTab.openInBilling", "Open in Billing")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}