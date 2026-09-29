"use client";

import { Loader2, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechInput } from "@/lib/hooks/use-speech-input";
import { useI18n } from "@/lib/i18n";
import { TooltipHint } from "@/components/ui/tooltip";

interface MicButtonProps {
  getValue: () => string;
  setValue: (v: string) => void;
  lang?: string;
  className?: string;
}

/**
 * MicButton — inline mikrofón tlačidlo pre formulárové polia.
 * Stlač → hovor po slovensky → text sa vloží priamo do poľa.
 * Zobrazí sa len ak prehliadač podporuje Web Speech API.
 */
export function MicButton({
  getValue,
  setValue,
  lang = "sk-SK",
  className,
}: MicButtonProps) {
  const { t } = useI18n();
  const { state, interim, error, toggle, supported } = useSpeechInput(
    setValue,
    getValue,
    { lang }
  );

  // One string for both the tooltip and the accessible name: `title` alone
  // is not announced reliably by screen readers on icon-only buttons.
  const label = !supported
    ? t("fieldVisits.mic.unsupported", "Hlasové zadávanie nie je v tomto prehliadači dostupné")
    : error === "microphone-denied"
      ? t("fieldVisits.mic.permissionDenied", "Prístup k mikrofónu bol zamietnutý")
      : state === "listening"
        ? t("fieldVisits.mic.listening", "Zastaviť nahrávanie")
        : state === "processing"
          ? t("fieldVisits.mic.processing", "Spúšťam mikrofón…")
          : t("fieldVisits.mic.dictate", "Diktovať hlasom (slovenčina)");

  return (
    <span className="relative inline-flex shrink-0">
      <TooltipHint content={label}>
        <button
          type="button"
          onClick={toggle}
          disabled={!supported || state === "processing"}
          aria-label={label}
          aria-pressed={state === "listening"}
          className={cn(
            "inline-flex items-center justify-center rounded-md border h-8 w-8 transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            state === "listening"
              ? "bg-red-500 border-red-400 text-white shadow-sm shadow-red-200 motion-safe:animate-pulse"
              : !supported || state === "error"
                ? "bg-muted border-border text-muted-foreground opacity-60"
                : "bg-muted border-border text-muted-foreground hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700",
            className
          )}
        >
          {state === "processing" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : state === "listening" ? (
            <MicOff className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
        </button>
      </TooltipHint>
      {interim && (
        <span className="absolute top-full left-0 mt-1 z-50 text-2xs italic text-muted-foreground bg-background border rounded px-2 py-0.5 shadow-sm whitespace-nowrap max-w-[220px] truncate pointer-events-none">
          {interim}
        </span>
      )}
    </span>
  );
}
