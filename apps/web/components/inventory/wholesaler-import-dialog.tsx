"use client";

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { useCurrencyFormatter } from "@/lib/locale/useCurrency";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TableScroll } from "@/components/common/table-scroll";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  PackagePlus,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

  const [fileName, setFileName] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [parsedData, setParsedData] = useState<any | null>(null);

  const parseMutation = trpc.extensions.wholesalerImport.parse.useMutation({
    onSuccess: (data) => {
      setParsedData(data);
      toast.success(
        `Dodací list bol úspešne načítaný (${data.items.length} položiek)`
      );
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa spracovať dodací list.");
    },
  });

  const applyMutation = trpc.extensions.wholesalerImport.apply.useMutation({
    onSuccess: (res) => {
      toast.success(
        `Sklad úspešne aktualizovaný: ${res.updatedCount} produktov naskladnených, ${res.createdCount} nových produktov vytvorených.`
      );
      handleReset();
      onSuccess();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message || "Chyba pri zápise položiek do skladu.");
    },
  });

  const handleReset = () => {
    setFileName("");
    setFileContent("");
    setParsedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
      parseMutation.mutate({
        content: text,
        filename: file.name,
      });
    };
    reader.readAsText(file);
  };

  const handleApply = () => {
    if (!parsedData) return;

    const payloadItems = parsedData.items.map((it: any) => ({
      action: it.suggestedAction,
      productId: it.matchedProduct?.id,
      name: it.name,
      sku: it.sku || it.ean || it.suklOrAdcCode,
      category: "Lieky a materiály",
      unitPrice: it.unitPriceWithoutVat ? (it.unitPriceWithoutVat * 1.3).toFixed(2) : undefined,
      costPrice: it.unitPriceWithoutVat ? it.unitPriceWithoutVat.toFixed(2) : undefined,
      lotNumber: it.batchNumber,
      expirationDate: it.expirationDate,
      quantity: Math.max(1, Math.round(it.quantity)),
    }));

    applyMutation.mutate({
      deliveryNoteNumber: parsedData.deliveryNote.deliveryNoteNumber,
      supplierName: parsedData.deliveryNote.supplierName,
      issueDate: parsedData.deliveryNote.issueDate,
      items: payloadItems,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import dodacieho listu distribútora
          </DialogTitle>
          <DialogDescription>
            Nahrajte CSV alebo elektronický dodací list od slovenských distribútorov
            (Pharmos, Cymedica, Samohýl, Henry Schein, Biopharm, Sanvet atď.).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {!parsedData ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/50",
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
                  <p className="text-sm font-medium">Analyzujem dodací list...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="p-3 bg-primary/10 text-primary rounded-full">
                    <FileText className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Kliknite pre výber súboru dodacieho listu
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Podporuje formáty CSV, EDI a TXT od slovenských veľkodistribútorov
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header metadata summary */}
              <div className="bg-muted/40 p-4 rounded-lg flex flex-wrap items-center justify-between gap-4 border border-border">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Distribútor / Dodávateľ
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
                    Číslo DL
                  </div>
                  <div className="text-sm font-mono font-medium">
                    {parsedData.deliveryNote.deliveryNoteNumber}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Dátum vystavenia
                  </div>
                  <div className="text-sm">
                    {parsedData.deliveryNote.issueDate || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Spolu s DPH
                  </div>
                  <div className="text-base font-bold text-primary">
                    {formatCurrency(parsedData.deliveryNote.totalWithVat)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleReset}
                  className="text-xs h-8"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Nahrať iný
                </Button>
              </div>

              {/* Items preview table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <TableScroll className="max-h-[340px]">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 text-muted-foreground sticky top-0 border-b border-border">
                      <tr>
                        <th className="py-2 px-3 text-left font-medium">Názov položky</th>
                        <th className="py-2 px-3 text-left font-medium">Šarža & Expirácia</th>
                        <th className="py-2 px-3 text-right font-medium">Množstvo</th>
                        <th className="py-2 px-3 text-right font-medium">Cena bez DPH</th>
                        <th className="py-2 px-3 text-left font-medium">Stav v sklade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedData.items.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3">
                            <div className="font-medium text-foreground">{item.name}</div>
                            {item.sku && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                Kód: {item.sku}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div>{item.batchNumber ? `Šarža: ${item.batchNumber}` : "—"}</div>
                            <div className="text-muted-foreground">
                              {item.expirationDate ? `Exp: ${item.expirationDate}` : ""}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium">
                            {item.quantity} {item.unit || "ks"}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatCurrency(item.unitPriceWithoutVat)}
                          </td>
                          <td className="py-2 px-3">
                            {item.matchedProduct ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Naskladniť (+{item.quantity})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                <PackagePlus className="h-3.5 w-3.5" />
                                Nový produkt
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
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
            disabled={applyMutation.isPending}
          >
            Zrušiť
          </Button>
          {parsedData && (
            <Button
              type="button"
              onClick={handleApply}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Naskladňujem...
                </>
              ) : (
                `Naskladniť ${parsedData.items.length} položiek`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
