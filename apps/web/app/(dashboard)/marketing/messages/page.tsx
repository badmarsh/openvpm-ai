"use client";

import { useState } from "react";
import {
  MessageSquare,
  Send,
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
import { toast } from "sonner";

export default function MarketingMessagesPage() {
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
      toast.success(`Fronta spracovaná: ${data.sent} odoslaných, ${data.suppressed} potlačených.`);
      utils.extensions.marketing.getMessageStats.invalidate();
      utils.extensions.marketing.listMessageLogs.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa spracovať frontu správ.");
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-primary" />
            {t("marketing.messages.title", "Správy & Komunikácia")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t(
              "marketing.messages.subtitle",
              "Deterministický messaging engine. Všetky správy vychádzajú zo schválených šablón s evidovaným právnym základom a rešpektujú tichý režim (20:00–08:00) a Sympathy Gate."
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
            <span>Doručené (30 dní)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.delivered + stats.sent}</div>
          <p className="text-[11px] text-muted-foreground">Úspešne odoslané správy</p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Čaká vo fronte</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.queued}</div>
          <p className="text-[11px] text-muted-foreground">Splatné podľa harmonogramu</p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Zablokované (Sympathy Gate)</span>
            <ShieldAlert className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {stats.blocked_sympathy}
          </div>
          <p className="text-[11px] text-muted-foreground">Ochrana smútiacich majiteľov</p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Potlačené pravidlami</span>
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground">{suppressedTotal}</div>
          <p className="text-[11px] text-muted-foreground">Rate limit, tichý režim, bez súhlasu</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground mr-1" />
          <span className="text-xs font-semibold text-foreground">Stav:</span>
          {["all", "queued", "sent", "delivered", "blocked_sympathy", "suppressed_no_consent", "failed"].map(
            (st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === st
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
              >
                {st === "all"
                  ? "Všetky"
                  : st === "queued"
                  ? "Vo fronte"
                  : st === "sent" || st === "delivered"
                  ? "Odoslané"
                  : st === "blocked_sympathy"
                  ? "Sympathy blok"
                  : st === "suppressed_no_consent"
                  ? "Bez súhlasu"
                  : "Chyba"}
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Kanál:</span>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Všetky kanály</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="push">Push</option>
          </select>
        </div>
      </div>

      {/* Message Logs Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-muted/20 font-semibold text-sm flex items-center justify-between">
          <span>Denník správ ({logsQuery.data?.length ?? 0})</span>
        </div>

        {logsQuery.isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
            Načítavam históriu správ...
          </div>
        ) : !logsQuery.data || logsQuery.data.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <MessageSquare className="w-10 h-10 text-muted-foreground/50 mx-auto" />
            <p className="text-sm font-medium text-foreground">Žiadne správy vo filtri</p>
            <p className="text-xs text-muted-foreground">Zvoľte iný filter alebo vyčkajte na splatné správy.</p>
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
                        {client ? `${client.firstName} ${client.lastName}` : "Klient"}
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
                          Zablokované: Sympathy Flow
                        </Badge>
                      ) : isSuppressed ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-400 text-[10px]">
                          {log.status === "suppressed_no_consent"
                            ? "Potlačené: Bez súhlasu"
                            : log.status === "suppressed_rate"
                            ? "Potlačené: Rate limit"
                            : "Potlačené: Tichý režim"}
                        </Badge>
                      ) : isDelivered ? (
                        <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Doručené
                        </Badge>
                      ) : log.status === "failed" ? (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <XCircle className="w-3 h-3" />
                          Zlyhanie odoslania
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Clock className="w-3 h-3" />
                          Vo fronte
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/40 font-mono text-[12px] text-foreground leading-relaxed">
                    {log.bodyRendered}
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground gap-2 pt-1">
                    <span>Šablóna: <strong>{log.templateKey}</strong> (v{log.templateVersion}) · Základ: {log.legalBasis}</span>
                    <span>
                      Plánované: {new Date(log.scheduledFor).toLocaleString("sk-SK")}
                      {log.sentAt && ` · Odoslané: ${new Date(log.sentAt).toLocaleString("sk-SK")}`}
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
