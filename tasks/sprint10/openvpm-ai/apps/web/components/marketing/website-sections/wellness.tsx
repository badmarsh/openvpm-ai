"use client";

import { Check, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  wellnessContentSchema,
  BrandKitData,
  WebsitePublicData,
} from "@/lib/marketing/website-builder-types";
import type { z } from "zod";

interface WellnessSectionProps {
  content: z.infer<typeof wellnessContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function WellnessSection({
  content,
  contextData,
  isEditor,
}: WellnessSectionProps) {
  // Use section-authored plans if present, otherwise fallback to clinic's live active wellness plans
  const authoredPlans = content.plans || [];
  const livePlans = (contextData?.wellnessPlans || []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? undefined,
    price: `${p.price} €`,
    billingInterval: p.billingInterval as "monthly" | "annual",
    badge: undefined,
    features: [
      "Pravidelné preventívne prehliadky",
      "Vakcinačný plán v cene",
      "Zľava na dentálnu hygienu",
      "Prednostné termíny",
    ],
  }));

  const displayPlans = authoredPlans.length > 0 ? authoredPlans : livePlans;

  if (displayPlans.length === 0 && !isEditor) {
    return null;
  }

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-1">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Preventívna starostlivosť</span>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
          {content.title}
        </h2>
        {content.subtitle && (
          <p className="text-sm font-medium text-muted-foreground">
            {content.subtitle}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        {displayPlans.map((plan, idx) => {
          const isFeatured = idx === 1 || Boolean(plan.badge);

          return (
            <div
              key={plan.id}
              className={`rounded-3xl border p-6 flex flex-col justify-between transition-all duration-200 shadow-xs ${
                isFeatured
                  ? "border-primary/50 shadow-md ring-1 ring-primary/20 bg-card"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                  {plan.badge ? (
                    <Badge variant="default" className="text-[10px] font-semibold">
                      {plan.badge}
                    </Badge>
                  ) : isFeatured ? (
                    <Badge variant="secondary" className="text-[10px] font-medium">
                      Najobľúbenejší
                    </Badge>
                  ) : null}
                </div>

                {plan.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {plan.description}
                  </p>
                )}

                {content.showPrice && (
                  <div className="pt-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold tracking-tight text-foreground">
                        {plan.price}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        / {plan.billingInterval === "annual" ? "rok" : "mesiac"}
                      </span>
                    </div>
                  </div>
                )}

                {plan.features && plan.features.length > 0 && (
                  <div className="pt-4 border-t border-border space-y-2.5">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Čo program zahŕňa:
                    </p>
                    <ul className="space-y-2">
                      {plan.features.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="pt-6 mt-6 border-t border-border">
                <Button
                  className="w-full font-bold shadow-xs"
                  variant={isFeatured ? "default" : "outline"}
                  onClick={() => {
                    if (isEditor) return;
                    const contactSection = document.getElementById("sec-contact_form");
                    if (contactSection) {
                      contactSection.scrollIntoView({ behavior: "smooth" });
                    } else {
                      window.location.href = `tel:${contextData?.practice?.phone || ""}`;
                    }
                  }}
                >
                  <ShieldCheck className="h-4 w-4 mr-1.5" />
                  {content.ctaText || "Mám záujem"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
