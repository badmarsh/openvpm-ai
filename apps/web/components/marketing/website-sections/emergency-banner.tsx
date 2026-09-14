"use client";

import { useState } from "react";
import { AlertCircle, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { emergencyBannerContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";

interface EmergencyBannerSectionProps {
  content: z.infer<typeof emergencyBannerContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function EmergencyBannerSection({ content, contextData, isEditor }: EmergencyBannerSectionProps) {
  const [dismissed, setDismissed] = useState(false);
  const phone =
    (content.phone && content.phone !== "+421 900 123 456" ? content.phone : null) ||
    contextData?.practice?.phone ||
    content.phone ||
    "+421 900 123 456";

  if (dismissed && !isEditor) {
    return null;
  }

  return (
    <div
      className="relative px-4 py-3.5 border-b shadow-xs transition-all text-foreground"
      style={{
        backgroundColor: "var(--wb-secondary, #f5f5f4)",
        borderColor: "var(--wb-primary, #0d9488)",
      }}
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs"
            style={{
              backgroundColor: "var(--wb-primary, #0d9488)",
              color: "var(--wb-on-primary, #ffffff)",
            }}
          >
            <AlertCircle className="h-4 w-4 animate-pulse" />
          </div>

          <div>
            <span className="font-extrabold text-sm block sm:inline mr-2 text-foreground">
              {content.alertText}
            </span>
            <span className="text-xs text-muted-foreground">
              {content.subtext}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isEditor ? (
            <Button
              size="sm"
              className="gap-2 font-bold text-white shadow-xs"
              style={{ backgroundColor: "var(--wb-primary, #0d9488)" }}
            >
              <Phone className="h-3.5 w-3.5" />
              {phone}
            </Button>
          ) : (
            <a href={`tel:${phone}`}>
              <Button
                size="sm"
                className="gap-2 font-bold text-white shadow-xs hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "var(--wb-primary, #0d9488)" }}
              >
                <Phone className="h-3.5 w-3.5" />
                {phone}
              </Button>
            </a>
          )}

          {content.dismissible && !isEditor && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5"
              aria-label="Zatvoriť upozornenie"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
