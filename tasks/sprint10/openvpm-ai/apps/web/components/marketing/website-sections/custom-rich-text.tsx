"use client";

import { SafeMarkdown } from "./safe-markdown";
import type { customRichTextContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";
import { cn } from "@/lib/utils";

interface CustomRichTextSectionProps {
  content: z.infer<typeof customRichTextContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function CustomRichTextSection({ content }: CustomRichTextSectionProps) {
  const maxWClass =
    content.maxWidth === "narrow"
      ? "max-w-2xl"
      : content.maxWidth === "full"
      ? "max-w-6xl"
      : "max-w-4xl";

  const alignClass =
    content.alignment === "center"
      ? "text-center mx-auto"
      : "text-left";

  return (
    <section className={cn("py-12 px-4 sm:px-6 lg:px-8 mx-auto space-y-6", maxWClass)}>
      {content.title && (
        <h2 className={cn("text-3xl font-extrabold tracking-tight text-foreground", alignClass)}>
          {content.title}
        </h2>
      )}

      <div className={cn("rounded-2xl border border-border/80 bg-card p-6 md:p-8 shadow-xs", alignClass)}>
        <SafeMarkdown content={content.content} />
      </div>
    </section>
  );
}
