"use client";

import type { statsContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";

interface StatsSectionProps {
  content: z.infer<typeof statsContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function resolveLiveStatValue(
  stat: { value: string; source?: "custom" | "patients" | "reviews" | "years" },
  liveStats?: WebsitePublicData["liveStats"]
): string {
  if (!liveStats) return stat.value;

  switch (stat.source) {
    case "patients": {
      const count = liveStats.patientCount;
      return typeof count === "number" && count > 0 ? `${count.toLocaleString("sk-SK")}+` : stat.value;
    }
    case "reviews": {
      const count = liveStats.fiveStarReviewCount;
      return typeof count === "number" && count > 0 ? `${count.toLocaleString("sk-SK")}+` : stat.value;
    }
    case "years": {
      const years = liveStats.yearsInPractice;
      return typeof years === "number" && years > 0 ? `${years}+` : stat.value;
    }
    case "custom":
    default:
      return stat.value;
  }
}

export function StatsSection({ content, contextData }: StatsSectionProps) {
  const formatStatValue = (stat: (typeof content.items)[number]) => {
    return resolveLiveStatValue(stat, contextData?.liveStats);
  };

  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div
        className="rounded-3xl border border-border p-8 md:p-10 shadow-xs"
        style={{
          backgroundColor: "var(--wb-secondary, #f5f5f4)",
        }}
      >
        {content.title && (
          <div className="text-center mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {content.title}
            </h2>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {content.items.map((stat) => (
            <div key={stat.id} className="space-y-1">
              <div
                className="text-3xl sm:text-4xl font-black tracking-tight"
                style={{ color: "var(--wb-primary, #0d9488)" }}
              >
                {formatStatValue(stat)}
              </div>
              <div className="text-sm font-bold text-foreground">
                {stat.label}
              </div>
              {stat.subtext && (
                <div className="text-xs text-muted-foreground font-medium">
                  {stat.subtext}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
