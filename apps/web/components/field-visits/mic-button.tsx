"use client";

import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechInput } from "@/lib/hooks/use-speech-input";

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
  const { state, interim, toggle, supported } = useSpeechInput(
    setValue,
    getValue,
    { lang }
  );

  if (!supported) return null;

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={toggle}
        title={
          state === "listening"
            ? "Zastaviť nahrávanie"
            : "Diktovať hlasom (slovenčina)"
        }
        className={cn(
          "inline-flex items-center justify-center rounded-md border h-8 w-8 transition-all",
          state === "listening"
            ? "bg-red-500 border-red-400 text-white shadow-sm shadow-red-200 animate-pulse"
            : "bg-muted border-border text-muted-foreground hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700",
          className
        )}
      >
        {state === "listening" ? (
          <MicOff className="h-3.5 w-3.5" />
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
      </button>
      {interim && (
        <span className="absolute top-full left-0 mt-1 z-50 text-[11px] italic text-muted-foreground bg-background border rounded px-2 py-0.5 shadow-sm whitespace-nowrap max-w-[220px] truncate pointer-events-none">
          {interim}
        </span>
      )}
    </span>
  );
}
