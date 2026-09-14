"use client";

import { ShieldCheck, Award, Lock, Clock, CheckCircle2, HeartHandshake } from "lucide-react";
import type { trustBadgesContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";

const BADGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck,
  Award,
  Lock,
  Clock,
  CheckCircle2,
  HeartHandshake,
};

interface TrustBadgesSectionProps {
  content: z.infer<typeof trustBadgesContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function TrustBadgesSection({ content }: TrustBadgesSectionProps) {
  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className="rounded-2xl border border-border bg-muted/20 p-6 md:p-8 space-y-6">
        {content.title && (
          <div className="text-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {content.title}
            </h3>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {content.items.map((item) => {
            const Icon = BADGE_ICONS[item.icon] || ShieldCheck;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-border/60 bg-card p-4 text-center space-y-2 shadow-2xs hover:border-primary/40 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-full mx-auto flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--wb-secondary, #f5f5f4)",
                    color: "var(--wb-primary, #0d9488)",
                  }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="font-bold text-xs text-foreground">{item.label}</div>
                {item.description && (
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {item.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
