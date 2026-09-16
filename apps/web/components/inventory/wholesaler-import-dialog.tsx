"use client";

import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { useCurrencyFormatter } from "@/lib/locale/useCurrency";
import { priceWithMarkup } from "@/lib/inventory/markup";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableScroll } from "@/components/common/table-scroll";
import {
  Upload,
  FileText,
  AlertCircle,
  RefreshCw,
  Loader2,
  Link2,
  Link2Off,
  Search,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type WholesalerChoice =
  | "AUTO"
  | "CYMEDICA"
  | "PHARMOS"
  | "SAMOHYL"
  | "HENRY_SCHEIN"
  | "BIOPHARM"
  | "KOMVET"
  | "SG_VET"
  | "SANVET"
  | "PHRAMED"
  | "GENERIC_CSV";

const WHOLESALER_OPTIONS: WholesalerChoice[] = [
  "AUTO",
  "CYMEDICA",
  "PHARMOS",
  "SAMOHYL",
  "HENRY_SCHEIN",
  "BIOPHARM",
  "KOMVET",
  "SG_VET",
  "SANVET",
  "PHRAMED",
  "GENERIC_CSV",
];

type ItemAction = "update_stock" | "create_product" | "skip";

interface LinkedProduct {
  id: string;
  name: string;
  sku: string | null;
  stockQuantity: number | null;
}

interface ItemReviewState {
  action: ItemAction;
  linkedProduct?: LinkedProduct | null;
  /** Manual retail-price override (string money); otherwise derived from markup. */
  retailPriceOverride?: string;
}

interface WholesalerImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function WholesalerImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: WholesalerImportDialogProps) {
  const { t } = useI18n();
  const formatCurrency = useCurrencyFormatter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [wholesaler, setWholesaler] = useState<WholesalerChoice>("AUTO");
  const [fileName, setFileName] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [itemStates, setItemStates] = useState<Record<number, ItemReviewState>>({});
  const [markup, setMarkup] = useState<string>("30");
  const [linkSearchIndex, setLinkSearchIndex] = useState<number | null>(null);
  const [linkSearchText, setLinkSearchText] = useState("");

  const parseMutation = trpc.extensions.wholesalerImport.parse.useMutation({
    onSuccess: (data) => {
      setParsedData(data);
      const initial: Record<number, ItemReviewState> = {};
      data.items.forEach((item: any, idx: number) => {
        // Controlled substances default to "skip": staff must explicitly
        // review every narcotic line (Zákon 139/1998 Z. z. — zero automation).
        initial[idx] = {
          action: item.isControlledSubstance ? "skip" : item.suggestedAction,
        };
      });
      setItemStates(initial);
      toast.success(
        t(
          "inventory.wholesalerImport.parseSuccess",
          `Dodací list bol úspešne načítaný (${data.items.length} položiek).`,
          { count: data.items.length }
        )
      );
    },
    onError: (err) => {
      toast.error(
        err.message ||
          t("inventory.wholesalerImport.parseError", "Nepodarilo sa spracovať dodací list.")
      );
    },
  });

  const confirmMutation = trpc.extensions.wholesalerImport.confirmImport.useMutation({
    onSuccess: (res) => {
      toast.success(
        t(
          "inventory.wholesalerImport.confirmSuccess",
          `Sklad aktualizovaný: ${res.updatedCount} naskladnených, ${res.createdCount} nových produktov.`,
          { updated: res.updatedCount, created: res.createdCount }
        )
      );
      handleReset();
      onSuccess();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(
        err.message ||
          t("inventory.wholesalerImport.confirmError", "Chyba pri zápise položiek do skladu.")
      );
    },
  });

  const linkSearchQuery = trpc.extensions.wholesalerImport.searchProducts.useQuery(
    { query: linkSearchText, limit: 10 },
    { enabled: linkSearchIndex !== null && linkSearchText.trim().length >= 2 }
  );

