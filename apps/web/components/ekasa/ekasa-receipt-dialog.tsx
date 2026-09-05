"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Printer,
  CheckCircle2,
  Clock,
  WifiOff,
  XCircle,
  ExternalLink,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";

export interface EkasaReceiptModalData {
  receiptId?: string;
  receiptNumber: string;
  amountTotal: string;
  status: string;
  okp?: string | null;
  pkp?: string | null;
  uid?: string | null;
  qrUrl?: string | null;
  html?: string | null;
  paymentMethod?: string;
}

export function EkasaReceiptDialog({
  open,
  receipt,
  onClose,
}: {
  open: boolean;
  receipt: EkasaReceiptModalData | null;
  onClose: () => void;
}) {
  const [printing, setPrinting] = useState(false);
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("80mm");
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const utils = trpc.useUtils();
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !receipt) return null;

  const handlePrint = async () => {
    setPrinting(true);
    try {
      let html = receipt.html;
      if (receipt.receiptId) {
        const res = await utils.ekasa.printReceipt.fetch({
          receiptId: receipt.receiptId,
          paperWidth,
        });
        html = res.html;
      }
      if (html) {
        const win = window.open("", "_blank", "width=400,height=700");
        if (win) {
          win.document.write(html);
          win.document.close();
          setTimeout(() => {
            win.print();
          }, 400);
        }
      }
    } catch (err) {
      console.error("Print error:", err);
    } finally {
      setPrinting(false);
    }
  };

  const isConfirmed = receipt.status === "CONFIRMED";
  const isOffline = receipt.status === "OFFLINE_STORED";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl transition-all">
        {/* Close Icon Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">{t("ekasa.close", "Close")}</span>
        </button>

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            {isConfirmed ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : isOffline ? (
              <WifiOff className="h-6 w-6 text-amber-500" />
            ) : (
              <Clock className="h-6 w-6 text-blue-500" />
            )}
          </div>
          <div>
            <h3 className="font-heading text-lg font-semibold text-foreground">
              {isConfirmed
                ? t("ekasa.receiptIssued", "Receipt issued")
                : isOffline
                ? t("ekasa.receiptOffline", "Receipt saved (Offline mode)")
                : t("ekasa.receiptRecorded", "Receipt recorded")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("ekasa.legalRef", "e-Kasa of the Financial Administration SR (Act No. 289/2008 Z. z.)")}
            </p>
          </div>
        </div>

        {/* Receipt Details Card */}
        <div className="mt-5 space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-muted-foreground">{t("ekasa.receiptNumber", "Receipt number:")}</span>
            <span className="font-mono font-semibold text-foreground">
              {receipt.receiptNumber}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-muted-foreground">{t("ekasa.totalAmount", "Total amount:")}</span>
            <span className="text-base font-bold text-foreground">
              {Number(receipt.amountTotal).toFixed(2)} €
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-muted-foreground">{t("ekasa.status", "Filing status:")}</span>
            {isConfirmed ? (
              <Badge variant="default" className="bg-emerald-600">
                {t("ekasa.confirmed", "Confirmed (FR SR)")}
              </Badge>
            ) : isOffline ? (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                {t("ekasa.offlineStored", "Offline saved")}
              </Badge>
            ) : (
              <Badge variant="outline">{receipt.status}</Badge>
            )}
          </div>

          {receipt.okp && (
            <div className="flex flex-col gap-0.5 border-b border-border/60 pb-2">
              <span className="text-xs text-muted-foreground">{t("ekasa.okpCode", "OKP code:")}</span>
              <span className="font-mono text-xs text-foreground/80 break-all">
                {receipt.okp}
              </span>
            </div>
          )}

          {receipt.uid && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{t("ekasa.uidLabel", "Receipt UID:")}</span>
              <span className="font-mono text-xs text-foreground/80 break-all">
                {receipt.uid}
              </span>
            </div>
          )}
        </div>

        {/* Verification Link / QR Info */}
        {receipt.qrUrl && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("ekasa.verificationLabel", "Receipt verification on FS SR portal:")}</span>
            <a
              href={receipt.qrUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {t("ekasa.verifyOnline", "Verify online")}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPaperWidth("80mm")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                paperWidth === "80mm"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              80 mm
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth("58mm")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                paperWidth === "58mm"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              58 mm
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} ref={closeBtnRef}>
              {t("ekasa.close", "Close")}
            </Button>

            {(receipt.html || receipt.receiptId) && (
              <Button
                variant="default"
                onClick={handlePrint}
                disabled={printing}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {printing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                {t("ekasa.printReceipt", "Print receipt ({width})", { width: paperWidth })}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
