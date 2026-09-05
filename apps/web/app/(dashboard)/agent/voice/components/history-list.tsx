"use client";

import { Mic, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Dictation {
  id: string;
  status: string;
  createdAt: Date | string;
  audioDurationSeconds?: string | null;
  rawTranscript?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  errorMessage?: string | null;
  patientId: string;
}

interface HistoryListProps {
  items: Dictation[];
  selectedId?: string | null;
  onSelect: (item: Dictation) => void;
}

const STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; label: string; bgColor: string }
> = {
  RECORDING: {
    icon: Mic,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    label: "Nahrávanie",
  },
  TRANSCRIBING: {
    icon: Loader2,
    color: "text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    label: "Transkripcia",
  },
  FORMATTING: {
    icon: Loader2,
    color: "text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    label: "Formátovanie",
  },
  COMPLETED: {
    icon: CheckCircle,
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    label: "Hotové",
  },
  FAILED: {
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    label: "Chyba",
  },
};

export function HistoryList({ items, selectedId, onSelect }: HistoryListProps) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          Žiadne predchádzajúce diktovania
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Začnite nahrávať pre vytvorenie prvého záznamu
        </p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1.5">
      {items.map((item) => {
        const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.FAILED;
        const StatusIcon = status.icon;
        const isSelected = item.id === selectedId;
        const duration = item.audioDurationSeconds
          ? `${item.audioDurationSeconds}s`
          : null;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              "w-full text-left rounded-lg p-3 transition-all duration-200",
              "border hover:border-primary/50 hover:shadow-sm",
              isSelected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-transparent hover:bg-muted/50",
            )}
          >
            <div className="flex items-start gap-2.5">
              <div
                className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                  status.bgColor,
                )}
              >
                <StatusIcon className={cn("h-3.5 w-3.5", status.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">
                    {status.label}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString("sk-SK", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                </div>
                {item.rawTranscript && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {item.rawTranscript}
                  </p>
                )}
                {item.errorMessage && (
                  <p className="mt-1 text-xs text-red-500">
                    {item.errorMessage}
                  </p>
                )}
                {duration && !item.rawTranscript && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Trvanie: {duration}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
