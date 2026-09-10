"use client";

import { useEffect, useRef } from "react";
import { X, BookOpen, ListChecks, Link2, Lightbulb } from "lucide-react";
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Zavrieť pomocníka"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        tabIndex={-1}
        className="relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl focus:outline-none"
        style={{ maxHeight: "min(90vh, 780px)" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/30 px-7 py-5">
          <div>
            <h2
              id="help-modal-title"
              className="text-xl font-semibold text-foreground"
            >
              {content.title}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Nápoveda k tejto sekcii</p>
          </div>
          <button
            type="button"
            aria-label="Zavrieť"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 2-column body */}
        <div className="overflow-y-auto">
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_320px]">

            {/* Left column — Účel + Postup */}
            <div className="border-r border-border px-7 py-6 space-y-7">

              {/* Účel modulu */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                    Účel modulu
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  {content.intro}
                </p>
              </section>

              <div className="border-t border-border" />

              {/* Postup */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                    <ListChecks className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                    Postup krok za krokom
                  </h3>
                </div>
                <ol className="space-y-4">
                  {content.steps.map((step, i) => (
                    <li key={i} className="flex gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-xl border border-border">
                        {step.icon}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-sm font-semibold text-foreground">{step.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            {/* Right column — Tipy + Súvisí s */}
            <div className="px-6 py-6 space-y-6 bg-muted/20">

              {/* Tipy */}
              {content.tips && content.tips.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-950/50">
                      <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Tipy a skratky
                    </h3>
                  </div>
                  <ul className="space-y-2.5">
                    {content.tips.map((tip, i) => (
                      <li key={i} className="flex gap-2 text-sm text-foreground leading-relaxed">
                        <span className="mt-0.5 text-amber-500 shrink-0">›</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Súvisí s */}
              {content.relatedModules && content.relatedModules.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                      <Link2 className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                      Súvisí s
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {content.relatedModules.map((mod) => (
                      <Link
                        key={mod.href}
                        href={mod.href}
                        onClick={onClose}
                        className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <span>{mod.name}</span>
                        <span className="text-muted-foreground">→</span>
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
