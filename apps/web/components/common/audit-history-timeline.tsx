"use client";

import { useState } from "react";
import {
  ShieldCheck,
  User,
  Clock,
  FileEdit,
  CheckCircle,
  Hash,
  ChevronDown,
  ChevronUp,
  Fingerprint,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface AuditHistoryTimelineProps {
  entityType: "soap_note" | "discharge_report" | "imaging_analysis" | "treatment_plan" | "prescription";
  entityId: string;
  title?: string;
}

export function AuditHistoryTimeline({
  entityType,
  entityId,
  title,
}: AuditHistoryTimelineProps) {
  const { t } = useI18n();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: history, isLoading } = trpc.extensions.auditExport.getEntityHistory.useQuery({
    entityType,
    entityId,
  });

  if (isLoading) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground animate-pulse">
        Načítavam forenzný audit trail...
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
        Pre tento záznam zatiaľ nebol zaevidovaný žiadny auditný zápis.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h4 className="font-heading font-semibold text-sm">
            {title || t("audit.timeline.title", "Forenzný audit trail (Append-only Ledger)")}
          </h4>
        </div>
        <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
          <Fingerprint className="h-3 w-3" />
          SHA-256 Hash Chain
        </Badge>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {history.map((item, idx) => {
          const isExpanded = expandedId === item.id;
          const dateStr = new Date(item.confirmedAt).toLocaleString("sk-SK", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          return (
            <div key={item.id} className="relative">
              {/* Ikona na osi */}
              <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-primary shadow-sm">
                <CheckCircle className="h-3 w-3 text-emerald-600" />
              </div>

              <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2 hover:border-border transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">
                      #{item.sequenceNumber ?? idx + 1}
                    </span>
                    <span className="font-medium text-xs text-foreground flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {item.actorName}
                    </span>
                    <Badge variant="secondary" className="text-[10px] py-0">
                      {item.actorRole || "veterinarian"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {dateStr}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="text-muted-foreground">Akcia:</span>
                  <span className="font-medium">{item.actionType || "Potvrdenie klinického záznamu"}</span>
                  {item.wasEditedByClinician ? (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]">
                      <FileEdit className="h-2.5 w-2.5 mr-1" />
                      Lekársky upravené
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                      Prijaté bez zmeny
                    </Badge>
                  )}
                </div>

                {/* Kryptografické detaily */}
                <div className="pt-1">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Hash className="h-3 w-3" />
                    <span>Kryptografický odtlačok</span>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 rounded bg-background p-2.5 font-mono text-[10px] text-muted-foreground space-y-1.5 border">
                      <div>
                        <span className="text-foreground font-semibold">Event Hash:</span>{" "}
                        <span className="break-all">{item.eventHash || "—"}</span>
                      </div>
                      {item.previousEventHash && (
                        <div>
                          <span className="text-foreground font-semibold">Previous Hash:</span>{" "}
                          <span className="break-all">{item.previousEventHash}</span>
                        </div>
                      )}
                      {item.ipAddress && (
                        <div>
                          <span className="text-foreground font-semibold">IP Adresa:</span>{" "}
                          <span>{item.ipAddress}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
