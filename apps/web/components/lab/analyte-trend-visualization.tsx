"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Search,
  User,
  ChevronDown,
  ChevronUp,
  History,
  FileText,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AnalyteTrendVisualizationProps {
  initialPatientId?: string;
  initialPatientName?: string;
}

export function AnalyteTrendVisualization({
  initialPatientId,
  initialPatientName,
}: AnalyteTrendVisualizationProps) {
  const { t } = useI18n();

  const [patientId, setPatientId] = useState<string>(initialPatientId || "");
  const [patientSearch, setPatientSearch] = useState(initialPatientName || "");
  const [selectedPatientName, setSelectedPatientName] = useState(initialPatientName || "");
  const [expandedAnalyte, setExpandedAnalyte] = useState<string | null>(null);

  // Search patients
  const patientsQuery = trpc.patients.list.useQuery(
    { search: patientSearch, limit: 8 },
    { enabled: patientSearch.length >= 2 && !patientId }
  );

  // Analyte history query
  const historyQuery = trpc.extensions.labImport.getPatientAnalyteHistory.useQuery(
    { patientId },
    { enabled: Boolean(patientId) }
  );

  const trends = historyQuery.data?.trends || [];

  return (
    <div className="space-y-6">
      {/* Header and Patient Selector */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t("labResults.trendsTitle", "Longitudinálne trendy kľúčových analytov")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(
                "labResults.trendsDesc",
                "Sledovanie vývoja obličkových, pečeňových, metabolických a hematologických parametrov v čase (Zákon 39/2007 Z. z.)."
              )}
            </p>
          </div>

          {/* Patient Search or Current Selection */}
          <div className="relative w-full md:w-80">
            {patientId ? (
              <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/40 text-xs">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <span className="font-semibold">{selectedPatientName || "Vybraný pacient"}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPatientId("");
                    setPatientSearch("");
                    setSelectedPatientName("");
                  }}
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Zmeniť
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Vyhľadajte pacienta pre zobrazenie trendov..."
                  className="h-8 pl-8 text-xs"
                />
                {patientsQuery.data?.items && patientsQuery.data.items.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-card shadow-lg p-1 space-y-1">
                    {patientsQuery.data.items.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setPatientId(p.id);
                          setSelectedPatientName(`${p.name} (${p.species || "zviera"})`);
                          setPatientSearch(`${p.name} (${p.species || "zviera"})`);
                        }}
                        className="cursor-pointer rounded-md p-2 text-xs hover:bg-primary/10 transition-colors flex items-center justify-between"
                      >
                        <span className="font-medium text-foreground">{p.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {p.species} {p.breed ? `• ${p.breed}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      {!patientId ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground space-y-3 bg-card/40">
          <Activity className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              Vyberte pacienta pre zobrazenie trendov
            </h3>
            <p className="text-xs max-w-md mx-auto">
              Zadajte meno pacienta vyššie. Systém automaticky prepojí naimportované analyzátory (IDEXX, Fuji, Mindray) aj manuálne klinické záznamy.
            </p>
          </div>
        </div>
      ) : historyQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 rounded-xl border bg-card/50 animate-pulse p-4 space-y-3" />
          ))}
        </div>
      ) : trends.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground space-y-2">
          <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto" />
          <p className="text-xs">Pre tohto pacienta zatiaľ nie sú zaznamenané laboratórne výsledky.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trends.map((tItem) => {
            const hasData = tItem.count > 0;
            const isExpanded = expandedAnalyte === tItem.code;
            const isUp = tItem.trend === "up";
            const isDown = tItem.trend === "down";
            const isStable = tItem.trend === "stable";

            const flag = (tItem.latestFlag || "").toUpperCase();
            const isCritical = flag === "CRITICAL";
            const isAbnormal = flag === "HIGH" || flag === "LOW";

            return (
              <div
                key={tItem.code}
                className={`rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between transition-all ${
                  isCritical
                    ? "border-red-500/50 bg-red-50/10"
                    : isAbnormal
                    ? "border-amber-500/50 bg-amber-50/10"
                    : "border-border"
                }`}
              >
                <div className="space-y-3">
                  {/* Top: Code & Category */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm font-mono text-foreground">
                          {tItem.code}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">
                          {tItem.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{tItem.name}</p>
                    </div>

                    {/* Flag badge */}
                    {hasData && (
                      <Badge
                        variant={isCritical ? "destructive" : "outline"}
                        className={`text-[10px] px-2 py-0.5 font-medium ${
                          isCritical
                            ? ""
                            : isAbnormal
                            ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}
                      >
                        {isCritical ? (
                          <span className="flex items-center gap-1">
                            <AlertOctagon className="w-2.5 h-2.5" /> Kritická
                          </span>
                        ) : flag === "HIGH" ? (
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Zvýšené
                          </span>
                        ) : flag === "LOW" ? (
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Znížené
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Norma
                          </span>
                        )}
                      </Badge>
                    )}
                  </div>

                  {/* Value & Trend Section */}
                  {hasData ? (
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-extrabold font-mono text-foreground">
                            {tItem.latestValue}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">{tItem.unit}</span>
                        </div>

                        {/* Trend comparison indicator */}
                        {tItem.previousValue !== null ? (
                          <div
                            className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${
                              isUp
                                ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                                : isDown
                                ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-muted text-muted-foreground"
                            }`}
                            title={`Predchádzajúca hodnota: ${tItem.previousValue} ${tItem.unit}`}
                          >
                            {isUp ? (
                              <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                            ) : isDown ? (
                              <TrendingDown className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                            <span>
                              {isUp ? "↑ " : isDown ? "↓ " : "→ "}
                              {tItem.latestValue} vs {tItem.previousValue} {tItem.unit}
                              {tItem.diffPercent !== null && ` (${tItem.diffPercent > 0 ? "+" : ""}${tItem.diffPercent}%)`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Prvé meranie</span>
                        )}
                      </div>

                      {/* Reference range info */}
                      {tItem.refLow !== null && tItem.refHigh !== null && (
                        <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t pt-1.5 border-border/50">
                          <span>Referenčný rozsah:</span>
                          <span className="font-mono font-medium">
                            {tItem.refLow} – {tItem.refHigh} {tItem.unit}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic py-3">
                      Žiadne namerané hodnoty pre tento parameter.
                    </div>
                  )}
                </div>

                {/* History button and collapsible list */}
                {hasData && (
                  <div className="pt-3 border-t border-border/60 mt-3">
                    <button
                      type="button"
                      onClick={() => setExpandedAnalyte(isExpanded ? null : tItem.code)}
                      className="text-[11px] text-primary hover:underline flex items-center justify-between w-full font-medium cursor-pointer"
                    >
                      <span className="flex items-center gap-1">
                        <History className="w-3 h-3" />
                        História vyšetrení ({tItem.count})
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {tItem.datapoints.map((pt, pIdx) => (
                          <div
                            key={pIdx}
                            className="flex items-center justify-between p-1.5 rounded-md bg-muted/30 text-[11px] border border-border/30"
                          >
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              <span>{new Date(pt.date).toLocaleDateString("sk-SK")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold">{pt.value}</span>
                              <span className="text-[10px] text-muted-foreground">{pt.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
