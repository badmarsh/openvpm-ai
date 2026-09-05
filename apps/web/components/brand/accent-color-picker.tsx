"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_GROUPS: { label: string; colors: string[] }[] = [
  {
    label: "Clinical",
    colors: ["#0d9488", "#059669", "#0284c7", "#0f766e"],
  },
  {
    label: "Warm",
    colors: ["#f97316", "#db2777", "#d97706", "#8b2635"],
  },
  {
    label: "Neutral",
    colors: ["#374151", "#475569", "#57534e", "#1f2937"],
  },
];

const ALL_PRESETS = COLOR_GROUPS.flatMap((g) => g.colors);
const FALLBACK = "#0d9488";

/** Lowercase, prepend #, expand #abc → #aabbcc, validate. Returns null if bad. */
function normalizeHex(input: string): string | null {
  let h = input.trim().toLowerCase();
  if (!h.startsWith("#")) h = "#" + h;
  if (/^#[0-9a-f]{3}$/.test(h)) {
    h = "#" + h.slice(1).split("").map((c) => c + c).join("");
  }
  return /^#[0-9a-f]{6}$/.test(h) ? h : null;
}

/**
 * Accent color picker with grouped brand presets (Clinical / Warm / Neutral)
 * plus a custom swatch that opens a lightweight popover with native color well
 * and hex input. Shared by Settings branding, onboarding, and Brand Kit tab.
 */
export function AccentColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const current = (value ?? "").toLowerCase();
  const customActive = !!current && !ALL_PRESETS.includes(current);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(customActive ? current : FALLBACK);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commit(v: string) {
    const hex = normalizeHex(v);
    if (hex) onChange(hex);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {COLOR_GROUPS.map((group) => (
          <div key={group.label} className="flex items-center gap-1.5">
            {group.colors.map((c) => {
              const active = current === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use accent color ${c}`}
                  title={c}
                  disabled={disabled}
                  onClick={() => onChange(c)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform disabled:opacity-50",
                    active
                      ? "scale-110 border-foreground"
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                >
                  {active ? (
                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}

        <div className="relative" ref={ref}>
          <button
            type="button"
            aria-label="Custom accent color"
            disabled={disabled}
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform disabled:opacity-50",
              customActive
                ? "scale-110 border-foreground"
                : "border-dashed border-muted-foreground/40 hover:scale-105"
            )}
            style={customActive ? { backgroundColor: current } : undefined}
          >
            {customActive ? (
              <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
            ) : (
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {open ? (
            <div className="absolute right-0 top-10 z-30 w-56 rounded-lg border border-border bg-popover p-3 shadow-lg">
              <p className="mb-2 text-xs font-medium text-foreground">
                Vlastná farba
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={normalizeHex(draft) ?? FALLBACK}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    commit(e.target.value);
                  }}
                  aria-label="Pick color"
                  className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
                />
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commit(draft)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commit(draft);
                      setOpen(false);
                    }
                  }}
                  placeholder={FALLBACK}
                  maxLength={7}
                  spellCheck={false}
                  aria-label="Hex color"
                  className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  commit(draft);
                  setOpen(false);
                }}
                disabled={!normalizeHex(draft) || disabled}
                className="mt-2.5 h-8 w-full rounded-md bg-primary text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                Použiť túto farbu
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex gap-4 text-[10px] text-muted-foreground">
        {COLOR_GROUPS.map((g) => (
          <span key={g.label}>{g.label}</span>
        ))}
        <span>Vlastná</span>
      </div>
    </div>
  );
}
