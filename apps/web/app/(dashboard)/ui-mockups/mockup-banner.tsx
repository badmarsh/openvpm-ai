"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FlaskConical, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type MockupVariant = {
  readonly id: string;
  readonly label: string;
};

/**
 * Zdieľaný banner pre mockupy z UI auditu — jednoznačne označuje, že ide
 * o statický návrh (nie produkčnú stránku), a prepína varianty cez ?variant=.
 */
export function MockupBanner({
  title,
  finding,
  question,
  variants,
  activeVariant,
}: {
  title: string;
  finding: string;
  question: string;
  variants: readonly MockupVariant[];
  activeVariant: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="sticky top-0 z-20 border-b border-amber-300 bg-amber-50/95 backdrop-blur-sm dark:border-amber-800 dark:bg-amber-950/70">
      <div className="mx-auto max-w-6xl space-y-1.5 px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-400 bg-amber-100 px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-amber-900 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
              <FlaskConical className="h-3 w-3" aria-hidden="true" />
              Mockup
            </span>
            <h1 className="truncate text-sm font-bold text-amber-950 dark:text-amber-100">
              {title}
            </h1>
          </div>
          <nav aria-label="Varianty návrhu" className="flex items-center gap-1">
            {variants.map((variant) => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("variant", variant.id);
              const active = variant.id === activeVariant;
              return (
                <Link
                  key={variant.id}
                  href={`${pathname}?${params.toString()}`}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-2xs font-semibold transition-colors",
                    active
                      ? "border-amber-600 bg-amber-600 text-white"
                      : "border-amber-300 bg-transparent text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/50",
                  )}
                >
                  {variant.id.toUpperCase()} · {variant.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <p className="text-2xs leading-snug text-amber-900/80 dark:text-amber-200/80">{finding}</p>
        <p className="flex items-start gap-1.5 text-2xs font-semibold leading-snug text-amber-950 dark:text-amber-100">
          <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          Rozhodnutie: {question}
        </p>
      </div>
    </div>
  );
}
