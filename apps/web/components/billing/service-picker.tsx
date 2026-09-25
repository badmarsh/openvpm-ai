"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export interface ServicePickerService {
  id: string;
  name: string;
  code?: string | null;
  category?: string | null;
  defaultPrice: string;
}

/**
 * Type-ahead service picker for charge capture. Front-desk speed is the whole
 * game (see the PIMS research in the ledger): one search box over the whole
 * service list, prefix matches ranked first, category and price visible on
 * every row, and a full keyboard flow (arrows + Enter, Escape closes).
 * Replaces the plain <select>, which stops scaling past a few dozen services.
 */
export function ServicePicker({
  services,
  value,
  onSelect,
  disabled,
  formatPrice,
}: {
  services: ServicePickerService[];
  value: string;
  onSelect: (serviceId: string) => void;
  disabled?: boolean;
  formatPrice?: (price: string) => string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = services.find((s) => s.id === value) ?? null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    const starts: ServicePickerService[] = [];
    const contains: ServicePickerService[] = [];
    for (const s of services) {
      const name = s.name.toLowerCase();
      const code = s.code?.toLowerCase() ?? "";
      const category = s.category?.toLowerCase() ?? "";
      if (name.startsWith(q) || code.startsWith(q)) starts.push(s);
      else if (
        name.includes(q) ||
        code.includes(q) ||
        category.includes(q)
      )
        contains.push(s);
    }
    return [...starts, ...contains];
  }, [services, query]);

  // Close on any click outside the control.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  // Keep the highlighted row in view while arrowing through results.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${highlight}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  function choose(service: ServicePickerService) {
    onSelect(service.id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      event.preventDefault();
      return;
    }
    if (!open) return;
    if (event.key === "ArrowDown") {
      setHighlight((h) => Math.min(h + 1, results.length - 1));
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      setHighlight((h) => Math.max(h - 1, 0));
      event.preventDefault();
    } else if (event.key === "Enter") {
      const service = results[highlight];
      if (service) choose(service);
      event.preventDefault();
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      event.preventDefault();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((v) => !v);
          // Focus lands in the search box so typing starts immediately.
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !selected && "text-muted-foreground"
        )}
      >
        <span className="truncate">
          {selected
            ? selected.name
            : t(
                "billing.servicePicker.placeholder",
                "Search services or products...",
              )}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-full min-w-[300px] sm:min-w-[380px] max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t(
                "billing.servicePicker.typeServiceName",
                "Type a service or product name...",
              )}
              aria-label={t(
                "billing.servicePicker.searchServicesAria",
                "Search services and products",
              )}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div
            ref={listRef}
            role="listbox"
            className="max-h-64 overflow-y-auto overflow-x-hidden p-1"
          >
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t(
                  "billing.servicePicker.noMatch",
                  "No services match \"{query}\".",
                  { query },
                )}
              </p>
            ) : (
              results.map((service, index) => (
                <button
                  key={service.id}
                  type="button"
                  role="option"
                  aria-selected={service.id === value}
                  data-index={index}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(service)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-sm p-2 text-left text-sm transition-colors",
                    index === highlight && "bg-accent text-accent-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center",
                      service.id === value ? "text-primary" : "text-transparent",
                    )}
                  >
                    <Check className="h-4 w-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="font-medium text-foreground line-clamp-2"
                        title={service.name}
                      >
                        {service.name}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-foreground">
                        {formatPrice
                          ? formatPrice(service.defaultPrice)
                          : `$${service.defaultPrice}`}
                      </span>
                    </div>
                    {service.code || service.category ? (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {service.code ? (
                          <span className="shrink-0 font-mono text-[11px] rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
                            {service.code}
                          </span>
                        ) : null}
                        {service.category ? (
                          <span className="text-[11px] text-muted-foreground">
                            {service.category}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
