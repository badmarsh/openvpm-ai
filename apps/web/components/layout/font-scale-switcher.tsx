"use client";

import { useLayoutEffect, useState } from "react";
import { Check, Type } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  FONT_SCALES,
  applyFontScale,
  readFontScale,
  type FontScale,
} from "@/lib/font-scale";

/**
 * Per-device font-size switcher for the dashboard TopBar.
 * Persists to localStorage and applies `data-font-scale` on <html>
 * (see apps/web/styles/globals.css). Never touches clinical/fiscal logic.
 */
export function FontScaleSwitcher({ className }: { className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState<FontScale>("standard");

  useLayoutEffect(() => {
    const stored = readFontScale();
    setScale(stored);
    applyFontScale(stored);
  }, []);

  function handleSelect(next: FontScale) {
    setScale(next);
    applyFontScale(next);
    setOpen(false);
  }

  const labels: Record<FontScale, string> = {
    standard: t("chrome.fontScale.standard", "Štandardná"),
    large: t("chrome.fontScale.large", "Väčšia"),
    xl: t("chrome.fontScale.xl", "Najväčšia"),
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9", className)}
          aria-label={t("chrome.fontScale.buttonAria", "Zmeniť veľkosť písma")}
          title={t("chrome.fontScale.label", "Veľkosť písma")}
        >
          <Type className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("chrome.fontScale.label", "Veľkosť písma")}
        </p>
        {FONT_SCALES.map((option) => (
          <button
            key={option}
            type="button"
            role="menuitemradio"
            aria-checked={scale === option}
            onClick={() => handleSelect(option)}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground",
              scale === option && "font-semibold text-foreground",
            )}
          >
            <span
              style={{
                fontSize:
                  option === "standard"
                    ? "0.75rem"
                    : option === "large"
                      ? "0.875rem"
                      : "1rem",
              }}
            >
              {labels[option]}
            </span>
            {scale === option && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
