"use client";

import { useState } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { reviewsContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";

interface ReviewsSectionProps {
  content: z.infer<typeof reviewsContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function ReviewsSection({ content, contextData }: ReviewsSectionProps) {
  const allReviews = contextData?.reviews || [];
  const [carouselIndex, setCarouselIndex] = useState(0);

  const filteredReviews = allReviews
    .filter((r) => (r.rating ?? 5) >= content.minRating)
    .slice(0, content.maxCount);

  if (filteredReviews.length === 0 && !contextData) {
    return null;
  }

  const isCarousel = content.layout === "carousel" && filteredReviews.length > 2;

  const nextReview = () => {
    setCarouselIndex((prev) => (prev + 1) % filteredReviews.length);
  };

  const prevReview = () => {
    setCarouselIndex((prev) => (prev - 1 + filteredReviews.length) % filteredReviews.length);
  };

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

      {isCarousel ? (
        <div className="relative max-w-2xl mx-auto">
          <div className="rounded-2xl border border-border bg-card p-8 space-y-4 shadow-sm text-center">
            <div className="flex items-center justify-center gap-1 text-amber-500">
              {Array.from({ length: filteredReviews[carouselIndex]?.rating ?? 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-amber-500" />
              ))}
            </div>

            <p className="text-base text-foreground italic leading-relaxed">
              "{filteredReviews[carouselIndex]?.reviewText}"
            </p>

            <div className="pt-4 border-t border-border flex flex-col items-center gap-1 text-xs text-muted-foreground">
              <span className="font-bold text-foreground text-sm">
                {filteredReviews[carouselIndex]?.reviewerName || "Overený chovateľ"}
              </span>
              <span className="uppercase tracking-wider text-[10px]">
                {filteredReviews[carouselIndex]?.platform || "Google Recenzia"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mt-6">
            <Button variant="outline" size="icon" onClick={prevReview} aria-label="Predchádzajúca recenzia">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-semibold text-muted-foreground">
              {carouselIndex + 1} / {filteredReviews.length}
            </span>
            <Button variant="outline" size="icon" onClick={nextReview} aria-label="Nasledujúca recenzia">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredReviews.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: r.rating ?? 5 }).map((_, idx) => (
                    <Star key={idx} className="h-4 w-4 fill-amber-500" />
                  ))}
                </div>
                {content.showPlatformBadge && (
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {r.platform || "Google"}
                  </span>
                )}
              </div>

              <p className="text-sm text-foreground italic leading-relaxed">
                "{r.reviewText}"
              </p>

              <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {r.reviewerName || "Overený chovateľ"}
                </span>
                {r.receivedAt && (
                  <span>{new Date(r.receivedAt).toLocaleDateString("sk-SK")}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
