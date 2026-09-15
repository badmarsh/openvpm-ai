"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Image as ImageIcon, ShieldCheck, ShieldAlert } from "lucide-react";

interface WebsiteMediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectImage: (url: string, asset?: any) => void;
}

export function WebsiteMediaPickerDialog({
  open,
  onOpenChange,
  onSelectImage,
}: WebsiteMediaPickerDialogProps) {
  const [filter, setFilter] = useState<"all" | "valid">("all");

  const mediaQuery = trpc.extensions.marketing.listMediaAssets.useQuery(
    { kind: "all", hasConsent: filter === "valid" ? "valid" : "all" },
    { enabled: open }
  );

  const items = mediaQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Vybrať fotografiu z mediálnej knižnice
          </DialogTitle>
          <DialogDescription>
            Vyberte fotografiu so súhlasom pre použitie na verejnej webstránke kliniky.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2 border-b border-border">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            Všetky médiá
          </Button>
          <Button
            variant={filter === "valid" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("valid")}
            className="gap-1.5"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Iba s platným GDPR súhlasom
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {mediaQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Načítavam mediálnu knižnicu...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-2">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-semibold">Nenašli sa žiadne fotografie.</p>
              <p className="text-xs">Nahrajte fotografie v sekcii Marketing &gt; Médiá.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((asset: any) => {
                const isConsented = !asset.subjectsPresent || (asset.consent && !asset.consent.revokedAt);

                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      if (asset.url) {
                        onSelectImage(asset.url, asset);
                        onOpenChange(false);
                      }
                    }}
                    className="group relative rounded-xl overflow-hidden border border-border bg-card aspect-square text-left hover:border-primary hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {asset.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.url}
                        alt={asset.altText || "Obrázok"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs">
                        Bez náhľadu
                      </div>
                    )}

                    <div className="absolute top-1.5 right-1.5">
                      {isConsented ? (
                        <span className="bg-emerald-500/90 text-white rounded-full p-1 shadow-xs inline-flex" title="Súhlas overený">
                          <ShieldCheck className="h-3 w-3" />
                        </span>
                      ) : (
                        <span className="bg-amber-500/90 text-white rounded-full p-1 shadow-xs inline-flex" title="Chýba súhlas">
                          <ShieldAlert className="h-3 w-3" />
                        </span>
                      )}
                    </div>

                    {asset.patientName && (
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-2xs px-2 py-1 text-[10px] text-white truncate">
                        {asset.patientName}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
