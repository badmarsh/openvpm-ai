"use client";

import Link from "next/link";
import { PawPrint, CalendarCheck2, Phone, Clock, MapPin, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { heroContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";

interface HeroSectionProps {
  content: z.infer<typeof heroContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function HeroSection({ content, brandKit, contextData, isEditor }: HeroSectionProps) {
  const practice = contextData?.practice;
  const bookingSlug = contextData?.bookingSlug;
  const clinicName = content.title || practice?.name || brandKit?.clinicName || "Veterinárna klinika";
  const phone = practice?.phone || "+421 900 123 456";
  const address = practice?.address;
  const email = practice?.email;

  const defaultBookingUrl = bookingSlug
    ? `/book/${bookingSlug}?utm_source=klinika_web&utm_medium=site`
    : practice?.id
    ? `/book/${practice.id}?utm_source=klinika_web&utm_medium=site`
    : "#book";
  const primaryCtaUrl = content.primaryCtaUrl || defaultBookingUrl;
  const secondaryCtaUrl = content.secondaryCtaUrl || (phone ? `tel:${phone}` : "#contact");

  return (
    <header
      className="relative overflow-hidden text-white py-16 px-4 sm:px-6 lg:px-8 shadow-md"
      style={{
        backgroundColor: "var(--wb-primary, #0d9488)",
        backgroundImage: content.backgroundImage ? `url(${content.backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Background Gradient Overlay */}
      {content.overlayGradient && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/70 backdrop-blur-[1px] pointer-events-none"
        />
      )}

      <div className="relative max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8 z-10">
        <div className="space-y-4 max-w-2xl">
          {content.badge && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold tracking-wide border border-white/20">
              <PawPrint className="h-4 w-4" />
              <span>{content.badge}</span>
            </div>
          )}

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight drop-shadow-xs">
            {clinicName}
          </h1>

          <p className="text-base sm:text-lg text-white/90 font-medium leading-relaxed max-w-xl">
            {content.subtitle}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {isEditor ? (
              <Button size="lg" className="gap-2 font-bold shadow-md bg-white text-stone-900 hover:bg-stone-100">
                <CalendarCheck2 className="h-5 w-5 text-emerald-600" />
                {content.primaryCtaText}
              </Button>
            ) : (
              <Link href={primaryCtaUrl}>
                <Button size="lg" className="gap-2 font-bold shadow-md bg-white text-stone-900 hover:bg-stone-100 hover:scale-105 transition-transform">
                  <CalendarCheck2 className="h-5 w-5 text-emerald-600" />
                  {content.primaryCtaText}
                </Button>
              </Link>
            )}

            {phone && (
              isEditor ? (
                <Button size="lg" variant="outline" className="bg-white/15 hover:bg-white/25 border-white/30 text-white gap-2 font-semibold">
                  <Phone className="h-4 w-4" />
                  {content.secondaryCtaText}: {phone}
                </Button>
              ) : (
                <a href={secondaryCtaUrl}>
                  <Button size="lg" variant="outline" className="bg-white/15 hover:bg-white/25 border-white/30 text-white gap-2 font-semibold">
                    <Phone className="h-4 w-4" />
                    {content.secondaryCtaText}
                  </Button>
                </a>
              )
            )}
          </div>
        </div>

        {content.showContactCard && (
          <div className="rounded-2xl bg-white/15 backdrop-blur-md p-6 border border-white/25 space-y-4 w-full md:w-80 shrink-0 text-sm shadow-lg text-white">
            <h3 className="font-bold flex items-center gap-2 border-b border-white/20 pb-2">
              <Clock className="h-4 w-4 text-amber-300" />
              Kontaktné informácie
            </h3>

            {address && (
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-white/80 shrink-0 mt-0.5" />
                <span>{address}</span>
              </div>
            )}

            {phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-white/80 shrink-0" />
                <span>{phone}</span>
              </div>
            )}

            {email && (
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-white/80 shrink-0" />
                <span className="truncate">{email}</span>
              </div>
            )}

            <div className="pt-2 border-t border-white/20 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-xs">Prijímame nových pacientov</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
