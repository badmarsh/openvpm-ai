"use client";

import { SafeMarkdown } from "./safe-markdown";
import type { aboutContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";
import { cn } from "@/lib/utils";

interface AboutSectionProps {
  content: z.infer<typeof aboutContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function AboutSection({ content, brandKit }: AboutSectionProps) {
  const hasImage = Boolean(content.imageUrl);

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div
        className={cn(
          "grid items-center gap-10",
          hasImage ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-3xl mx-auto text-center"
        )}
      >
        {/* Optional Image */}
        {hasImage && content.imagePosition === "left" && (
          <div className="relative rounded-3xl overflow-hidden shadow-md border border-border aspect-[4/3] bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.imageUrl!}
              alt={content.imageAlt || "O klinike"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Text Content */}
        <div className="space-y-6">
          <div className="space-y-2">
            <span
              className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border inline-block"
              style={{
                borderColor: "var(--wb-primary, #0d9488)",
                color: "var(--wb-primary, #0d9488)",
                backgroundColor: "var(--wb-secondary, #f5f5f4)",
              }}
            >
              Náš príbeh & hodnoty
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
              {content.title}
            </h2>
            {content.subtitle && (
              <p className="text-base font-medium text-muted-foreground">
                {content.subtitle}
              </p>
            )}
          </div>

          <SafeMarkdown content={content.story} />

          {content.stats && content.stats.length > 0 && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              {content.stats.map((stat, idx) => (
                <div key={idx} className="rounded-xl bg-muted/40 p-3 border border-border/60">
                  <div
                    className="text-2xl font-black tracking-tight"
                    style={{ color: "var(--wb-primary, #0d9488)" }}
                  >
                    {stat.value}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground mt-0.5">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Optional Image (Right position) */}
        {hasImage && content.imagePosition === "right" && (
          <div className="relative rounded-3xl overflow-hidden shadow-md border border-border aspect-[4/3] bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.imageUrl!}
              alt={content.imageAlt || "O klinike"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </section>
  );
}
