"use client";

import type { ReactNode } from "react";
import {
  Wrench,
  Calendar,
  Stethoscope,
  Pill,
  ShieldAlert,
  Sparkles,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export const SUGGESTIONS = [
  {
    key: "agent.suggestions.vaccinations",
    fallback: "Which patients are overdue for vaccinations?",
  },
  {
    key: "agent.suggestions.appointments",
    fallback: "Summarize today's appointments.",
  },
  {
    key: "agent.suggestions.carprofen",
    fallback: "What's the carprofen dose for a 12 kg dog?",
  },
  {
    key: "agent.suggestions.clinicalSummary",
    fallback: "Pull a clinical summary for the next patient checked in.",
  },
] as const;

export function AgentSidebar({
  statusBanner,
  canRun,
  allowWrites,
  onAllowWritesChange,
  isPending,
  dateLabel,
  onPickSuggestion,
}: {
  statusBanner: ReactNode;
  canRun: boolean;
  allowWrites: boolean;
  onAllowWritesChange: (allowed: boolean) => void;
  isPending: boolean;
  dateLabel: string;
  onPickSuggestion: (query: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      {/* Status & Safety Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            {t("agent.systemCardTitle", "Stav a režim asistenta")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {statusBanner ? (
            <div>{statusBanner}</div>
          ) : (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t("agent.status.ready", "AI asistent je pripravený a plne konfigurovaný")}</span>
            </div>
          )}

          {/* Write Mode Box */}
          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowWrites}
                onChange={(e) => onAllowWritesChange(e.target.checked)}
                disabled={!canRun || isPending}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              {t(
                "agent.composer.allowWrites",
                "Allow writes: appointments, prescriptions, and patient vitals",
              )}
            </label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(
                "agent.composer.writeWarning",
                "Write mode can create appointments, record vitals, or draft prescriptions. It turns off automatically after this run.",
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Morning Vet Brief */}
      {canRun && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                {t("agent.morningBrief.title", "Ranný prehľad")}
                {dateLabel ? ` — ${dateLabel}` : ""}
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                {t(
                  "agent.morningBrief.subtitle",
                  "Spustite AI dopyt pre okamžitý prehľad dňa",
                )}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {[
              {
                icon: Stethoscope,
                labelKey: "agent.morningBrief.today",
                labelFallback: "Dnes v ordinácii",
                query: "Zhrň mi dnešné termíny – počet pacientov, prvé návštevy a urgentné prípady.",
              },
              {
                icon: Pill,
                labelKey: "agent.morningBrief.vaccinesExpiring",
                labelFallback: "Expirujúce vakcíny",
                query: "Ktorí pacienti majú expirované alebo čoskoro expirujúce očkovania?",
              },
              {
                icon: Calendar,
                labelKey: "agent.morningBrief.unfinishedRecords",
                labelFallback: "Nedokončené záznamy",
                query: "Máme nejakých pacientov z posledných 7 dní bez ukončeného SOAP záznamu alebo prepúšťacej správy?",
              },
              {
                icon: ShieldAlert,
                labelKey: "agent.morningBrief.hospitalized",
                labelFallback: "Aktívne hospitalizácie",
                query: "Zoznam aktuálne hospitalizovaných pacientov s ich diagnózou a dátumom prijatia.",
              },
            ].map(({ icon: Icon, labelKey, labelFallback, query }) => {
              const label = t(labelKey, labelFallback);
              return (
                <button
                  key={labelKey}
                  type="button"
                  className="flex items-center gap-2.5 text-left rounded-lg px-3 py-2 text-xs bg-white/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:border-amber-300 transition-colors group"
                  onClick={() => onPickSuggestion(query)}
                >
                  <Icon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-medium text-amber-900 dark:text-amber-200">{label}</span>
                  <ChevronRight className="h-3 w-3 ml-auto text-amber-400 group-hover:text-amber-600 transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Suggestions */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t("agent.quickQuestions", "Rýchle veterinárne otázky")}:
        </label>
        <div className="flex flex-col gap-2">
          {SUGGESTIONS.map((s) => (
            <Button
              key={s.key}
              type="button"
              variant="outline"
              size="sm"
              className="justify-start h-auto py-2.5 px-3 text-xs text-left bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30 whitespace-normal leading-relaxed transition-colors shadow-xs"
              disabled={!canRun}
              onClick={() => onPickSuggestion(t(s.key, s.fallback))}
            >
              <Sparkles className="h-3.5 w-3.5 mr-2 shrink-0 text-primary opacity-80" />
              <span>{t(s.key, s.fallback)}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Tips Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            {t("agent.tipsTitle", "Ako sa pýtať asistenta")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
          <p>• {t("agent.tips.naturalLanguage", "Pýtajte sa prirodzenou slovenčinou na pacientov, dávkovanie či termíny.")}</p>
          <p>• {t("agent.tips.context", "Asistent udržiava kontext konverzácie až 12 správ spätne.")}</p>
          <p>• {t("agent.tips.writeMode", "Pre úpravy kartotéky nezabudnite povoliť režim zápisu vyššie.")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
