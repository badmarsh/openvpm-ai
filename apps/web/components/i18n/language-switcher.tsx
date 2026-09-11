"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { loadDictionary, useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function SlovakiaFlag({ className = "h-3.5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 480"
      className={cn("inline-block shrink-0", className)}
      aria-hidden="true"
    >
      <rect width="640" height="160" fill="#ffffff" />
      <rect y="160" width="640" height="160" fill="#0b4ea2" />
      <rect y="320" width="640" height="160" fill="#ee1c25" />
      {/* Slovak Shield */}
      <g transform="translate(140, 80) scale(0.65)">
        <path
          d="M 60 0 L 260 0 C 310 120 310 270 160 360 C 10 270 10 120 60 0 Z"
          fill="#ee1c25"
          stroke="#ffffff"
          strokeWidth="16"
        />
        {/* 3 Blue Hills */}
        <path
          d="M 50 330 C 70 270 110 260 130 280 C 150 240 170 240 190 280 C 210 260 250 270 270 330 C 220 360 100 360 50 330 Z"
          fill="#0b4ea2"
        />
        {/* Double Cross */}
        <path
          d="M 148 70 H 172 V 260 H 148 Z
             M 120 115 H 200 V 135 H 120 Z
             M 105 170 H 215 V 190 H 105 Z"
          fill="#ffffff"
        />
      </g>
    </svg>
  );
}

export function UkFlag({ className = "h-3.5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 480"
      className={cn("inline-block shrink-0", className)}
      aria-hidden="true"
    >
      <clipPath id="uk-flag-clip">
        <path d="M0,0 v480 h640 v-480 z" />
      </clipPath>
      <g clipPath="url(#uk-flag-clip)">
        <path d="M0,0 v480 h640 v-480 z" fill="#012169" />
        <path d="M0,0 L640,480 M640,0 L0,480" stroke="#ffffff" strokeWidth="80" />
        <path d="M0,0 L640,480 M640,0 L0,480" stroke="#c8102e" strokeWidth="48" />
        <path d="M320,0 v480 M0,240 h640" stroke="#ffffff" strokeWidth="130" />
        <path d="M320,0 v480 M0,240 h640" stroke="#c8102e" strokeWidth="80" />
      </g>
    </svg>
  );
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, locales, t } = useI18n();
  const [open, setOpen] = useState(false);

  const current = locales.find((l) => l.code === locale) ?? locales[0];

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // The non-default dictionary is code-split: start fetching it while
        // the user is still choosing, so the switch itself feels instant.
        if (next) {
          for (const option of locales) {
            if (option.code !== locale) void loadDictionary(option.code);
          }
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          suppressHydrationWarning
          className={cn(
            "h-9 gap-1.5 px-2.5 font-medium text-foreground hover:bg-accent border-input shadow-none",
            className
          )}
          aria-label={t("locale.switchLanguage", `Switch language. Current: ${current.label}`)}
          title={current.label}
        >
          {current.code === "sk" ? (
            <SlovakiaFlag className="h-3.5 w-5 rounded-[2px] shadow-xs border border-border/40 object-cover" />
          ) : (
            <UkFlag className="h-3.5 w-5 rounded-[2px] shadow-xs border border-border/40 object-cover" />
          )}
          <span className="text-xs uppercase font-semibold tracking-wider">
            {current.code}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-44 p-1 shadow-md border-border bg-popover"
      >
        <div className="text-[10px] font-bold text-muted-foreground px-2.5 py-1 uppercase tracking-wider">
          {t("locale.language", "Language")}
        </div>
        <div className="space-y-0.5 mt-0.5">
          {locales.map((item) => {
            const isSelected = item.code === locale;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setLocale(item.code);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium transition-colors text-left cursor-pointer",
                  isSelected
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <span className="flex items-center gap-2.5">
                  {item.code === "sk" ? (
                    <SlovakiaFlag className="h-3.5 w-5 rounded-[2px] shadow-xs border border-border/40" />
                  ) : (
                    <UkFlag className="h-3.5 w-5 rounded-[2px] shadow-xs border border-border/40" />
                  )}
                  <span>{item.label}</span>
                </span>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
