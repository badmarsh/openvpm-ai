"use client";

import { useEffect, useRef } from "react";
import { X, BookOpen, ListChecks, Link2, Lightbulb, Sparkles } from "lucide-react";
import Link from "next/link";
import { type HelpContent } from "./help-content";

interface HelpModalProps {
  content: HelpContent;
  onClose: () => void;
}

export function HelpModal({ content, onClose }: HelpModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-[5vh_5vw]"
      role="presentation"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Zavrieť pomocníka"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />

      {/* Panel - 10% total padding around fullscreen (90vw x 88vh) */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        tabIndex={-1}
        className="relative z-10 flex w-[90vw] max-w-[1440px] h-[88vh] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl focus:outline-none"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/30 px-8 py-4">
          <div>
            <h2
              id="help-modal-title"
              className="text-lg sm:text-xl font-bold text-foreground"
            >
              {content.title}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Kontextový sprievodca a nápoveda k tejto sekcii
            </p>
          </div>
          <button
            type="button"
            aria-label="Zavrieť"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 2-column body - optimized to minimize scrollbars */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_330px] xl:grid-cols-[1fr_370px] min-h-full">

            {/* Left column — Účel + Postup + Príklad z praxe */}
            <div className="border-b lg:border-b-0 lg:border-r border-border px-7 sm:px-8 py-6 space-y-6">

              {/* Účel modulu */}
              <section>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                    Účel modulu
                  </h3>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-foreground">
                  {content.intro}
                </p>
              </section>

              <div className="border-t border-border" />

              {/* Postup */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                    <ListChecks className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                    Postup krok za krokom
                  </h3>
                </div>
                <ol className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {content.steps.map((step, i) => (
                    <li
                      key={i}
                      className="flex gap-3 rounded-xl border border-border/60 bg-muted/15 p-3.5 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-lg border border-border/70">
                        {step.icon}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-xs font-bold text-foreground">
                          {step.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              {/* Príklad z klinickej praxe */}
              {content.practicalExample && (
                <section className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                        Príklad z klinickej praxe
                      </h3>
                    </div>
                    {content.practicalExample.badge && (
                      <span className="text-[10px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full border border-sky-500/20">
                        {content.practicalExample.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    {content.practicalExample.title}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1.5 leading-relaxed bg-background/60 rounded-lg p-3 border border-border/50">
                    <p>
                      <strong className="text-foreground">Scenár:</strong> {content.practicalExample.scenario}
                    </p>
                    <p>
                      <strong className="text-emerald-700 dark:text-emerald-400">Riešenie v OpenVPM:</strong> {content.practicalExample.solution}
                    </p>
                  </div>
                </section>
              )}
            </div>

            {/* Right column — Tipy + Súvisí s */}
            <div className="px-6 sm:px-7 py-6 space-y-6 bg-muted/20">

              {/* Tipy */}
              {content.tips && content.tips.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-950/50">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Tipy a skratky
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {content.tips.map((tip, i) => (
                      <li key={i} className="flex gap-2 text-xs text-foreground leading-relaxed">
                        <span className="text-amber-500 font-bold shrink-0">›</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Súvisí s */}
              {content.relatedModules && content.relatedModules.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                      <Link2 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                      Súvisí s
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {content.relatedModules.map((mod, i) => (
                      <Link
                        key={i}
                        href={mod.href}
                        onClick={onClose}
                        className="flex items-center justify-between rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                      >
                        <span>{mod.name}</span>
                        <span className="text-muted-foreground text-[10px]">→</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
