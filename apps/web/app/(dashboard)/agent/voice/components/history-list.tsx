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
  { icon: React.ElementType; color: string; label: string }
> = {
  RECORDING: { icon: Mic, color: "text-blue-500", label: "Nahrávanie" },
  TRANSCRIBING: {
    icon: Loader2,
    color: "text-yellow-500",
    label: "Transkripcia",
  },
  FORMATTING: {
    icon: Loader2,
    color: "text-yellow-500",
    label: "Formátovanie",
  },
  COMPLETED: { icon: CheckCircle, color: "text-green-500", label: "Hotové" },
  FAILED: { icon: AlertCircle, color: "text-red-500", label: "Chyba" },
};

export function HistoryList({ items, selectedId, onSelect }: HistoryListProps) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
        Žiadne predchádzajúce diktovania
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.FAILED;
        const StatusIcon = status.icon;
        const isSelected = item.id === selectedId;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              "w-full text-left rounded-md border p-3 transition-colors hover:bg-accent",
              isSelected && "border-primary bg-accent",
            )}
          >
            <div className="flex items-center gap-2">
              <StatusIcon className={cn("h-4 w-4", status.color)} />
              <span className="text-sm font-medium">{status.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleString("sk-SK")
                  : ""}
              </span>
            </div>
            {item.rawTranscript && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {item.rawTranscript}
              </p>
            )}
            {item.errorMessage && (
              <p className="mt-1 text-xs text-red-500">{item.errorMessage}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
