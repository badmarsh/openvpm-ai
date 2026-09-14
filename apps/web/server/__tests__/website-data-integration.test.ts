import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  websiteSectionSchema,
  wellnessContentSchema,
  statsContentSchema,
  type WebsitePublicData,
} from "@/lib/marketing/website-builder-types";
import { createDefaultSection } from "@/lib/marketing/website-seed";
import enMessages from "@/messages/en.json";
import skMessages from "@/messages/sk.json";

describe("Website Data Integration Contracts & Guardrails", () => {
  describe("Wellness Section Type & Schema", () => {
    it("creates a valid default wellness section with default plans", () => {
      const section = createDefaultSection("wellness", 2);
      expect(section.type).toBe("wellness");
      expect(section.order).toBe(2);

      const parsed = websiteSectionSchema.safeParse(section);
      expect(parsed.success).toBe(true);

      if (parsed.success && parsed.data.type === "wellness") {
        expect(parsed.data.content.plans.length).toBeGreaterThan(0);
        expect(parsed.data.content.showPrice).toBe(true);
        expect(parsed.data.content.plans[0].billingInterval).toBe("monthly");
      }
    });

    it("validates custom wellness plan structures strictly", () => {
      const validContent = {
        title: "Zdravotné balíky",
        subtitle: "Pre vašich miláčikov",
        showPrice: true,
        ctaText: "Mám záujem",
        plans: [
          {
            id: "plan-senior",
            name: "Senior Dog Care",
            description: "Komplexná starostlivosť o staršieho psa",
            price: "35 €",
            billingInterval: "monthly" as const,
            badge: "Populárne",
            features: ["Krvný obraz 2x ročne", "RTG kĺbov", "Zľava na lieky 10%"],
          },
        ],
      };

      const result = wellnessContentSchema.safeParse(validContent);
      expect(result.success).toBe(true);
    });
  });

  describe("Live Data Stats & Source Binding", () => {
    it("supports dynamic source bindings: custom, patients, reviews, years", () => {
      const statsContent = {
        title: "Klinika v číslach",
        items: [
          { id: "st-1", label: "Ošetrených pacientov", value: "0", source: "patients" as const },
          { id: "st-2", label: "5-hviezdičkových recenzií", value: "0", source: "reviews" as const },
          { id: "st-3", label: "Rokov skúseností", value: "0", source: "years" as const },
          { id: "st-4", label: "Lekárov a špecialistov", value: "12", source: "custom" as const },
        ],
      };

      const parsed = statsContentSchema.safeParse(statsContent);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.items[0].source).toBe("patients");
        expect(parsed.data.items[1].source).toBe("reviews");
        expect(parsed.data.items[2].source).toBe("years");
        expect(parsed.data.items[3].source).toBe("custom");
      }
    });
  });

  describe("Public Website Data Integration Interface", () => {
    it("satisfies the enhanced WebsitePublicData shape with liveStats and wellnessPlans", () => {
      const mockPublicData: WebsitePublicData = {
        practice: {
          id: "c-123",
          name: "VetCare Trnava",
          phone: "+421903123456",
          email: "info@vetcare.sk",
          address: "Hlavná 1, Trnava",
        },
        isPublished: true,
        brandKit: {
          brandColor: "#0d9488",
          secondaryColor: "#f5f5f4",
          disclaimer: "Klinika vyhradzuje právo na zmenu cien.",
        },
        team: [
          {
            id: "u-1",
            name: "MVDr. Peter Novák",
            role: "veterinarian",
            avatarUrl: "https://example.com/avatar.jpg",
          },
        ],
        reviews: [],
        handouts: [],
        liveStats: {
          patientCount: 1450,
          fiveStarReviewCount: 89,
          yearsInPractice: 12,
        },
        liveServices: [
          {
            id: "s-1",
            name: "Všeobecná prehliadka",
            defaultPrice: "25 €",
            category: "Preventíva",
          },
        ],
        wellnessPlans: [
          {
            id: "wp-1",
            name: "Preventívny balík Šteňa",
            description: "Pre šteňatá do 12 mesiacov",
            price: "20 €",
            billingInterval: "monthly",
          },
        ],
      };

      expect(mockPublicData.liveStats?.patientCount).toBe(1450);
      expect(mockPublicData.liveStats?.fiveStarReviewCount).toBe(89);
      expect(mockPublicData.liveStats?.yearsInPractice).toBe(12);
      expect(mockPublicData.team?.[0]?.avatarUrl).toBeTruthy();
      expect(mockPublicData.wellnessPlans).toHaveLength(1);
      expect(mockPublicData.liveServices).toHaveLength(1);
    });
  });

  describe("Website Inquiries & Contact Form Contracts", () => {
    const contactFormInputSchema = z.object({
      clinicId: z.string().min(1),
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional(),
      message: z.string().min(5),
    });

    it("accepts valid contact form submissions", () => {
      const valid = {
        clinicId: "clin-001",
        name: "Ján Chovateľ",
        email: "jan.chovatel@gmail.com",
        phone: "+421 905 111 222",
        message: "Dobrý deň, chcem sa informovať o voľnom termíne na vakcináciu psa.",
      };
      const result = contactFormInputSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects invalid contact form inputs", () => {
      const invalidEmail = {
        clinicId: "clin-001",
        name: "J",
        email: "not-an-email",
        message: "Hi",
      };
      const result = contactFormInputSchema.safeParse(invalidEmail);
      expect(result.success).toBe(false);
    });

    const inquiryStatusSchema = z.object({
      id: z.string().uuid(),
      status: z.enum(["new", "in_progress", "resolved", "archived"]),
    });

    it("validates inquiry status transitions", () => {
      const input = {
        id: "a0000000-0000-0000-0000-000000000001",
        status: "resolved" as const,
      };
      const result = inquiryStatusSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("Website Action Analytics Contract", () => {
    const trackActionSchema = z.object({
      clinicId: z.string(),
      action: z.enum(["booking_cta_click", "phone_call_click", "review_click", "handout_view"]),
      metadata: z.record(z.any()).optional(),
    });

    it("accepts valid tracking events", () => {
      const event = {
        clinicId: "clin-001",
        action: "booking_cta_click" as const,
        metadata: { sourceSection: "hero", targetUrl: "https://booking.example.com" },
      };
      const result = trackActionSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe("Strict i18n Symmetry for Marketing Website", () => {
    it("has identical website dictionary keys in both en and sk", () => {
      const enWebsite = (enMessages as any).marketing?.website;
      const skWebsite = (skMessages as any).marketing?.website;

      expect(enWebsite).toBeDefined();
      expect(skWebsite).toBeDefined();

      function getDeepKeys(obj: any, prefix = ""): string[] {
        let keys: string[] = [];
        for (const k of Object.keys(obj)) {
          const path = prefix ? `${prefix}.${k}` : k;
          if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
            keys = keys.concat(getDeepKeys(obj[k], path));
          } else {
            keys.push(path);
          }
        }
        return keys.sort();
      }

      const enKeys = getDeepKeys(enWebsite);
      const skKeys = getDeepKeys(skWebsite);

      expect(enKeys).toEqual(skKeys);
      expect(enKeys.length).toBeGreaterThanOrEqual(30);
    });
  });
});
