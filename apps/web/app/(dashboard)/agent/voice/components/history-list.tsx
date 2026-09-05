"use client";

import { useState } from "react";
import {
  Mic,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Play,
  Pause,
  Trash2,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface Dictation {
  id: string;
  status: string;
  createdAt: Date | string;
  audioFileKey?: string | null;
  audioDeletedAt?: Date | string | null;
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
  onDeleted?: () => void;
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

export function HistoryList({
  items,
  selectedId,
  onSelect,
  onDeleted,
}: HistoryListProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Record<string, HTMLAudioElement>>({});

  const utils = trpc.useUtils();
  const deleteMutation = trpc.extensions.voice.delete.useMutation({
    onSuccess: () => {
      toast.success("Diktovanie zmazané");
      onDeleted?.();
      utils.extensions.voice.listByPatient.invalidate();
    },
    onError: (err) => {
      toast.error(`Zmazanie zlyhalo: ${err.message}`);
    },
  });

  const handlePlayAudio = async (e: React.MouseEvent, item: Dictation) => {
    e.stopPropagation();

    if (playingId === item.id) {
      const existing = audioElements[item.id];
      if (existing) {
        existing.pause();
        existing.currentTime = 0;
      }
      setPlayingId(null);
      return;
    }

    try {
      const res = await utils.client.extensions.voice.getAudio.query({
        dictationId: item.id,
      });

      if (!res?.audioDataUrl) {
        toast.error("Audio už nie je k dispozícii (bolo skartované podľa GDPR pravidla 24h)");
        return;
      }

      const audio = new Audio(res.audioDataUrl);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => {
        toast.error("Prehrávanie zlyhalo");
        setPlayingId(null);
      };

      // Stop previous
      if (playingId && audioElements[playingId]) {
        audioElements[playingId].pause();
      }

      setAudioElements((prev) => ({ ...prev, [item.id]: audio }));
      setPlayingId(item.id);
      await audio.play();
    } catch {
      toast.error("Nepodarilo sa načítať audio");
      setPlayingId(null);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Naozaj chcete zmazať toto diktovanie?")) {
      deleteMutation.mutate({ id });
    }
  };

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
    <div className="p-2 space-y-2">
      {items.map((item) => {
        const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.FAILED;
        const StatusIcon = status.icon;
        const isSelected = item.id === selectedId;
        const duration = item.audioDurationSeconds
          ? `${item.audioDurationSeconds}s`
          : null;
        const isAudioAvailable = !!item.audioFileKey && !item.audioDeletedAt;
        const isPlayingThis = playingId === item.id;

        return (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            className={cn(
              "w-full text-left rounded-xl p-3 transition-all duration-200 cursor-pointer",
              "border hover:border-violet-300 dark:hover:border-violet-800 hover:shadow-xs",
              isSelected
                ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/30 shadow-xs"
                : "border-border/60 bg-card hover:bg-muted/40",
            )}
          >
            <div className="flex items-start gap-2.5">
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                  status.bgColor,
                )}
              >
                <StatusIcon
                  className={cn(
                    "h-4 w-4",
                    status.color,
                    (item.status === "TRANSCRIBING" || item.status === "FORMATTING") &&
                      "animate-spin",
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-semibold truncate">
                      {status.label}
                    </span>
                    {duration && (
                      <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.2 rounded bg-muted">
                        {duration}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 font-mono">
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
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.rawTranscript}
                  </p>
                )}

                {item.errorMessage && (
                  <p className="mt-1 text-xs text-red-500 line-clamp-1">
                    {item.errorMessage}
                  </p>
                )}

                {/* Footer with Audio player toggle and GDPR status */}
                <div className="mt-2.5 pt-2 border-t flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    {isAudioAvailable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handlePlayAudio(e, item)}
                        className={cn(
                          "h-6 px-2 text-[11px] gap-1 rounded-md font-medium",
                          isPlayingThis
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : "bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-300",
                        )}
                        title="Prehrať originálne audio"
                      >
                        {isPlayingThis ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3 fill-current ml-0.5" />
                        )}
                        <span>{isPlayingThis ? "Zastaviť" : "Prehrať audio"}</span>
                      </Button>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground/70" title="Audio bolo zmazané podľa pravidla GDPR po 24 hodinách">
                        <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                        <span>GDPR skartované</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(e, item.id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500 rounded-md"
                      title="Zmazať záznam"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
