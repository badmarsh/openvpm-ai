import * as React from "react";
import {
  FilePenLine,
  Fingerprint,
  ShieldCheck,
  ShieldAlert,
  User,
  Clock,
  Globe,
} from "lucide-react";
import {
  diffLines,
  stringifyForDiff,
  type AuditTimelineEvent,
  type DiffLine,
} from "@/lib/audit/timeline";

/**
 * Univerzálny komponent pre kompletnú forenznú históriu záznamu.
 *
 * Zobrazuje pre každú udalosť:
 *   - KTO: meno lekára, rola, IP adresa
 *   - KEDY: presný klinický čas
 *   - ČO: typ akcie (úprava dávky, storno, pridanie diagnózy, potvrdenie AI návrhu)
 *   - DÔVOD: textové odôvodnenie lekára (pri oprave po uzatvorení)
 *   - DIFF: vizuálne zvýraznenie zmien (pôvodné vs. nové znenie)
 *   - PEČAŤ: hash chain potvrdzujúci integritu (AI ledger)
 *
 * Komponent je čisto prezentačný — dáta dodáva volajúci (napr. detail pacienta,
 * inšpekčný export). Takto ho možno použiť server-side (export) aj client-side.
 */

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function kindMeta(kind: AuditTimelineEvent["kind"]) {
  switch (kind) {
    case "ai_confirmation":
      return {
        icon: ShieldCheck,
        label: "Potvrdenie AI návrhu",
        iconClass: "text-violet-600 dark:text-violet-300",
      };
    case "clinical_correction":
      return {
        icon: FilePenLine,
        label: "Oprava záznamu",
        iconClass: "text-amber-600 dark:text-amber-300",
      };
    default:
      return {
        icon: ShieldAlert,
        label: "Zmena záznamu",
        iconClass: "text-sky-600 dark:text-sky-300",
      };
  }
}

function DiffBlock({ before, after }: { before?: unknown; after?: unknown }) {
  const beforeStr = stringifyForDiff(before);
  const afterStr = stringifyForDiff(after);

  // Bez pred/po hodnôt diff nezobrazujeme.
  if (!beforeStr && !afterStr) return null;

  const lines: DiffLine[] = diffLines(beforeStr, afterStr);

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border font-mono text-[11px] leading-relaxed">
      {lines.slice(0, 200).map((line, idx) => (
        <div
          key={idx}
          className={`px-3 py-0.5 whitespace-pre-wrap break-words ${
            line.type === "add"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : line.type === "remove"
                ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 line-through"
                : "text-muted-foreground"
          }`}
        >
          <span className="mr-2 select-none">
            {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
          </span>
          {line.text || " "}
        </div>
      ))}
    </div>
  );
}

export interface AuditHistoryTimelineProps {
  events: AuditTimelineEvent[];
  emptyMessage?: string;
  showHashChain?: boolean;
}

export function AuditHistoryTimeline({
  events,
  emptyMessage = "Pre tento záznam zatiaľ neexistuje žiadna história.",
  showHashChain = true,
}: AuditHistoryTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {events.map((event) => {
        const meta = kindMeta(event.kind);
        const Icon = meta.icon;
        const hasDiff = event.before !== undefined || event.after !== undefined;
        return (
          <li key={event.id} className="relative">
            <span className="absolute -left-[26px] top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background">
              <Icon className={`h-3 w-3 ${meta.iconClass}`} />
            </span>

            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold">{meta.label}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {event.action}
                </span>
                {event.reason && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    Dôvod: {event.reason}
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {event.actorName ?? "Neznámy používateľ"}
                  {event.actorRole ? (
                    <span className="rounded bg-muted px-1 text-[10px] uppercase">
                      {event.actorRole}
                    </span>
                  ) : null}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTimestamp(event.occurredAt)}
                </span>
                {event.ipAddress && (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" />
                    {event.ipAddress}
                  </span>
                )}
              </div>

              {hasDiff && <DiffBlock before={event.before} after={event.after} />}

              {showHashChain && event.eventHash && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Fingerprint className="h-3.5 w-3.5" />
                    Pečať:{" "}
                    <span className="font-mono">{event.eventHash.slice(0, 16)}…</span>
                  </span>
                  {event.sequenceNumber != null && (
                    <span className="font-mono">#seq {event.sequenceNumber}</span>
                  )}
                  {event.previousEventHash && (
                    <span className="font-mono">
                      ← {event.previousEventHash.slice(0, 12)}…
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default AuditHistoryTimeline;
