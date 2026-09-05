"use client";

import { useState } from "react";
import {
  Palette,
  Sun,
  Moon,
  Check,
  ExternalLink,
  Code,
  Sparkles,
} from "lucide-react";
import { useGuiTheme } from "@/lib/theme/theme-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ThemeSwitcher({ className }: { className?: string }) {
  const {
    activeThemeId,
    mode,
    presets,
    setTheme,
    setMode,
    toggleMode,
    importCustomCss,
  } = useGuiTheme();

  const [open, setOpen] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [customCssInput, setCustomCssInput] = useState("");

  const activePreset = presets.find((p) => p.id === activeThemeId);

  function handleImport() {
    if (!customCssInput.trim()) return;
    const ok = importCustomCss(customCssInput);
    if (ok) {
      toast.success("Téma z tweakcn bola úspešne aplikovaná!");
      setShowImporter(false);
      setCustomCssInput("");
    } else {
      toast.error(
        "Nepodarilo sa rozpoznať CSS premenné. Skopírujte CSS z tweakcn.com/community (:root a .dark)."
      );
    }
  }

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
          aria-label="Prepnúť tému a vzhľad GUI"
        >
          {mode === "dark" ? (
            <Moon className="h-4 w-4 text-primary" />
          ) : (
            <Sun className="h-4 w-4 text-amber-500" />
          )}
          <span className="hidden md:inline text-xs font-semibold">
            {activeThemeId === "custom"
              ? "Custom"
              : activePreset?.name ?? "Téma"}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-84 max-h-[85vh] overflow-y-auto p-3 shadow-xl border-border bg-popover"
      >
        {/* Header & Mode Switcher */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-1.5">
            <Palette className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              GUI Témy
            </span>
          </div>

          {/* Light / Dark Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
            <button
              type="button"
              onClick={() => setMode("light")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all",
                mode === "light"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sun className="h-3 w-3 text-amber-500" />
              Svetlý
            </button>
            <button
              type="button"
              onClick={() => setMode("dark")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all",
                mode === "dark"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Moon className="h-3 w-3 text-primary" />
              Tmavý
            </button>
          </div>
        </div>

        {/* Presets List */}
        <div className="space-y-1.5 py-3">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
            Šablóny vzhľadu
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {presets.map((preset) => {
              const isActive = activeThemeId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setTheme(preset.id);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-2 text-left transition-all",
                    isActive
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border hover:border-foreground/30 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex shrink-0 -space-x-1">
                      <div
                        className="h-4 w-4 rounded-full border-2 border-background shadow-xs"
                        style={{ backgroundColor: preset.primaryColorHex }}
                      />
                      <div
                        className="h-4 w-4 rounded-full border-2 border-background shadow-xs"
                        style={{ backgroundColor: preset.secondaryColorHex }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {preset.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {preset.description}
                      </p>
                    </div>
                  </div>

                  {isActive && (
                    <Check className="h-4 w-4 text-primary shrink-0 ml-2" />
                  )}
                </button>
              );
            })}

            {activeThemeId === "custom" && (
              <div className="flex items-center justify-between rounded-lg border border-primary bg-primary/5 p-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Vlastná tweakcn téma
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Importovaná z tweakcn.com
                    </p>
                  </div>
                </div>
                <Check className="h-4 w-4 text-primary" />
              </div>
            )}
          </div>
        </div>

        {/* tweakcn Importer Drawer */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowImporter(!showImporter)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Code className="h-3.5 w-3.5" />
              {showImporter
                ? "Skryť importér"
                : "Importovať z tweakcn.com"}
            </button>

            <a
              href="https://tweakcn.com/community"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              tweakcn.com
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          {showImporter && (
            <div className="mt-2.5 space-y-2 rounded-lg border border-border bg-muted/20 p-2.5">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Skopírujte CSS kód z ktorejkoľvek témy na{" "}
                <a
                  href="https://tweakcn.com/community"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary underline"
                >
                  tweakcn.com/community
                </a>{" "}
                a vložte ho sem:
              </p>
              <textarea
                value={customCssInput}
                onChange={(e) => setCustomCssInput(e.target.value)}
                rows={4}
                placeholder={`@import "tailwindcss";\n:root {\n  --background: oklch(...);\n  --primary: ...;\n}`}
                className="w-full rounded-md border border-input bg-background p-2 font-mono text-[10px] leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex justify-end gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setShowImporter(false)}
                >
                  Zrušiť
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-[11px] gap-1"
                  onClick={handleImport}
                >
                  <Sparkles className="h-3 w-3" />
                  Aplikovať tému
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
