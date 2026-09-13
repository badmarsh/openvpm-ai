"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Heart,
  Moon,
  Gauge,
  UserX,
  RefreshCw,
  Filter,
  Info,
  Clock,
  Phone,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function SuppressionCenterPage() {
  const { t } = useI18n();
  const [filterReason, setFilterReason] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const metricsQuery = trpc.extensions.automationSuppression.getMetrics.useQuery();
  const logsQuery = trpc.extensions.automationSuppression.listLogs.useQuery({
    limit: pageSize,
    offset: page * pageSize,
    reason: filterReason as any,
  });

  const metrics = metricsQuery.data;
  const logs = logsQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-primary" />
            {t("marketing.suppression.title", "Centrum potlačení & GDPR Audit")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            {t(
              "marketing.suppression.description",
              "Prehľad a auditné záznamy o automatizovanom potlačení marketingových a transakčných správ v zmysle GDPR Čl. 22 (Sympathy Gate, nočný kľud, SMS limity, odhlásenia)."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              metricsQuery.refetch();
              logsQuery.refetch();
            }}
            disabled={logsQuery.isFetching}
            className="text-xs gap-1.5"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${logsQuery.isFetching ? "animate-spin" : ""}`}
            />
            {t("common.refresh", "Obnoviť")}
          </Button>
        </div>
      </div>

      {/* GDPR Art. 22 Notice Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-foreground">
            {t("marketing.suppression.gdprTitle", "Transparentnosť automatizovaného rozhodovania (GDPR Čl. 22)")}
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {t(
              "marketing.suppression.gdprBody",
              "Každá neodoslaná správa je trvalo zaznamenaná s presným dôvodovým kódom (reasonCode), časovou pečiatkou a kontextom. Pacienti so štatútom 'deceased' majú trvalý súcitný blok bez výnimiek."
            )}
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sympathy Gate */}
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-purple-600 fill-purple-600" />
              Sympathy Gate
            </span>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
              Kritické
            </Badge>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {metrics?.sympathyBlocks ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Zablokovaných správ pre zosnulých pacientov
          </p>
        </div>

        {/* Quiet Hours */}
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Moon className="w-4 h-4 text-blue-600" />
              Nočný kľud
            </span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
              20:00 - 08:00
            </Badge>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {metrics?.quietHours ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Odložených na povolený čas v časovom pásme
          </p>
        </div>

        {/* SMS Rate Limits */}
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-amber-600" />
              SMS Frekvenčný limit
            </span>
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
              &lt; 3 / 24h
            </Badge>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {metrics?.rateLimits ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Potlačených pre prekročenie denného limitu
          </p>
        </div>

        {/* Opt-out / Consent */}
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <UserX className="w-4 h-4 text-rose-600" />
              Chýba súhlas / Opt-out
            </span>
            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
              GDPR Čl. 9
            </Badge>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {metrics?.noConsent ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Potlačených z dôvodu chýbajúceho súhlasu
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 rounded-lg border border-border/40 text-xs">
        <button
          type="button"
          onClick={() => setFilterReason("all")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            filterReason === "all"
              ? "bg-background text-foreground shadow-sm font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("common.all", "Všetky")} ({metrics?.total ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setFilterReason("deceased_patient")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            filterReason === "deceased_patient"
              ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-semibold"
              : "text-muted-foreground hover:text-purple-700"
          }`}
        >
          <Heart className="w-3.5 h-3.5 text-purple-600" />
          Sympathy Gate ({metrics?.sympathyBlocks ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setFilterReason("quiet_hours")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            filterReason === "quiet_hours"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold"
              : "text-muted-foreground hover:text-blue-700"
          }`}
        >
          <Moon className="w-3.5 h-3.5 text-blue-600" />
          Nočný kľud ({metrics?.quietHours ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setFilterReason("frequency_cap")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            filterReason === "frequency_cap"
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold"
              : "text-muted-foreground hover:text-amber-700"
          }`}
        >
          <Gauge className="w-3.5 h-3.5 text-amber-600" />
          Frekvenčný limit ({metrics?.rateLimits ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setFilterReason("no_consent")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            filterReason === "no_consent"
              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-semibold"
              : "text-muted-foreground hover:text-rose-700"
          }`}
        >
          <UserX className="w-3.5 h-3.5 text-rose-600" />
          Chýba súhlas ({metrics?.noConsent ?? 0})
        </button>
      </div>

      {/* Suppression Log Table — Responsive Table Governance compliant */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
              <tr>
                <th className="py-3 px-4">Čas potlačenia</th>
                <th className="py-3 px-4">Dôvod potlačenia</th>
                <th className="py-3 px-4">Potlačená akcia / Kanál</th>
                <th className="py-3 px-4">Klient / Pacient</th>
                <th className="py-3 px-4">Stav odblokovania</th>
                <th className="py-3 px-4">Auditný detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logsQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Načítavam auditné záznamy...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    Žiadne potlačené správy v tejto kategórii.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isSympathy = log.suppressionReason === "deceased_patient";
                  const isQuiet = log.suppressionReason === "quiet_hours";
                  const isRate = log.suppressionReason === "frequency_cap";

                  return (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground font-mono">
                        {new Date(log.blockedAt).toLocaleString("sk-SK")}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSympathy ? (
                          <Badge variant="secondary" className="gap-1 bg-purple-100 text-purple-800 border-purple-200">
                            <Heart className="w-3 h-3 fill-purple-600 text-purple-600" />
                            Sympathy Gate
                          </Badge>
                        ) : isQuiet ? (
                          <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
                            <Moon className="w-3 h-3 text-blue-600" />
                            Nočný kľud
                          </Badge>
                        ) : isRate ? (
                          <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-800 border-amber-200">
                            <Gauge className="w-3 h-3 text-amber-600" />
                            Frekvenčný limit
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 bg-slate-100 text-slate-800">
                            {log.suppressionReason}
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground">
                          {log.blockedAction}
                        </div>
                        {log.channelAttempted && (
                          <span className="text-[10px] text-muted-foreground uppercase">
                            Kanál: {log.channelAttempted}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground">
                          {log.clientFirstName} {log.clientLastName}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                          {log.patientName && (
                            <span>Pacient: {log.patientName} ({log.patientSpecies ?? "zviera"})</span>
                          )}
                          {log.clientPhone && <span>{log.clientPhone}</span>}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.clearedAt ? (
                          <span className="text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Odblokované {new Date(log.clearedAt).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        ) : isSympathy ? (
                          <span className="text-purple-600 font-medium">
                            Trvalý blok (sympatia)
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Aktívne potlačené</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-muted-foreground max-w-xs truncate" title={log.detail ?? ""}>
                        {log.detail ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
