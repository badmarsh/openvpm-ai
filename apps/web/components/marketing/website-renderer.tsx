"use client";

import React, { useMemo } from "react";
import { SECTION_COMPONENTS } from "./website-sections";
import type {
  WebsiteSection,
  BrandKitData,
  WebsitePublicData,
} from "@/lib/marketing/website-builder-types";

/**
 * Calculates a readable contrast text color (dark charcoal or crisp white)
 * given any arbitrary background hex color.
 */
export function getContrastTextColor(hexColor: string): string {
  if (!hexColor || !hexColor.startsWith("#") || hexColor.length < 7) {
    return "#ffffff";
  }

  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // Perceptive luminance formula (ITU-R BT.709 / sRGB)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0f172a" : "#ffffff";
}

interface WebsiteRendererProps {
  sections: WebsiteSection[];
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
  onEditSection?: (sectionId: string) => void;
  renderSectionWrapper?: (
    section: WebsiteSection,
    children: React.ReactNode,
    index: number
  ) => React.ReactNode;
}

export function WebsiteRenderer({
  sections,
  brandKit,
  contextData,
  isEditor = false,
  renderSectionWrapper,
}: WebsiteRendererProps) {
  const brandColor = brandKit?.brandColor || "#0d9488";
  const secondaryColor = brandKit?.secondaryColor || "#f5f5f4";
  const onPrimaryColor = useMemo(() => getContrastTextColor(brandColor), [brandColor]);

  // Sort sections by order
  const sortedSections = useMemo(() => {
    return [...sections].sort((a, b) => a.order - b.order);
  }, [sections]);

  // In public view, omit hidden sections
  const displaySections = useMemo(() => {
    return isEditor ? sortedSections : sortedSections.filter((s) => s.visible !== false);
  }, [sortedSections, isEditor]);

  const practice = contextData?.practice;
  const clinicName = practice?.name || brandKit?.clinicName || "Veterinárna ambulancia";

  return (
    <div
      className="website-builder-root min-h-screen bg-background text-foreground flex flex-col transition-colors selection:bg-primary/20"
      style={
        {
          "--wb-primary": brandColor,
          "--wb-secondary": secondaryColor,
          "--wb-on-primary": onPrimaryColor,
        } as React.CSSProperties
      }
    >
      <div className="flex-1">
        {displaySections.map((section, index) => {
          const Component = SECTION_COMPONENTS[section.type];
          if (!Component) return null;

          const renderedComponent = (
            <Component
              key={section.id}
              content={section.content}
              brandKit={brandKit}
              contextData={contextData}
              isEditor={isEditor}
            />
          );

          if (renderSectionWrapper) {
            return (
              <React.Fragment key={section.id}>
                {renderSectionWrapper(section, renderedComponent, index)}
              </React.Fragment>
            );
          }

          return (
            <div key={section.id} data-section-type={section.type}>
              {renderedComponent}
            </div>
          );
        })}
      </div>

      {/* Global Public Footer */}
      <footer className="border-t border-border bg-muted/30 py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground space-y-2 mt-auto">
        <p className="font-semibold text-foreground">{clinicName}</p>
        <p>
          {practice?.address && `${practice.address} · `}
          {practice?.phone && `Tel: ${practice.phone}`}
        </p>
        <p className="text-[11px] text-muted-foreground/70 pt-2">
          Poháňané systémom <span className="font-bold text-foreground">OpenVPM AI</span> · Veterinárna klinická správa & marketing
        </p>
      </footer>
    </div>
  );
}
