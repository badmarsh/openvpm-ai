"use client";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import type { videoEmbedContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";

function getEmbedUrl(url: string): string | null {
  try {
    if (!url) return null;
    // YouTube
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0`;
    }
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
    if (vimeoMatch && vimeoMatch[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return null;
  } catch {
    return null;
  }
}

interface VideoEmbedSectionProps {
  content: z.infer<typeof videoEmbedContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function VideoEmbedSection({ content }: VideoEmbedSectionProps) {
  const embedUrl = getEmbedUrl(content.videoUrl);
  const ratio = content.aspectRatio === "4:3" ? 4 / 3 : 16 / 9;

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8">
      {(content.title || content.subtitle) && (
        <div className="text-center space-y-2">
          {content.title && (
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
              {content.title}
            </h2>
          )}
          {content.subtitle && (
            <p className="text-sm font-medium text-muted-foreground">
              {content.subtitle}
            </p>
          )}
        </div>
      )}

      <div className="rounded-3xl overflow-hidden border border-border bg-black shadow-lg">
        {embedUrl ? (
          <AspectRatio ratio={ratio}>
            <iframe
              src={embedUrl}
              title={content.title || "Video o klinike"}
              className="w-full h-full border-0"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </AspectRatio>
        ) : (
          <div className="p-12 text-center text-white/60 text-sm">
            Zadajte platnú YouTube alebo Vimeo webovú adresu videa.
          </div>
        )}
      </div>

      {content.caption && (
        <p className="text-xs text-center text-muted-foreground italic">
          {content.caption}
        </p>
      )}
    </section>
  );
}
