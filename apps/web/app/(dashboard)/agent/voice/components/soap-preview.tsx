"use client";

import { useState } from "react";
import { Copy, Check, Sparkles, RefreshCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SoapStyle } from "@/lib/voice/soap-formatter";

export interface SoapSectionsData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface SoapPreviewProps {
  sections: SoapSectionsData;
  editable?: boolean;
  onChange?: (sections: SoapSectionsData) => void;
  compact?: boolean;
  patientName?: string;
  onReformat?: (style: SoapStyle) => void;
  isReformatting?: boolean;
}

const SECTION_LABELS: Record<
  keyof SoapSectionsData,
  { label: string; letter: string; color: string; bgBadge: string; description: string }
> = {
  subjective: {
    label: "Subjektívne",
    letter: "S",
    color: "border-l-blue-500",
    bgBadge: "bg-blue-500",
    description: "Anamnéza, signament, sťažnosti majiteľa",
  },
  objective: {
    label: "Objektívne",
    letter: "O",
    color: "border-l-emerald-500",
    bgBadge: "bg-emerald-500",
    description: "Klinická triáda, fyzikálne vyšetrenie, nálezy",
  },
  assessment: {
    label: "Diagnóza",
    letter: "A",
    color: "border-l-amber-500",
    bgBadge: "bg-amber-500",
    description: "Pracovná diagnóza, diferenciálna diagnostika",
  },
  plan: {
    label: "Plán liečby",
    letter: "P",
    color: "border-l-purple-500",
    bgBadge: "bg-purple-500",
    description: "Medikácia, presné dávky, diéta, kontrola",
  },
};

export function SoapPreview({
  sections,
  editable = false,
  onChange,
  compact = false,
  patientName,
  onReformat,
  isReformatting = false,
}: SoapPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [activeStyle, setActiveStyle] = useState<SoapStyle>("standard");

  const update = (key: keyof SoapSectionsData, value: string) => {
    onChange?.({ ...sections, [key]: value });
  };

  const handleCopyFullSoap = () => {
    const lines = [
      `=== KLINICKÝ ZÁZNAM (SOAP) ${patientName ? `· ${patientName} ` : ""}===`,
      `Dátum: ${new Date().toLocaleDateString("sk-SK")}`,
      "",
      `[S] SUBJEKTÍVNE:`,
      sections.subjective || "—",
      "",
      `[O] OBJEKTÍVNE:`,
      sections.objective || "—",
      "",
      `[A] DIAGNÓZA / POSÚDENIE:`,
      sections.assessment || "—",
      "",
      `[P] PLÁN A TERAPIA:`,
      sections.plan || "—",
    ];

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast.success("Celý SOAP záznam bol skopírovaný");
    setTimeout(() => setCopied(false), 2000);
  };

  const hasContent = Object.values(sections).some((v) => v.trim().length > 0);
  if (!hasContent && !editable) return null;

  const layout = compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight">
            SOAP štruktúrovaný záznam
          </h3>
          <Badge variant="outline" className="text-[11px] font-mono">
            {Object.values(sections).filter((s) => s.trim().length > 0).length}/4 sekcií
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Style selector for AI reformatting */}
          {onReformat && (
            <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
              {(["standard", "detailed", "concise"] as SoapStyle[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setActiveStyle(st);
                    onReformat(st);
                  }}
                  disabled={isReformatting}
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-medium rounded-md transition-all",
                    activeStyle === st
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {st === "standard" ? "Štandardný" : st === "detailed" ? "Detailný" : "Stručný"}
                </button>
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyFullSoap}
            className="h-7 px-2.5 text-xs gap-1.5"
            title="Kopírovať celý SOAP záznam"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>{copied ? "Skopírované" : "Kopírovať"}</span>
          </Button>
        </div>
      </div>

      <div className={cn("grid gap-3", layout)}>
        {(Object.keys(SECTION_LABELS) as Array<keyof SoapSectionsData>).map(
          (key) => {
            const config = SECTION_LABELS[key];
            const textValue = sections[key];
            const charCount = textValue.length;

            return (
              <div
                key={key}
                className={cn(
                  "rounded-xl border border-l-4 bg-card shadow-sm transition-all overflow-hidden",
                  config.color,
                )}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-5 w-5 rounded-md text-xs font-bold flex items-center justify-center text-white shadow-xs",
                        config.bgBadge,
                      )}
                    >
                      {config.letter}
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {config.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {charCount > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {charCount} zn.
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground/80 hidden sm:inline">
                      {config.description}
                    </span>
                  </div>
                </div>

                {editable ? (
                  <Textarea
                    value={sections[key]}
                    onChange={(e) => update(key, e.target.value)}
                    rows={compact ? 2 : 3}
                    className="text-xs sm:text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none p-3 leading-relaxed"
                    placeholder={`Doplňte ${config.label.toLowerCase()}...`}
                  />
                ) : (
                  <div className="p-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap min-h-[50px]">
                    {sections[key] ? (
                      sections[key]
                    ) : (
                      <span className="text-muted-foreground italic text-xs">
                        Žiadne údaje
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
