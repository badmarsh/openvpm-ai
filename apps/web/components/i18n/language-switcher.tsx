"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, locales, t } = useI18n();
  const [open, setOpen] = useState(false);

  const current = locales.find((l) => l.code === locale) ?? locales[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-1.5 px-2.5 font-medium text-foreground hover:bg-accent border-input shadow-none",
            className
          )}
          aria-label={t("locale.switchLanguage", `Switch language. Current: ${current.label}`)}
        >
          <span className="text-base leading-none" role="img" aria-label={current.label}>
            {current.flag}
          </span>
          <span className="text-xs uppercase font-semibold tracking-wider">
            {current.code}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-40 p-1 shadow-md border-border bg-popover"
      >
        <div className="text-[10px] font-bold text-muted-foreground px-2 py-1 uppercase tracking-wider">
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
                  "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors text-left",
                  isSelected
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base leading-none" role="img" aria-label={item.label}>
                    {item.flag}
                  </span>
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
