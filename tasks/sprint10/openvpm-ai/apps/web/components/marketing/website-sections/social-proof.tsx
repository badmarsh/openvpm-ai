"use client";

import { Instagram, Facebook, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { socialProofContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";

interface SocialProofSectionProps {
  content: z.infer<typeof socialProofContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function SocialProofSection({ content, brandKit }: SocialProofSectionProps) {
  const handles = brandKit?.socialHandles || {};
  const instagram = handles.instagram || "klinika";
  const facebook = handles.facebook || "klinika";
  const tiktok = handles.tiktok || "klinika";

  const platforms = [
    content.showInstagram && {
      name: "Instagram",
      handle: `@${instagram.replace(/^@/, "")}`,
      url: `https://instagram.com/${instagram.replace(/^@/, "")}`,
      icon: Instagram,
      color: "hover:text-pink-500",
    },
    content.showFacebook && {
      name: "Facebook",
      handle: facebook.startsWith("http") ? "Facebook Stránka" : facebook,
      url: facebook.startsWith("http") ? facebook : `https://facebook.com/${facebook}`,
      icon: Facebook,
      color: "hover:text-blue-600",
    },
    content.showTiktok && {
      name: "TikTok",
      handle: `@${tiktok.replace(/^@/, "")}`,
      url: `https://tiktok.com/@${tiktok.replace(/^@/, "")}`,
      icon: Share2,
      color: "hover:text-cyan-500",
    },
  ].filter(Boolean) as Array<{
    name: string;
    handle: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }>;

  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-xs text-center space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
            {content.title}
          </h2>
          {content.subtitle && (
            <p className="text-sm text-muted-foreground">
              {content.subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          {platforms.map((p, idx) => {
            const Icon = p.icon;
            return (
              <a
                key={idx}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl border border-border bg-muted/30 hover:bg-muted/60 transition-all hover:scale-105 shadow-2xs group"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                  style={{ backgroundColor: "var(--wb-primary, #0d9488)" }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium">
                    {p.handle}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
