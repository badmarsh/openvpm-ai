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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      role="presentation"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Zavrieť pomocníka"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        tabIndex={-1}
        className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl focus:outline-none"
        style={{ maxHeight: "min(88vh, 700px)" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-4">
          <h2
            id="help-modal-title"
            className="text-lg font-semibold text-foreground"
          >
            {content.title}
          </h2>
          <button
            type="button"
            aria-label="Zavrieť"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">

          {/* Section 1 — Účel modulu */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-primary shrink-0" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
                Účel modulu
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {content.intro}
            </p>
            {content.tips && content.tips.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Tipy</span>
                </div>
                <ul className="space-y-1">
                  {content.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-amber-800 dark:text-amber-300">
                      • {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <div className="border-t border-border" />

          {/* Section 2 — Postup */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="h-4 w-4 text-primary shrink-0" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
                Postup
              </h3>
            </div>
            <ol className="space-y-3">
              {content.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg">
                    {step.icon}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Section 3 — Súvisí s */}
          {content.relatedModules && content.relatedModules.length > 0 && (
            <>
              <div className="border-t border-border" />
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="h-4 w-4 text-primary shrink-0" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
                    Súvisí s
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {content.relatedModules.map((mod) => (
                    <Link
                      key={mod.href}
                      href={mod.href}
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {mod.name}
                    </Link>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
