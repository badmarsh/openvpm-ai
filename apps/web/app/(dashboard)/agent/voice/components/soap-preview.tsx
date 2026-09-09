"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { SoapStyle } from "@/lib/voice/soap-formatter";

export interface SoapSectionsData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  clientSummary?: string;
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

type SoapSectionKey = "subjective" | "objective" | "assessment" | "plan";

/**
 * Static (non-translatable) section config. Human-visible labels and
 * descriptions are resolved at render time via `t()` — Slovak is primary,
 * English is the fallback dictionary (Skill §2).
 */
const SECTION_CONFIG: Record<
  SoapSectionKey,
  {
    letter: string;
    color: string;
    bgBadge: string;
    labelKey: string;
    labelFallback: string;
    descriptionKey: string;
    descriptionFallback: string;
  }
> = {
  subjective: {
    letter: "S",
    color: "border-l-blue-500",
    bgBadge: "bg-blue-500",
    labelKey: "voice.soap.subjective",
    labelFallback: "Subjektívne (S)",
    descriptionKey: "voice.soap.subjectiveDesc",
    descriptionFallback: "Anamnéza, signalement, sťažnosti majiteľa",
  },
  objective: {
    letter: "O",
    color: "border-l-emerald-500",
    bgBadge: "bg-emerald-500",
    labelKey: "voice.soap.objective",
    labelFallback: "Objektívne (O)",
    descriptionKey: "voice.soap.objectiveDesc",
    descriptionFallback: "Klinická triáda, fyzikálne vyšetrenie, nálezy",
  },
  assessment: {
    letter: "A",
    color: "border-l-amber-500",
    bgBadge: "bg-amber-500",
    labelKey: "voice.soap.assessment",
    labelFallback: "Hodnotenie (A)",
    descriptionKey: "voice.soap.assessmentDesc",
    descriptionFallback: "Pracovná diagnóza, diferenciálna diagnostika",
  },
  plan: {
    letter: "P",
    color: "border-l-purple-500",
    bgBadge: "bg-purple-500",
    labelKey: "voice.soap.plan",
    labelFallback: "Plán (P)",
    descriptionKey: "voice.soap.planDesc",
    descriptionFallback: "Medikácia, presné dávky, diéta, kontrola",
  },
};

const SECTION_ORDER: SoapSectionKey[] = [
  "subjective",
  "objective",
  "assessment",
  "plan",
];

export function SoapPreview({
  sections,
  editable = false,
  onChange,
  compact = false,
  patientName,
  onReformat,
  isReformatting = false,
}: SoapPreviewProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [activeStyle, setActiveStyle] = useState<SoapStyle>("standard");

  const update = (key: keyof SoapSectionsData, value: string) => {
    onChange?.({ ...sections, [key]: value });
  };

  const sectionLabel = (key: SoapSectionKey) =>
    t(SECTION_CONFIG[key].labelKey, SECTION_CONFIG[key].labelFallback);

  const handleCopyFullSoap = () => {
    const lines = [
      `=== ${t("voice.soap.copyHeader", "KLINICKÝ ZÁZNAM (SOAP)")} ${patientName ? `· ${patientName} ` : ""}===`,
      `${t("voice.soap.copyDate", "Dátum")}: ${new Date().toLocaleDateString("sk-SK")}`,
      "",
      `${sectionLabel("subjective").toUpperCase()}:`,
      sections.subjective || "—",
      "",
      `${sectionLabel("objective").toUpperCase()}:`,
      sections.objective || "—",
      "",
      `${sectionLabel("assessment").toUpperCase()}:`,
      sections.assessment || "—",
      "",
      `${sectionLabel("plan").toUpperCase()}:`,
      sections.plan || "—",
    ];

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast.success(
      t("voice.soap.copiedFull", "Celý SOAP záznam bol skopírovaný"),
    );
    setTimeout(() => setCopied(false), 2000);
  };

  const hasContent = Object.values(sections).some((v) => v.trim().length > 0);
  if (!hasContent && !editable) return null;

  const layout = compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2";
  const filledCount = SECTION_ORDER.filter(
    (k) => (sections[k] ?? "").trim().length > 0,
  ).length;

  const styleLabel = (st: SoapStyle) =>
    st === "standard"
      ? t("voice.soap.styleStandard", "Štandardný")
      : st === "detailed"
        ? t("voice.soap.styleDetailed", "Detailný")
        : t("voice.soap.styleConcise", "Stručný");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight">
            {t("voice.soap.title", "SOAP štruktúrovaný záznam")}
          </h3>
          <Badge variant="outline" className="text-[11px] font-mono">
            {t("voice.soap.sectionsCount", "{count}/4 sekcií", {
              count: filledCount,
            })}
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
                  {styleLabel(st)}
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
            title={t("voice.soap.copyFullTitle", "Kopírovať celý SOAP záznam")}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>
              {copied
                ? t("voice.soap.copied", "Skopírované")
                : t("voice.soap.copy", "Kopírovať")}
            </span>
          </Button>
        </div>
      </div>

      <div className={cn("grid gap-3", layout)}>
        {SECTION_ORDER.map((key) => {
          const config = SECTION_CONFIG[key];
          const label = sectionLabel(key);
          const description = t(
            config.descriptionKey,
            config.descriptionFallback,
          );
          const textValue = sections[key] ?? "";
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
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {charCount > 0 && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {t("voice.soap.charCount", "{count} zn.", {
                        count: charCount,
                      })}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground/80 hidden sm:inline">
                    {description}
                  </span>
                </div>
              </div>

              {editable ? (
                <Textarea
                  value={sections[key]}
                  onChange={(e) => update(key, e.target.value)}
                  rows={compact ? 2 : 3}
                  className="text-xs sm:text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none p-3 leading-relaxed"
                  placeholder={t(
                    "voice.soap.sectionPlaceholder",
                    "Doplňte {section}...",
                    { section: label.replace(/\s*\([A-Z]\)\s*$/, "").toLowerCase() },
                  )}
                />
              ) : (
                <div className="p-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap min-h-[50px]">
                  {sections[key] ? (
                    sections[key]
                  ) : (
                    <span className="text-muted-foreground italic text-xs">
                      {t("voice.soap.noData", "Žiadne údaje")}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
