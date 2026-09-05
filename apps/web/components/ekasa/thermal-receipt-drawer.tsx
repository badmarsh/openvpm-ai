"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  X,
  Printer,
  Copy,
  Check,
  RefreshCw,
  Receipt as ReceiptIcon,
  ShieldCheck,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPulseBadge } from "@/components/ui/status-pulse-badge";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface EkasaReceiptDetails {
  id: string;
  receiptNumber: string;
  issuedAt: Date | string | null;
  amountTotal: string | number;
  amountBase?: string | number;
  amountVat?: string | number;
  vatRate: string;
  paymentMethod: string;
  status: "PENDING" | "SENT" | "CONFIRMED" | "FAILED" | "OFFLINE_STORED";
  uid?: string | null;
  okp?: string | null;
  pkp?: string | null;
  qrData?: string | null;
  invoice?: any;
}

interface ThermalReceiptDrawerProps {
  receipt: EkasaReceiptDetails | null;
  open: boolean;
  onClose: () => void;
  onPrint?: (receiptId: string) => Promise<void>;
  onRetry?: (receiptId: string) => Promise<void>;
  isPrinting?: boolean;
  isRetrying?: boolean;
  clinicName?: string;
  dic?: string;
  icDph?: string | null;
  pokladnicaId?: string;
}

const VAT_PERCENT_MAP: Record<string, number> = {
  ZERO: 0,
  REDUCED_5: 5,
  REDUCED: 10,
  REDUCED_19: 19,
  STANDARD: 20,
  STANDARD_23: 23,
};

const VAT_RATES_SR = [
  { key: "ZERO", label: "0 % (Oslobodené)", rate: 0 },
  { key: "REDUCED_5", label: "5 % (Lieky / knihy od 2025)", rate: 5 },
  { key: "REDUCED", label: "10 % (Historická)", rate: 10 },
  { key: "REDUCED_19", label: "19 % (Znížená od 2025)", rate: 19 },
  { key: "STANDARD_23", label: "23 % (Základná sadzba SR od 2025)", rate: 23 },
];

