"use client";

import { useState } from "react";
import {
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Filter,
  ShieldAlert,
  Loader2,
  Mail,
  Smartphone,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IntegrationModeBanner } from "@/components/common/integration-mode-banner";
import { toast } from "sonner";

export function MessageLogsView() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");

  const statsQuery = trpc.extensions.marketing.getMessageStats.useQuery();
  const logsQuery = trpc.extensions.marketing.listMessageLogs.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    channel: channelFilter === "all" ? undefined : channelFilter,
    limit: 100,
  });

  const processMutation = trpc.extensions.marketing.processQueuedMessages.useMutation({
    onSuccess: (data) => {
      toast.success(
        t(
          "marketing.messages.queueProcessedToast",
          `Fronta spracovaná: ${data.sent} odoslaných, ${data.suppressed} potlačených.`,
          { sent: data.sent, suppressed: data.suppressed },
        ),
      );
      utils.extensions.marketing.getMessageStats.invalidate();
      utils.extensions.marketing.listMessageLogs.invalidate();
    },
    onError: (err) => {
      toast.error(
        err.message ||
          t("marketing.messages.queueProcessError", "Nepodarilo sa spracovať frontu správ."),
      );
    },
  });

  const stats = statsQuery.data ?? {
    total: 0,
    sent: 0,
    delivered: 0,
    queued: 0,
    failed: 0,
    blocked_sympathy: 0,
    suppressed_no_consent: 0,
    suppressed_rate: 0,
    suppressed_quiet: 0,
  };

  const suppressedTotal =
    stats.blocked_sympathy +
    stats.suppressed_no_consent +
    stats.suppressed_rate +
    stats.suppressed_quiet;

  return (
    <div className="space-y-6 pt-2">
      {/* Header with Queue Processing */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {t("marketing.messages.tabLogs", "Správy & Logy")}
            </h2>
            <IntegrationModeBanner module="sms" size="sm" />
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t(
              "marketing.messages.subtitle",
              "Deterministický messaging engine. Všetky správy vychádzajú zo schválených šablón s evidovaným právnym základom a rešpektujú tichý režim (20:00–08:00) a Sympathy Gate.",
            )}
          </p>
        </div>

        <Button
          onClick={() => processMutation.mutate()}
          disabled={processMutation.isPending}
          className="gap-2 shrink-0 self-start sm:self-center"
        >
          {processMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {t("marketing.messages.processQueue", "Spracovať frontu teraz")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>{t("marketing.messages.statsDelivered30d", "Doručené (30 dní)")}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.delivered + stats.sent}</div>
          <p className="text-[11px] text-muted-foreground">
            {t("marketing.messages.statsDeliveredDesc", "Úspešne odoslané správy")}
          </p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>{t("marketing.messages.statsQueued", "Čaká vo fronte")}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.queued}</div>
          <p className="text-[11px] text-muted-foreground">
            {t("marketing.messages.statsQueuedDesc", "Splatné podľa harmonogramu")}
          </p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>{t("marketing.messages.statsBlockedSympathy", "Zablokované (Sympathy Gate)")}</span>
            <ShieldAlert className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {stats.blocked_sympathy}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t("marketing.messages.statsBlockedSympathyDesc", "Ochrana smútiacich majiteľov")}
          </p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>{t("marketing.messages.statsSuppressed", "Potlačené pravidlami")}</span>
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground">{suppressedTotal}</div>
          <p className="text-[11px] text-muted-foreground">
            {t("marketing.messages.statsSuppressedDesc", "Rate limit, tichý režim, bez súhlasu")}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground mr-1" />
          <span className="text-xs font-semibold text-foreground">
            {t("marketing.messages.filterStatus", "Stav:")}
          </span>
          {[
            { id: "all", label: t("common.all", "Všetky") },
            { id: "queued", label: t("marketing.messages.filterQueued", "Vo fronte") },
            { id: "sent", label: t("marketing.messages.filterSent", "Odoslané") },
            { id: "blocked_sympathy", label: t("marketing.messages.filterSympathy", "Sympathy blok") },
            { id: "suppressed_no_consent", label: t("marketing.messages.filterNoConsent", "Bez súhlasu") },
            { id: "failed", label: t("marketing.messages.filterFailed", "Chyba") },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === st.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {t("marketing.messages.filterChannel", "Kanál:")}
          </span>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">{t("marketing.messages.channelAll", "Všetky kanály")}</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="push">Push</option>
          </select>
        </div>
      </div>

      {/* Message Logs Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-muted/20 font-semibold text-sm flex items-center justify-between">
          <span>
            {t("marketing.messages.logsTitle", "Denník správ ({count})", {
              count: logsQuery.data?.length ?? 0,
            })}
          </span>
        </div>

        {logsQuery.isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
            {t("marketing.messages.loadingLogs", "Načítavam históriu správ...")}
          </div>
        ) : !logsQuery.data || logsQuery.data.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <MessageSquare className="w-10 h-10 text-muted-foreground/50 mx-auto" />
            <p className="text-sm font-medium text-foreground">
              {t("marketing.messages.noMessagesInFilter", "Žiadne správy vo filtri")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("marketing.messages.noMessagesInFilterDesc", "Zvoľte iný filter alebo vyčkajte na splatné správy.")}
            </p>
          </div>
        ) : (
          <div className="divide-y text-xs">
            {logsQuery.data.map(({ log, client, patient }) => {
              const isBlockedSympathy = log.status === "blocked_sympathy";
              const isSuppressed = log.status.startsWith("suppressed");
              const isDelivered = log.status === "delivered" || log.status === "sent";

              return (
                <div key={log.id} className="p-4 space-y-2 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {client ? `${client.firstName} ${client.lastName}` : t("common.client", "Klient")}
                      </span>
                      {patient?.name && (
                        <Badge variant="outline" className="text-[10px]">
                          {patient.name} ({patient.species || "zviera"})
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                        {log.channel === "email" ? (
                          <Mail className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <Smartphone className="w-3 h-3 text-muted-foreground" />
                        )}
                        {log.channel.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isBlockedSympathy ? (
                        <Badge className="bg-purple-600 text-white font-semibold text-[10px] gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          {t("marketing.messages.badgeBlockedSympathy", "Zablokované: Sympathy Flow")}
                        </Badge>
                      ) : isSuppressed ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-400 text-[10px]">
                          {log.status === "suppressed_no_consent"
                            ? t("marketing.messages.badgeNoConsent", "Potlačené: Bez súhlasu")
                            : log.status === "suppressed_rate"
                            ? t("marketing.messages.badgeRateLimit", "Potlačené: Rate limit")
                            : t("marketing.messages.badgeQuietHours", "Potlačené: Tichý režim")}
                        </Badge>
                      ) : isDelivered ? (
                        <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {t("marketing.messages.badgeDelivered", "Doručené")}
                        </Badge>
                      ) : log.status === "failed" ? (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <XCircle className="w-3 h-3" />
                          {t("marketing.messages.badgeFailed", "Zlyhanie odoslania")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Clock className="w-3 h-3" />
                          {t("marketing.messages.badgeQueued", "Vo fronte")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/40 font-mono text-[12px] text-foreground leading-relaxed">
                    {log.bodyRendered}
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground gap-2 pt-1">
                    <span>
                      {t("marketing.messages.logTemplate", "Šablóna:")} <strong>{log.templateKey}</strong> (v{log.templateVersion}) · {t("marketing.messages.logLegalBasis", "Základ:")} {log.legalBasis}
                    </span>
                    <span>
                      {t("marketing.messages.logScheduled", "Plánované:")} {new Date(log.scheduledFor).toLocaleString("sk-SK")}
                      {log.sentAt && ` · ${t("marketing.messages.logSent", "Odoslané:")} ${new Date(log.sentAt).toLocaleString("sk-SK")}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