  const handleReset = () => {
    setFileName("");
    setDragActive(false);
    setParsedData(null);
    setItemStates({});
    setLinkSearchIndex(null);
    setLinkSearchText("");
    setWholesaler("AUTO");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const readFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseMutation.mutate({
        content: text,
        filename: file.name,
        wholesaler: wholesaler === "AUTO" ? undefined : wholesaler,
      });
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (parseMutation.isPending) return;
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const setItemState = (idx: number, patch: Partial<ItemReviewState>) => {
    setItemStates((prev) => ({
      ...prev,
      [idx]: { ...prev[idx], action: prev[idx]?.action ?? "skip", ...patch },
    }));
  };

  const retailPriceFor = (item: any, idx: number): string => {
    const override = itemStates[idx]?.retailPriceOverride;
    if (override && override.trim()) return override.trim();
    const computed = priceWithMarkup(item.unitPriceWithoutVat.toFixed(2), markup);
    return computed ?? item.unitPriceWithoutVat.toFixed(2);
  };

  const effectiveAction = (item: any, idx: number): ItemAction =>
    itemStates[idx]?.action ?? item.suggestedAction;

  const effectiveProductId = (item: any, idx: number): string | undefined =>
    itemStates[idx]?.linkedProduct?.id ?? item.matchedProduct?.id;

  const actionableCount = useMemo(() => {
    if (!parsedData) return 0;
    return parsedData.items.filter(
      (_: any, idx: number) => effectiveAction(parsedData.items[idx], idx) !== "skip"
    ).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedData, itemStates]);

  const handleConfirm = () => {
    if (!parsedData) return;
    const items = parsedData.items.map((item: any, idx: number) => {
      const action = effectiveAction(item, idx);
      return {
        action,
        productId: action === "update_stock" ? effectiveProductId(item, idx) : undefined,
        name: item.name,
        sku: item.sku || item.ean || item.suklOrAdcCode || undefined,
        category: "Lieky a materiály",
        unit: item.unit || undefined,
        costPrice: item.unitPriceWithoutVat.toFixed(2),
        retailPrice: retailPriceFor(item, idx),
        vatRate: item.vatRate,
        lotNumber: item.batchNumber || undefined,
        expirationDate: item.expirationDate || undefined,
        quantity: item.quantity,
      };
    });

    confirmMutation.mutate({
      deliveryNoteNumber: parsedData.deliveryNote.deliveryNoteNumber,
      supplierName: parsedData.deliveryNote.supplierName,
      wholesaler: parsedData.deliveryNote.wholesaler,
      issueDate: parsedData.deliveryNote.issueDate,
      items,
    });
  };

  const openLinkSearch = (idx: number, seedQuery: string) => {
    setLinkSearchIndex(idx);
    setLinkSearchText(seedQuery);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            {t("inventory.wholesalerImport.title", "Importovať dodací list")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "inventory.wholesalerImport.description",
              "Nahrajte CSV, TXT alebo textový export PDF od slovenských vetdistribútorov. Položky skontrolujete a cenami s maržou naskladníte jedným klikom."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {!parsedData ? (
            <div className="space-y-4">
              {/* 1. Wholesaler selector */}
              <div className="space-y-1.5 max-w-sm">
                <Label htmlFor="wholesaler-select">
                  {t("inventory.wholesalerImport.wholesalerLabel", "Distribútor")}
                </Label>
                <Select
                  value={wholesaler}
                  onValueChange={(v) => setWholesaler(v as WholesalerChoice)}
                >
                  <SelectTrigger id="wholesaler-select" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WHOLESALER_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`inventory.wholesalerImport.wholesalers.${option}`, option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "inventory.wholesalerImport.wholesalerHint",
                    "Voľba „Automaticky rozpoznať“ detekuje formát podľa obsahu súboru."
                  )}
                </p>
              </div>

              {/* 2. Drag & drop zone */}
              <div
                role="button"
                tabIndex={0}
                aria-label={t("inventory.wholesalerImport.dropzoneAria", "Nahrať súbor dodacieho listu")}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(true);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(false);
                }}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50",
                  parseMutation.isPending && "pointer-events-none opacity-60"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.edi,.dat"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {parseMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">
                      {t("inventory.wholesalerImport.parsing", "Analyzujem dodací list...")}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="p-3 bg-primary/10 text-primary rounded-full">
                      <FileText className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {t(
                          "inventory.wholesalerImport.dropzoneTitle",
                          "Presuňte súbor sem, alebo kliknite pre výber"
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t(
                          "inventory.wholesalerImport.dropzoneHint",
                          "Podporované: CSV, TXT, EDI (max. 5 MB)"
                        )}
                      </p>
                      {fileName && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono">{fileName}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header metadata summary */}
              <div className="bg-muted/40 p-4 rounded-lg flex flex-wrap items-center justify-between gap-4 border border-border">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    {t("inventory.wholesalerImport.metaSupplier", "Distribútor / Dodávateľ")}
                  </div>
                  <div className="text-base font-bold flex items-center gap-2">
                    {parsedData.deliveryNote.supplierName}
                    <span className="text-xs font-normal px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {parsedData.deliveryNote.wholesaler}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    {t("inventory.wholesalerImport.metaNoteNumber", "Číslo DL")}
                  </div>
                  <div className="text-sm font-mono font-medium">
                    {parsedData.deliveryNote.deliveryNoteNumber}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    {t("inventory.wholesalerImport.metaIssueDate", "Dátum vystavenia")}
                  </div>
                  <div className="text-sm">
                    {parsedData.deliveryNote.issueDate || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    {t("inventory.wholesalerImport.metaTotal", "Spolu s DPH")}
                  </div>
                  <div className="text-base font-bold text-primary">
                    {formatCurrency(parsedData.deliveryNote.totalWithVat)}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={handleReset} className="text-xs h-8">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  {t("inventory.wholesalerImport.uploadAnother", "Nahrať iný")}
                </Button>
              </div>

              {/* BEZ-SARZE warning */}
              {parsedData.items.some((it: any) => !it.batchNumber || it.batchNumber === "BEZ-SARZE") && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    {t(
                      "inventory.wholesalerImport.noBatchWarning",
                      "Položky bez uvedenej šarže budú označené predvolenou hodnotou BEZ-SARZE."
                    )}
                  </span>
                </div>
              )}

              {/* Controlled substances safety banner */}
              {parsedData.items.some((it: any) => it.isControlledSubstance) && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 rounded-md">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    {t(
                      "inventory.wholesalerImport.controlledWarning",
                      "Dodací list obsahuje omamné/psychotropné látky. Každú takúto položku musíte explicitne potvrdiť (predvolené: preskočiť)."
                    )}
                  </span>
                </div>
              )}

