"use client";

import {
  ShieldCheck,
  Stethoscope,
  Activity,
  Smile,
  Sparkles,
  HeartPulse,
  Syringe,
  Scissors,
  Eye,
  Thermometer,
  Pill,
  Award,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { servicesContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck,
  Stethoscope,
  Activity,
  Smile,
  Sparkles,
  HeartPulse,
  Syringe,
  Scissors,
  Eye,
  Thermometer,
  Pill,
  Award,
};

interface ServicesSectionProps {
  content: z.infer<typeof servicesContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function ServicesSection({ content, brandKit }: ServicesSectionProps) {
  const colClass =
    content.columns === "2"
      ? "grid-cols-1 sm:grid-cols-2"
      : content.columns === "4"
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
          {content.title}
        </h2>
        {content.subtitle && (
          <p className="text-sm font-medium text-muted-foreground">
            {content.subtitle}
          </p>
        )}
      </div>

      <div className={cn("grid gap-6", colClass)}>
        {content.services.map((service) => {
          const IconComponent = ICON_MAP[service.icon] || Stethoscope;

          return (
            <div
              key={service.id}
              className="rounded-2xl border border-border bg-card p-6 shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-xs"
                  style={{
                    backgroundColor: "var(--wb-secondary, #f5f5f4)",
                    color: "var(--wb-primary, #0d9488)",
                  }}
                >
                  <IconComponent className="h-6 w-6" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-foreground text-base leading-snug">
                      {service.title}
                    </h3>
                    {service.badge && (
                      <Badge variant="outline" className="text-[10px] shrink-0 font-medium">
                        {service.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </div>

              {service.price && (
                <div className="pt-4 mt-2 border-t border-border flex items-center justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Orientačná cena</span>
                  <span style={{ color: "var(--wb-primary, #0d9488)" }}>{service.price}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
