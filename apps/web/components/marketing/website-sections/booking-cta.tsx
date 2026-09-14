"use client";

import Link from "next/link";
import { CalendarCheck2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { bookingCtaContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";

interface BookingCtaSectionProps {
  content: z.infer<typeof bookingCtaContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function BookingCtaSection({ content, contextData, isEditor }: BookingCtaSectionProps) {
  const practice = contextData?.practice;
  const bookingSlug = contextData?.bookingSlug;
  const bookingUrl = bookingSlug
    ? `/book/${bookingSlug}?utm_source=klinika_web&utm_medium=site`
    : practice?.id
    ? `/book/${practice.id}?utm_source=klinika_web&utm_medium=site`
    : "#book";
  const phone = practice?.phone;

  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div
        className="rounded-3xl border p-8 md:p-12 text-center space-y-6 shadow-sm"
        style={{
          backgroundColor: "var(--wb-secondary, #f5f5f4)",
          borderColor: "var(--wb-primary, #0d9488)",
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-md"
          style={{
            backgroundColor: "var(--wb-primary, #0d9488)",
            color: "var(--wb-on-primary, #ffffff)",
          }}
        >
          <CalendarCheck2 className="h-7 w-7" />
        </div>

        <div className="max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {content.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {content.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {isEditor ? (
            <Button
              size="lg"
              className="gap-2 font-bold shadow-md text-white"
              style={{
                backgroundColor: "var(--wb-primary, #0d9488)",
              }}
            >
              <CalendarCheck2 className="h-5 w-5" />
              {content.buttonText}
            </Button>
          ) : (
            <Link href={bookingUrl}>
              <Button
                size="lg"
                className="gap-2 font-bold shadow-md hover:scale-105 transition-transform text-white"
                style={{
                  backgroundColor: "var(--wb-primary, #0d9488)",
                }}
              >
                <CalendarCheck2 className="h-5 w-5" />
                {content.buttonText}
              </Button>
            </Link>
          )}

          {content.showPhoneButton && phone && (
            isEditor ? (
              <Button size="lg" variant="outline" className="gap-2 font-semibold">
                <Phone className="h-4 w-4" />
                {content.phoneButtonText}
              </Button>
            ) : (
              <a href={`tel:${phone}`}>
                <Button size="lg" variant="outline" className="gap-2 font-semibold hover:bg-background/80">
                  <Phone className="h-4 w-4" />
                  {content.phoneButtonText}
                </Button>
              </a>
            )
          )}
        </div>
      </div>
    </section>
  );
}
