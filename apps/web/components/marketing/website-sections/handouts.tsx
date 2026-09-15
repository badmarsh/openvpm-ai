"use client";

import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";
import type { handoutsContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";

interface HandoutsSectionProps {
  content: z.infer<typeof handoutsContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function HandoutsSection({ content, contextData }: HandoutsSectionProps) {
  const allHandouts = contextData?.handouts || [];

  const filteredHandouts = allHandouts
    .filter((h) => content.filterSpecies === "all" || !h.species || h.species === content.filterSpecies)
    .slice(0, content.maxCount);

  if (filteredHandouts.length === 0 && !contextData) {
    return null;
  }

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 border-b border-border pb-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
            {content.title}
          </h2>
          {content.subtitle && (
            <p className="text-sm font-medium text-muted-foreground mt-1">
              {content.subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHandouts.map((h) => (
          <Link
            key={h.id}
            href={`/h/${h.slug}`}
            className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--wb-primary, #0d9488)" }}>
                <FileText className="h-4 w-4 shrink-0" />
                <span>Edukačný návod</span>
              </div>
              <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 text-base">
                {h.title}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                {h.body.replace(/[#*`_]/g, "").slice(0, 140)}...
              </p>
            </div>

            <div className="pt-4 mt-2 flex items-center justify-between text-xs font-semibold" style={{ color: "var(--wb-primary, #0d9488)" }}>
              <span>Prečítať celý leták</span>
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
