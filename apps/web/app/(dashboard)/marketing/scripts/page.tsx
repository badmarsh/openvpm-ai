"use client";

import {
  PenLine,
  Printer,
  HeartHandshake,
  AlertTriangle,
  Star,
  FileCheck,
  PhoneCall,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CATEGORY_META: Record<
  string,
  { title: string; icon: React.ComponentType<{ className?: string }>; description: string }
> = {
  discharge_ask: {
    title: "Protokol po zákroku & Discharge",
    icon: FileCheck,
    description: "Pokyny pre majiteľa pri odchode domov po chirurgickom či stomatologickom zákroku.",
  },
  crisis: {
    title: "Krízové situácie na recepcii",
    icon: AlertTriangle,
    description: "Formulácie pri komplikáciách a akútnych zhoršeniach stavu – personál komunikuje osobne.",
  },
  condolence: {
    title: "Kondolencia & Súcit (Sympathy Flow)",
    icon: HeartHandshake,
    description: "Osobný prístup tímu pri strate zvieraťa. Žiadne automatické správy po úmrtí.",
  },
  review_ask: {
    title: "Získavanie recenzií (5★)",
    icon: Star,
    description: "Odporučenie recenzie len po úspešnom ukončení liečby a spokojnosti klienta.",
  },
};

export default function MarketingScriptsPage() {
  const { t } = useI18n();
  const scriptsQuery = trpc.extensions.marketing.listOperativeScripts.useQuery();

  const scripts = scriptsQuery.data ?? [];

  const grouped = scripts.reduce<Record<string, typeof scripts>>((acc, s) => {
    const cat = s.category || "discharge_ask";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <PenLine className="w-7 h-7 text-primary" />
            {t("marketing.scripts.title", "Operačné skripty & vzory")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t(
              "marketing.scripts.subtitle",
              "Štandardizované postupy a osvedčené formulácie pre personál recepcie a asistentov. Pripravené na okamžitú tlač na stenu ambulancie."
            )}
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => window.print()}
          className="gap-2 shrink-0 self-start sm:self-center"
        >
          <Printer className="w-4 h-4" />
          Tlačiť na stenu recepcie
        </Button>
      </div>

      {scriptsQuery.isLoading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
          Načítavam operačné skripty...
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
            const items = grouped[catKey] ?? [];
            if (items.length === 0) return null;

            const IconComponent = meta.icon;

            return (
              <section key={catKey} className="space-y-3">
                <div className="border-b pb-2">
                  <div className="flex items-center gap-2">
                    <IconComponent className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-bold text-foreground">{meta.title}</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map((script) => (
                    <div
                      key={script.id}
                      className="p-5 rounded-xl border bg-card shadow-sm space-y-3 print:border-neutral-300 print:shadow-none"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-sm text-foreground">{script.title}</h3>
                        <Badge variant="outline" className="text-[10px]">
                          {catKey}
                        </Badge>
                      </div>

                      <div className="p-3.5 rounded-lg bg-muted/40 border-l-4 border-amber-500 text-xs italic leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                        "{script.body}"
                      </div>

                      {script.note && (
                        <p className="text-[11px] text-muted-foreground pt-1">
                          <strong>Poznámka pre personál:</strong> {script.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
