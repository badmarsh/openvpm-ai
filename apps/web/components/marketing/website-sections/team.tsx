"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { teamContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";

interface TeamSectionProps {
  content: z.infer<typeof teamContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function TeamSection({ content, contextData }: TeamSectionProps) {
  const staff = contextData?.team || [];

  // Filter staff by allowed roles and visibility override
  const visibleStaff = staff.filter((member) => {
    const override = content.memberOverrides?.[member.id];
    if (override && override.visible === false) return false;
    return content.filterRoles.includes(member.role);
  });

  if (visibleStaff.length === 0 && !contextData) {
    return null;
  }

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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {visibleStaff.map((member) => {
          const override = content.memberOverrides?.[member.id];
          const displayTitle =
            override?.customTitle ||
            (member.role === "veterinarian"
              ? "Veterinárny lekár"
              : member.role === "technician"
              ? "Veterinárny asistent"
              : "Vedenie kliniky");
          const initial = member.name ? member.name.charAt(0).toUpperCase() : "V";

          return (
            <div
              key={member.id}
              className="rounded-2xl border border-border bg-card p-6 text-center space-y-4 shadow-xs hover:border-primary/40 transition-colors"
            >
              <Avatar className="w-20 h-20 mx-auto ring-4 ring-primary/10">
                {member.avatarUrl && (
                  <AvatarImage src={member.avatarUrl} alt={member.name} />
                )}
                <AvatarFallback
                  className="text-2xl font-bold"
                  style={{
                    backgroundColor: "var(--wb-secondary, #f5f5f4)",
                    color: "var(--wb-primary, #0d9488)",
                  }}
                >
                  {initial}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1">
                <h3 className="font-bold text-foreground text-lg">{member.name}</h3>
                <p className="text-xs text-muted-foreground font-medium">{displayTitle}</p>
                {override?.customBio && (
                  <p className="text-xs text-muted-foreground pt-1 line-clamp-2">
                    {override.customBio}
                  </p>
                )}
              </div>

              {content.showCertificationBadge && (
                <div className="pt-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold tracking-wide"
                    style={{
                      borderColor: "var(--wb-primary, #0d9488)",
                      color: "var(--wb-primary, #0d9488)",
                    }}
                  >
                    {content.certificationText}
                  </Badge>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
