"use client";

import { Clock, MapPin, Phone, Mail, AlertTriangle } from "lucide-react";
import type { hoursLocationContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";

interface HoursLocationSectionProps {
  content: z.infer<typeof hoursLocationContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function HoursLocationSection({ content, contextData }: HoursLocationSectionProps) {
  const practice = contextData?.practice;
  const address = practice?.address || "Hlavná 12, 811 01 Bratislava";
  const phone = practice?.phone || "+421 900 123 456";
  const email = practice?.email;

  // Safe OpenStreetMap embed without API keys
  const mapAddress = content.mapQuery || address;
  const encodedAddress = encodeURIComponent(mapAddress);
  const mapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=17.0,48.1,17.2,48.2&layer=mapnik&marker=48.1486,17.1077`;

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
          {content.title}
        </h2>
        {content.subtitle && (
          <p className="text-sm font-medium text-muted-foreground">
            {content.subtitle}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Hours Table & Contacts */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-primary" />
              Ordinačné hodiny
            </h3>

            <div className="divide-y divide-border">
              {content.customHours.map((h, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">{h.day}</span>
                  <div className="text-right">
                    <span className="font-medium text-muted-foreground">{h.hours}</span>
                    {h.note && (
                      <span className="block text-[11px] text-primary">{h.note}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {content.emergencyNote && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span>{content.emergencyNote}</span>
            </div>
          )}

          <div className="space-y-2.5 pt-2 border-t border-border text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-foreground">{address}</span>
            </div>
            {phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <a href={`tel:${phone}`} className="hover:text-primary transition-colors">
                  {phone}
                </a>
              </div>
            )}
            {email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <a href={`mailto:${email}`} className="hover:text-primary transition-colors">
                  {email}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Map Container */}
        {content.showMap && (
          <div className="rounded-2xl border border-border overflow-hidden shadow-xs h-[360px] bg-muted/40 relative">
            <iframe
              title="Poloha kliniky na mape"
              src={mapEmbedUrl}
              className="w-full h-full border-0"
              loading="lazy"
            />
            <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-xs px-2 py-1 rounded text-[10px] text-muted-foreground border border-border">
              {address}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