              {/* Markup controls */}
              <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border p-3 bg-muted/20">
                <div className="space-y-1">
                  <Label htmlFor="markup-percent" className="text-xs">
                    {t("inventory.wholesalerImport.markupLabel", "Marža na nákupnú cenu (%)")}
                  </Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="markup-slider"
                      type="range"
                      min={0}
                      max={200}
                      step={1}
                      value={Number(markup) || 0}
                      aria-label={t("inventory.wholesalerImport.markupSliderAria", "Posuvník marže")}
                      onChange={(e) => setMarkup(e.target.value)}
                      className="w-40 accent-primary"
                    />
                    <Input
                      id="markup-percent"
                      type="number"
                      min="0"
                      max="100000"
                      step="1"
                      value={markup}
                      onChange={(e) => setMarkup(e.target.value)}
                      className="h-8 w-20"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() =>
                    setItemStates((prev) =>
                      Object.fromEntries(
                        Object.entries(prev).map(([k, v]) => [
                          k,
                          { ...v, retailPriceOverride: undefined },
                        ])
                      )
                    )
                  }
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {t("inventory.wholesalerImport.resetPrices", "Znovu prepočítať ceny podľa marže")}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "inventory.wholesalerImport.markupHint",
                    "Navrhovaná predajná cena = nákupná cena bez DPH × (1 + marža). Jednotlivé riadky môžete upraviť ručne."
                  )}
                </p>
              </div>

              {/* Review table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <TableScroll className="max-h-[380px]">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 text-muted-foreground sticky top-0 border-b border-border">
                      <tr>
                        <th className="py-2 px-3 text-left font-medium">
                          {t("inventory.wholesalerImport.colProduct", "Priradený produkt / Položka")}
                        </th>
                        <th className="py-2 px-3 text-left font-medium">
                          {t("inventory.wholesalerImport.colCode", "Kód")}
                        </th>
                        <th className="py-2 px-3 text-left font-medium">
                          {t("inventory.wholesalerImport.colBatch", "Šarža / Expirácia")}
                        </th>
                        <th className="py-2 px-3 text-right font-medium">
                          {t("inventory.wholesalerImport.colQty", "Množstvo")}
                        </th>
                        <th className="py-2 px-3 text-right font-medium">
                          {t("inventory.wholesalerImport.colPurchasePrice", "Nákup bez DPH")}
                        </th>
                        <th className="py-2 px-3 text-right font-medium">
                          {t("inventory.wholesalerImport.colVat", "DPH")}
                        </th>
                        <th className="py-2 px-3 text-right font-medium">
                          {t("inventory.wholesalerImport.colRetailPrice", "Predajná cena")}
                        </th>
                        <th className="py-2 px-3 text-left font-medium">
                          {t("inventory.wholesalerImport.colAction", "Akcia")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedData.items.map((item: any, idx: number) => {
                        const action = effectiveAction(item, idx);
                        const linked = itemStates[idx]?.linkedProduct ?? null;
                        const displayProduct = linked ?? item.matchedProduct;
                        const isControlled = !!item.isControlledSubstance;
                        return (
                          <tr key={idx} className="hover:bg-muted/30 transition-colors align-top">
                            {/* Matched product / link */}
                            <td className="py-2 px-3 min-w-[220px]">
                              <div className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                                {item.name}
                                {isControlled && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] font-semibold">
                                    <ShieldAlert className="h-3 w-3" />
                                    {t("inventory.wholesalerImport.controlledBadge", "Omamná látka")}
                                  </span>
                                )}
                              </div>
                              {displayProduct ? (
                                <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                                  <span className="text-emerald-700 dark:text-emerald-400 truncate max-w-[220px]" title={displayProduct.name}>
                                    {displayProduct.name}
                                  </span>
                                  {linked && (
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-destructive"
                                      title={t("inventory.wholesalerImport.unlinkProduct", "Zrušiť prepojenie")}
                                      onClick={() => setItemState(idx, { linkedProduct: null, action: "create_product" })}
                                    >
                                      <Link2Off className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="mt-1 flex items-center gap-1 text-[11px] text-primary hover:underline"
                                  onClick={() => openLinkSearch(idx, item.name)}
                                >
                                  <Link2 className="h-3 w-3" />
                                  {t("inventory.wholesalerImport.linkExisting", "Prepojiť s katalógom")}
                                </button>
                              )}
                              {linkSearchIndex === idx && (
                                <div className="mt-2 space-y-1">
                                  <div className="flex items-center gap-1">
                                    <Search className="h-3 w-3 text-muted-foreground" />
                                    <Input
                                      autoFocus
                                      value={linkSearchText}
                                      onChange={(e) => setLinkSearchText(e.target.value)}
                                      placeholder={t(
                                        "inventory.wholesalerImport.linkSearchPlaceholder",
                                        "Hľadať produkt podľa názvu alebo kódu…"
                                      )}
                                      className="h-7 text-[11px]"
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-[11px]"
                                      onClick={() => {
                                        setLinkSearchIndex(null);
                                        setLinkSearchText("");
                                      }}
                                    >
                                      {t("common.cancel", "Zrušiť")}
                                    </Button>
                                  </div>
                                  {linkSearchText.trim().length >= 2 && (
                                    <div className="max-h-28 overflow-y-auto rounded border border-border bg-background divide-y divide-border">
                                      {linkSearchQuery.isFetching ? (
                                        <div className="p-2 text-[11px] text-muted-foreground flex items-center gap-1">
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          {t("inventory.wholesalerImport.linkSearching", "Hľadám…")}
                                        </div>
                                      ) : (linkSearchQuery.data ?? []).length === 0 ? (
                                        <div className="p-2 text-[11px] text-muted-foreground">
                                          {t("inventory.wholesalerImport.linkNoResults", "Nenašiel sa žiadny produkt.")}
                                        </div>
                                      ) : (
                                        (linkSearchQuery.data ?? []).map((p) => (
                                          <button
                                            key={p.id}
                                            type="button"
                                            className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-muted/50 flex items-center justify-between gap-2"
                                            onClick={() => {
                                              setItemState(idx, {
                                                linkedProduct: {
                                                  id: p.id,
                                                  name: p.name,
                                                  sku: p.sku,
                                                  stockQuantity: p.stockQuantity,
                                                },
                                                action: "update_stock",
                                              });
                                              setLinkSearchIndex(null);
                                              setLinkSearchText("");
                                            }}
                                          >
                                            <span className="truncate">{p.name}</span>
                                            <span className="text-muted-foreground font-mono shrink-0">
                                              {p.sku ?? "—"} · {t("inventory.wholesalerImport.stockShort", "skl.")}{" "}
                                              {p.stockQuantity ?? 0}
                                            </span>
                                          </button>
                                        ))
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            {/* Item code */}
                            <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">
                              {item.sku || item.ean || item.suklOrAdcCode || "—"}
                            </td>
                            {/* Batch & expiry */}
                            <td className="py-2 px-3">
                              {item.batchNumber && item.batchNumber !== "BEZ-SARZE" ? (
                                <span className="font-mono text-[11px] font-medium">{item.batchNumber}</span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-mono text-[10px] font-semibold">
                                  BEZ-SARZE
                                </span>
                              )}
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {item.expirationDate
                                  ? `${t("inventory.wholesalerImport.expiryShort", "Exp")}: ${item.expirationDate}`
                                  : t("inventory.wholesalerImport.noExpiry", "Bez expirácie")}
                              </div>
                            </td>
                            {/* Quantity */}
                            <td className="py-2 px-3 text-right font-mono font-medium whitespace-nowrap">
                              {item.quantity} {item.unit || "ks"}
                            </td>
                            {/* Purchase price */}
                            <td className="py-2 px-3 text-right font-mono whitespace-nowrap">
                              {formatCurrency(item.unitPriceWithoutVat)}
                            </td>
                            {/* VAT rate */}
                            <td className="py-2 px-3 text-right font-mono whitespace-nowrap">
                              {item.vatRate}%
                            </td>
                            {/* Proposed retail price */}
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={
                                  itemStates[idx]?.retailPriceOverride ??
                                  retailPriceFor(item, idx)
                                }
                                onChange={(e) =>
                                  setItemState(idx, {
                                    retailPriceOverride: e.target.value,
                                  })
                                }
                                className="h-7 w-24 text-right font-mono text-[11px] ml-auto"
                                aria-label={t(
                                  "inventory.wholesalerImport.retailPriceAria",
                                  "Predajná cena za jednotku"
                                )}
                              />
                              {displayProduct?.currentUnitPrice && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {t("inventory.wholesalerImport.currentPrice", "akt.")}{" "}
                                  {formatCurrency(Number(displayProduct.currentUnitPrice))}
                                </div>
                              )}
                            </td>
                            {/* Action */}
                            <td className="py-2 px-3">
                              <Select
                                value={action}
                                onValueChange={(val: ItemAction) => setItemState(idx, { action: val })}
                              >
                                <SelectTrigger className="h-7 text-[11px] w-[150px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {displayProduct && (
                                    <SelectItem value="update_stock">
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        {t("inventory.wholesalerImport.actionUpdateStock", "Naskladniť")}
                                      </span>
                                    </SelectItem>
                                  )}
                                  <SelectItem value="create_product">
                                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                                      {t("inventory.wholesalerImport.actionCreate", "Vytvoriť produkt")}
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="skip">
                                    <span className="text-muted-foreground">
                                      {t("inventory.wholesalerImport.actionSkip", "Preskočiť")}
                                    </span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              {isControlled && action === "skip" && (
                                <div className="text-[10px] text-purple-600 dark:text-purple-300 mt-0.5">
                                  {t("inventory.wholesalerImport.controlledNeedsReview", "Vyžaduje kontrolu")}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableScroll>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirmMutation.isPending}
          >
            {t("common.cancel", "Zrušiť")}
          </Button>
          {parsedData && (
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={confirmMutation.isPending || actionableCount === 0}
            >
              {confirmMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t("inventory.wholesalerImport.confirming", "Naskladňujem…")}
                </>
              ) : (
                t("inventory.wholesalerImport.confirmButton", "Potvrdiť a naskladniť ({count})", {
                  count: actionableCount,
                })
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
