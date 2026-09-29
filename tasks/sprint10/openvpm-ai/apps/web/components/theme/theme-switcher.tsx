"use client";

import { useState } from "react";
import {
  Palette,
  Sun,
  Moon,
  Check,
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
    mounted,
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
      toast.success("Vlastná téma bola úspešne aplikovaná!");
      setShowImporter(false);
      setCustomCssInput("");
    } else {
      toast.error(
        "Nepodarilo sa rozpoznať CSS premenné. Vložte CSS premenné (:root a .dark)."
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
          suppressHydrationWarning
          className={cn(
            "h-9 w-9 p-0 font-medium text-foreground hover:bg-accent border-input shadow-none",
            className
          )}
          aria-label="Prepnúť tému a vzhľad GUI"
          title={mounted && activePreset ? `Téma: ${activePreset.name}` : "Téma"}
        >
          {/* Render a neutral icon until localStorage is loaded to avoid hydration mismatch */}
          {!mounted ? (
            <Palette className="h-4 w-4 text-muted-foreground" />
          ) : mode === "dark" ? (
            <Moon className="h-4 w-4 text-primary" />
          ) : (
            <Sun className="h-4 w-4 text-amber-500" />
          )}
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
            </span>
          </div>

          {/* Light / Dark segmented toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setMode("light")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
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
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
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

        {/* Current Active Theme Indicator */}
        <div className="py-2.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Aktívna téma:</span>
          <div className="flex items-center gap-1.5">
            {activePreset && (
              <span
                className="h-3 w-3 rounded-full border border-border/60 shrink-0"
                style={{ backgroundColor: activePreset.primaryColorHex }}
              />
            )}
            <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
              {activeThemeId === "custom"
                ? "Vlastná téma"
                : activePreset?.name ?? "Východzia"}
            </Badge>
          </div>
        </div>

        {/* Preset Categories */}
        <div className="space-y-3 py-1">
          {/* Modern & Tech */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              Modern & Tech
            </span>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {presets
                .filter((p) =>
                  [
                    "supabase",
                    "linear",
                    "shadcn",
                    "cyberpunk",
                    "catppuccin",
                  ].includes(p.id)
                )
                .map((preset) => {
                  const isActive = activeThemeId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setTheme(preset.id)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-2 text-left text-xs transition-all",
                        isActive
                          ? "border-primary bg-primary/10 font-semibold text-primary shadow-xs"
                          : "border-border/60 hover:border-border hover:bg-accent/50 text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/10 shrink-0 shadow-xs"
                          style={{ backgroundColor: preset.primaryColorHex }}
                        />
                        <span className="truncate">{preset.name}</span>
                      </div>
                      {isActive && (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Elegant & Deep */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              Elegant & Deep
            </span>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {presets
                .filter((p) =>
                  [
                    "nord",
                    "tokyo-night",
                    "rose-pine",
                    "dracula",
                  ].includes(p.id)
                )
                .map((preset) => {
                  const isActive = activeThemeId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setTheme(preset.id)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-2 text-left text-xs transition-all",
                        isActive
                          ? "border-primary bg-primary/10 font-semibold text-primary shadow-xs"
                          : "border-border/60 hover:border-border hover:bg-accent/50 text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/10 shrink-0 shadow-xs"
                          style={{ backgroundColor: preset.primaryColorHex }}
                        />
                        <span className="truncate">{preset.name}</span>
                      </div>
                      {isActive && (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Warm & Nature */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              Warm & Nature
            </span>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {presets
                .filter((p) =>
                  [
                    "amber-minimal",
                    "forest",
                    "solarized",
                  ].includes(p.id)
                )
                .map((preset) => {
                  const isActive = activeThemeId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setTheme(preset.id)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-2 text-left text-xs transition-all",
                        isActive
                          ? "border-primary bg-primary/10 font-semibold text-primary shadow-xs"
                          : "border-border/60 hover:border-border hover:bg-accent/50 text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/10 shrink-0 shadow-xs"
                          style={{ backgroundColor: preset.primaryColorHex }}
                        />
                        <span className="truncate">{preset.name}</span>
                      </div>
                      {isActive && (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Custom CSS Importer Drawer */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowImporter(!showImporter)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              <Code className="h-3.5 w-3.5" />
              {showImporter
                ? "Skryť importér"
                : "Importovať vlastné CSS"}
            </button>
          </div>

          {showImporter && (
            <div className="mt-2.5 space-y-2 rounded-lg border border-border bg-muted/20 p-2.5">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Vložte CSS kód (:root a .dark premenné) a kliknite na aplikovať:
              </p>
              <textarea
                value={customCssInput}
                onChange={(e) => setCustomCssInput(e.target.value)}
                rows={4}
                placeholder={`:root {\n  --background: oklch(...);\n  --primary: ...;\n}`}
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
