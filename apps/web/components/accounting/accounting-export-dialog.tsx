"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  FileSpreadsheet,
  FileCode,
  Calendar,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export function AccountingExportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Default dates: 1st day of current month to today
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(today);
  const [format, setFormat] = useState<"pohoda_xml" | "kros_omega">("pohoda_xml");
  const [includeInvoices, setIncludeInvoices] = useState(true);
  const [includeEkasa, setIncludeEkasa] = useState(true);

  const exportMutation = trpc.extensions.accounting.exportData.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.content], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        t(
          "accounting.exportSuccess",
          `Export stiahnutý: ${data.invoiceCount} faktúr, ${data.ekasaCount} e-Kasa dokladov (spolu ${data.totalAmount} €)`
        )
      );
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || t("accounting.exportError", "Chyba pri generovaní exportu"));
    },
  });

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof window === "undefined") return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!includeInvoices && !includeEkasa) {
      toast.error(t("accounting.selectAtLeastOne", "Vyberte aspoň jeden typ dokladov (faktúry alebo e-Kasa)"));
      return;
    }
    exportMutation.mutate({
      dateFrom,
      dateTo,
      format,
      includeInvoices,
      includeEkasa,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="acc-export-title"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2 id="acc-export-title" className="text-base font-semibold text-foreground">
                {t("accounting.exportTitle", "Export pre účtovníctvo")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("accounting.exportSubtitle", "STORMWARE Pohoda XML a KROS Omega CSV")}
              </p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Format Selection */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              {t("accounting.formatLabel", "Formát exportu")}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  format === "pohoda_xml"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value="pohoda_xml"
                  checked={format === "pohoda_xml"}
                  onChange={() => setFormat("pohoda_xml")}
                  className="sr-only"
                />
                <FileCode className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">STORMWARE Pohoda</div>
                  <div className="text-xs text-muted-foreground">{t("accounting.xmlFormat", "XML format 2.0")}</div>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  format === "kros_omega"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value="kros_omega"
                  checked={format === "kros_omega"}
                  onChange={() => setFormat("kros_omega")}
                  className="sr-only"
                />
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="text-sm font-medium">KROS Omega / Alfa</div>
                  <div className="text-xs text-muted-foreground">CSV import</div>
                </div>
              </label>
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                {t("accounting.dateFrom", "Dátum od")}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                {t("accounting.dateTo", "Dátum do")}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>
          </div>

          {/* Scope selection */}
          <div className="space-y-2 border-t border-border pt-4">
            <label className="text-sm font-medium text-foreground block">
              {t("accounting.scopeLabel", "Zahrnúť do exportu")}
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInvoices}
                  onChange={(e) => setIncludeInvoices(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                />
                <span>{t("accounting.includeInvoices", "Vydané faktúry (VF)")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeEkasa}
                  onChange={(e) => setIncludeEkasa(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                />
                <span>{t("accounting.includeEkasa", "e-Kasa pokladničné doklady (PD)")}</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={exportMutation.isPending}>
              {t("common.cancel", "Zrušiť")}
            </Button>
            <Button type="submit" disabled={exportMutation.isPending}>
              {exportMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("accounting.generating", "Generujem export...")}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t("accounting.downloadExport", "Stiahnuť súbor")}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