export function ThermalReceiptDrawer({
  receipt,
  open,
  onClose,
  onPrint,
  onRetry,
  isPrinting,
  isRetrying,
  clinicName = "Veterinárna klinika VET.IS",
  dic = "2023456789",
  icDph = "SK2023456789",
  pokladnicaId = "88812345678900001",
}: ThermalReceiptDrawerProps) {
  const { t } = useI18n();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!open || !receipt) return null;

  const totalNum = Number(receipt.amountTotal || 0);
  const activeRateNum = VAT_PERCENT_MAP[receipt.vatRate] ?? 23;
  
  // Calculate Base & VAT if not stored directly
  const calculatedBase = receipt.amountBase
    ? Number(receipt.amountBase)
    : activeRateNum > 0
    ? totalNum / (1 + activeRateNum / 100)
    : totalNum;
  const calculatedVat = receipt.amountVat
    ? Number(receipt.amountVat)
    : totalNum - calculatedBase;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(t("ekasa.drawer.copied", "{label} skopírované do schránky", { label }));
    setTimeout(() => setCopiedField(null), 2000);
  };

  const qrPayload =
    receipt.qrData ||
    (receipt.uid
      ? `https://ekasa.financnasprava.sk/overenie/${receipt.uid}`
      : `O:${pokladnicaId}\nDN:${receipt.receiptNumber}\nB:${calculatedBase.toFixed(2)}\nT:${totalNum.toFixed(2)}\nOKP:${receipt.okp ?? ""}`);

  const statusVariant =
    receipt.status === "CONFIRMED"
      ? "confirmed"
      : receipt.status === "OFFLINE_STORED"
      ? "offline"
      : receipt.status === "FAILED"
      ? "failed"
      : "pending";

  const paymentMethodLabel =
    receipt.paymentMethod === "CASH"
      ? t("ekasa.paymentCash", "Hotovosť")
      : receipt.paymentMethod === "CARD"
      ? t("ekasa.paymentCard", "Platobná karta")
      : t("ekasa.paymentTransfer", "Bankový prevod");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="e-Kasa Thermal Receipt Inspector"
    >
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-border/80 bg-background shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ReceiptIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t("ekasa.drawer.title", "Detail fiškálneho dokladu")}
              </h2>
              <p className="text-xs text-muted-foreground font-mono tabular-nums">
                {receipt.receiptNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Live Status & Quick Action Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 p-3.5">
            <div className="flex items-center gap-2">
              <StatusPulseBadge variant={statusVariant} size="md" />
              {receipt.status === "OFFLINE_STORED" && (
                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  {t("ekasa.drawer.offlineNotice", "Uložené v pamäti kliniky. Vyžaduje synchronizáciu.")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onRetry && (receipt.status === "OFFLINE_STORED" || receipt.status === "FAILED") && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRetrying}
                  onClick={() => onRetry(receipt.id)}
                  className="gap-1.5 text-xs font-semibold border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isRetrying && "animate-spin")} />
                  {t("ekasa.drawer.retrySync", "Odoslať na FS")}
                </Button>
              )}

              {onPrint && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPrinting}
                  onClick={() => onPrint(receipt.id)}
                  className="gap-1.5 text-xs"
                >
                  <Printer className="h-3.5 w-3.5" />
                  {t("ekasa.drawer.print", "Tlačiť")}
                </Button>
              )}
            </div>
          </div>

          {/* Authentic Monospace Thermal Receipt Paper Canvas */}
          <div className="relative mx-auto w-full max-w-sm rounded-sm border border-zinc-300 dark:border-zinc-700/80 bg-[#fbfbf8] dark:bg-zinc-950 p-6 text-zinc-900 dark:text-zinc-100 shadow-lg font-mono text-xs leading-relaxed">
            {/* Serrated Top Edge Decorator */}
            <div className="absolute -top-1.5 left-0 right-0 h-1.5 bg-repeat-x [background-size:12px_6px] [background-image:radial-gradient(circle_at_6px_0px,transparent_4px,#fbfbf8_4px)] dark:[background-image:radial-gradient(circle_at_6px_0px,transparent_4px,#09090b_4px)]" />

            {/* Receipt Header */}
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-zinc-400 dark:border-zinc-700">
              <p className="font-bold text-sm tracking-wide uppercase">{clinicName}</p>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">Elektronická registračná pokladnica</p>
              <div className="pt-1 text-[11px] space-y-0.5 text-zinc-700 dark:text-zinc-300">
                <p>DIČ: <span className="tabular-nums font-semibold">{dic}</span></p>
                {icDph && <p>IČ DPH: <span className="tabular-nums font-semibold">{icDph}</span></p>}
                <p>KP: <span className="tabular-nums">{pokladnicaId}</span></p>
              </div>
            </div>

            {/* Receipt Metadata */}
            <div className="py-2.5 border-b border-dashed border-zinc-400 dark:border-zinc-700 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span>DOKLAD ČÍSLO:</span>
                <span className="font-bold tabular-nums">{receipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>DÁTUM A ČAS:</span>
                <span className="tabular-nums">
                  {receipt.issuedAt
                    ? new Date(receipt.issuedAt).toLocaleString("sk-SK", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>ÚHRADA:</span>
                <span className="font-semibold">{paymentMethodLabel}</span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="py-3 border-b border-dashed border-zinc-400 dark:border-zinc-700 space-y-2">
              <div className="flex justify-between font-bold text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <span>Položka / Služba</span>
                <span className="tabular-nums">Cena / DPH</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <div className="flex-1 pr-2 truncate">
                  <p className="font-medium">Veterinárne vyšetrenie a starostlivosť</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">1.000 ks x {totalNum.toFixed(2)} €</p>
                </div>
                <div className="text-right tabular-nums font-semibold">
                  <p>{totalNum.toFixed(2)} €</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{activeRateNum} %</p>
                </div>
              </div>
            </div>

            {/* VAT Rates Breakdown (0%, 5%, 10%, 19%, 23%) */}
            <div className="py-3 border-b border-dashed border-zinc-400 dark:border-zinc-700 space-y-1.5">
              <p className="font-bold text-[10px] uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
                Rozpis DPH (Zákon č. 222/2004 Z. z.)
              </p>
              <table className="w-full text-[10px] tabular-nums">
                <thead>
                  <tr className="border-b border-zinc-300 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                    <th className="text-left font-semibold pb-1">Sadzba</th>
                    <th className="text-right font-semibold pb-1">Základ</th>
                    <th className="text-right font-semibold pb-1">DPH</th>
                    <th className="text-right font-semibold pb-1">Spolu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {VAT_RATES_SR.map((rateItem) => {
                    const isMatched = rateItem.rate === activeRateNum;
                    const base = isMatched ? calculatedBase : 0;
                    const vat = isMatched ? calculatedVat : 0;
                    const total = isMatched ? totalNum : 0;

                    return (
                      <tr
                        key={rateItem.key}
                        className={cn(
                          isMatched ? "font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100/60 dark:bg-zinc-800/40" : "text-zinc-500 dark:text-zinc-400 opacity-65"
                        )}
                      >
                        <td className="py-0.5">{rateItem.rate} %</td>
                        <td className="text-right py-0.5">{base.toFixed(2)} €</td>
                        <td className="text-right py-0.5">{vat.toFixed(2)} €</td>
                        <td className="text-right py-0.5">{total.toFixed(2)} €</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Grand Total */}
            <div className="py-3 border-b-2 border-zinc-900 dark:border-zinc-100 space-y-1">
              <div className="flex justify-between items-baseline font-bold text-base">
                <span>CELKOM:</span>
                <span className="text-lg tabular-nums">{totalNum.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
                <span>UHRADENÉ ({paymentMethodLabel}):</span>
                <span className="tabular-nums font-semibold">{totalNum.toFixed(2)} €</span>
              </div>
            </div>

            {/* Cryptographic Security Block (e-Kasa UID / OKP / PKP) */}
            <div className="pt-3 pb-2 space-y-2 text-[10px]">
              {receipt.uid ? (
                <div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold">UID (Kód FS SR):</span>
                    <button
                      onClick={() => copyToClipboard(receipt.uid!, "UID")}
                      className="hover:text-primary transition-colors inline-flex items-center gap-0.5"
                    >
                      {copiedField === "UID" ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
                      Kopírovať
                    </button>
                  </div>
                  <p className="font-mono break-all text-[9.5px] select-all bg-zinc-100 dark:bg-zinc-900 p-1 rounded mt-0.5">
                    {receipt.uid}
                  </p>
                </div>
              ) : (
                <div className="rounded bg-amber-50 dark:bg-amber-950/30 p-1.5 text-amber-800 dark:text-amber-200 text-[10px] flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>Doklad neobsahuje UID z dôvodu offline evidencie.</span>
                </div>
              )}

              {receipt.okp && (
                <div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold">OKP:</span>
                    <button
                      onClick={() => copyToClipboard(receipt.okp!, "OKP")}
                      className="hover:text-primary transition-colors inline-flex items-center gap-0.5"
                    >
                      {copiedField === "OKP" ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
                      Kopírovať
                    </button>
                  </div>
                  <p className="font-mono break-all text-[9.5px] select-all bg-zinc-100 dark:bg-zinc-900 p-1 rounded mt-0.5">
                    {receipt.okp}
                  </p>
                </div>
              )}
            </div>

            {/* QR Code Verification */}
            <div className="pt-2 text-center space-y-1.5 border-t border-dashed border-zinc-400 dark:border-zinc-700">
              <div className="bg-white p-2 rounded inline-block shadow-xs">
                <QRCodeSVG value={qrPayload} size={96} level="M" />
              </div>
              <p className="text-[9px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Overte doklad pomocou aplikácie Over doklad (FS SR)
              </p>
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-border/60 bg-muted/10 p-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("common.close", "Zavrieť")}
          </Button>
          {onPrint && (
            <Button
              size="sm"
              disabled={isPrinting}
              onClick={() => onPrint(receipt.id)}
              className="gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              {t("ekasa.drawer.printReceipt", "Vytlačiť fiškálny doklad")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
