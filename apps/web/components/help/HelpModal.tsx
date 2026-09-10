"use client";

import { useEffect, useRef } from "react";
import { X, HelpCircle, Lightbulb } from "lucide-react";
import { type HelpContent } from "./help-content";

interface HelpModalProps {
  content: HelpContent;
  onClose: () => void;
}

export function HelpModal({ content, onClose }: HelpModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:items-center sm:justify-end sm:p-6"
      role="presentation"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Zavrieť pomocníka"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        tabIndex={-1}
        className="relative z-10 flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/50 px-5 py-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 shrink-0 text-primary" />
            <h2
              id="help-modal-title"
              className="text-base font-semibold text-foreground"
            >
              {content.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Zavrieť"
            onClick={onClose}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4">
          {/* Intro */}
          <p className="mb-4 text-sm text-muted-foreground">{content.intro}</p>

          {/* Steps */}
          <ol className="space-y-3">
            {content.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base"
                  aria-hidden="true"
                >
                  {step.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* Tips */}
          {content.tips && content.tips.length > 0 && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
              <div className="mb-2 flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Tipy
                </span>
              </div>
              <ul className="space-y-1">
                {content.tips.map((tip, i) => (
                  <li
                    key={i}
                    className="text-xs text-amber-800 dark:text-amber-300"
                  >
                    • {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
