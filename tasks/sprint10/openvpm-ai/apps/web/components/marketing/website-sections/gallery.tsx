"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { galleryContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";
import { cn } from "@/lib/utils";

interface GallerySectionProps {
  content: z.infer<typeof galleryContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function GallerySection({ content }: GallerySectionProps) {
  const images = content.images || [];
  const [carouselIndex, setCarouselIndex] = useState(0);

  const colClass =
    content.columns === "2"
      ? "grid-cols-1 sm:grid-cols-2"
      : content.columns === "4"
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

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

      {images.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground space-y-2">
          <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <p className="text-sm font-medium">Galéria je zatiaľ prázdna.</p>
          <p className="text-xs text-muted-foreground">
            Otvorte nastavenia sekcie a vyberte fotografie z mediálnej knižnice.
          </p>
        </div>
      ) : content.layout === "carousel" ? (
        <div className="relative max-w-3xl mx-auto space-y-4">
          <div className="rounded-3xl overflow-hidden border border-border bg-black aspect-[16/9] shadow-md relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[carouselIndex]?.url}
              alt={images[carouselIndex]?.altText || "Foto z kliniky"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {images[carouselIndex]?.caption && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white text-xs font-medium">
                {images[carouselIndex]?.caption}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {carouselIndex + 1} z {images.length} fotografií
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCarouselIndex((prev) => (prev - 1 + images.length) % images.length)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Dozadu
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCarouselIndex((prev) => (prev + 1) % images.length)}
              >
                Dopredu
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn("grid gap-4", colClass)}>
          {images.map((img, idx) => (
            <div
              key={idx}
              className="group relative rounded-2xl overflow-hidden border border-border aspect-[4/3] bg-muted shadow-xs hover:shadow-md transition-shadow"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.altText || "Foto"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              {img.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-xs p-2.5 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                  {img.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
