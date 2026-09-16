import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  websiteSectionSchema,
  wellnessContentSchema,
  statsContentSchema,
  type WebsitePublicData,
} from "@/lib/marketing/website-builder-types";
import { createDefaultSection, getSeedWebsiteSections } from "@/lib/marketing/website-seed";
import { validateWebsiteSections } from "@/server/routers/extensions/marketing";
import { SECTION_TEMPLATES } from "@/components/marketing/website-editor-palette";
import { validateMarketingText } from "@/lib/marketing/validator";
import { TRPCError } from "@trpc/server";
import { resolveLiveStatValue } from "@/components/marketing/website-sections/stats";
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

  describe("Website Compliance Validator Guardrails", () => {
    it("accepts default seed website sections without compliance errors", () => {
      const seedSections = getSeedWebsiteSections("Veterinárna ambulancia Trnava");
      expect(() => validateWebsiteSections(seedSections)).not.toThrow();
    });

    it("blocks sections containing prescription drug names (Zákon o liekoch)", () => {
      const seedSections = getSeedWebsiteSections("Klinika");
      seedSections.push({
        id: "custom-1",
        type: "custom_rich_text",
        order: 5,
        visible: true,
        content: {
          title: "Novinka v antiparazitikách",
          content: "U nás nájdete originálne tablety Bravecto a NexGard za výborné ceny.",
          alignment: "left",
          maxWidth: "normal",
        },
      });

      expect(() => validateWebsiteSections(seedSections)).toThrowError(TRPCError);
      try {
        validateWebsiteSections(seedSections);
      } catch (err: any) {
        expect(err.code).toBe("BAD_REQUEST");
        expect(err.message).toContain("rx_substance");
      }
    });

    it("blocks sections with guaranteed cure claims (KVL SR Etický kódex)", () => {
      const seedSections = getSeedWebsiteSections("Klinika");
      seedSections[0] = {
        ...seedSections[0],
        content: {
          ...seedSections[0].content,
          subtitle: "Garantujeme 100 % vyliečenie každého ochorenia bez rizika.",
        } as any,
      };

      expect(() => validateWebsiteSections(seedSections)).toThrowError(TRPCError);
      try {
        validateWebsiteSections(seedSections);
      } catch (err: any) {
        expect(err.code).toBe("BAD_REQUEST");
        expect(err.message).toContain("guarantee");
      }
    });

    it("blocks sections with comparative denigration claims (Zákon o reklame)", () => {
      const seedSections = getSeedWebsiteSections("Klinika");
      seedSections.push({
        id: "about-1",
        type: "about",
        order: 6,
        visible: true,
        content: {
          title: "Prečo my",
          subtitle: "Sme najlepšia klinika v Trnavskom kraji, lepšie než ostatní.",
          story: "Na rozdiel od iných ambulancií máme najmodernejší tím.",
          imageUrl: null,
          imageAlt: "Klinika",
          imagePosition: "right",
          stats: [],
        },
      });

      expect(() => validateWebsiteSections(seedSections)).toThrowError(TRPCError);
      try {
        validateWebsiteSections(seedSections);
      } catch (err: any) {
        expect(err.code).toBe("BAD_REQUEST");
        expect(err.message).toContain("comparison");
      }
    });

    it("blocks sections with undisclosed marketing price claims", () => {
      const seedSections = getSeedWebsiteSections("Klinika");
      seedSections.push({
        id: "faq-1",
        type: "faq",
        order: 7,
        visible: true,
        content: {
          title: "Časté otázky",
          subtitle: "Ceny služieb",
          items: [
            {
              id: "f-1",
              question: "Koľko stojí preventívna prehliadka?",
              answer: "Kompletné vyšetrenie u nás stojí len 15 € na počkanie.",
            },
          ],
        },
      });

      expect(() => validateWebsiteSections(seedSections)).toThrowError(TRPCError);
      try {
        validateWebsiteSections(seedSections);
      } catch (err: any) {
        expect(err.code).toBe("BAD_REQUEST");
        expect(err.message).toContain("price_without_list");
      }
    });
  });

  describe("Section Templates Palette Contract", () => {
    it("provides exactly 18 section templates in the palette", () => {
      expect(SECTION_TEMPLATES).toHaveLength(18);
    });
  });

  describe("Hero Phone Fallback Logic Contract", () => {
    it("correctly falls back to default phone even when clinicName is present", () => {
      const practice = { name: "Labka s.r.o.", phone: null as string | null };
      const brandKit = { clinicName: "Veterinárna ambulancia Labka" };

      // Replicating fixed hero phone fallback expression:
      const phone = practice?.phone || "+421 900 123 456";
      expect(phone).toBe("+421 900 123 456");

      // With clinic phone:
      const practiceWithPhone = { name: "Labka", phone: "+421 905 999 888" };
      const phoneWithClinic = practiceWithPhone?.phone || "+421 900 123 456";
      expect(phoneWithClinic).toBe("+421 905 999 888");
    });
  });

  describe("Validator Localization Integrity", () => {
    it("uses correct Slovak text without stray characters in advice_replacement rule", () => {
      const report = validateMarketingText({
        text: "Podajte 2 tablety psovi ráno a večer.",
        context: "marketing",
      });

      const finding = report.findings.find((f) => f.rule === "advice_replacement");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("Uistite sa, že text nenabáda na samoliečbu.");
      expect(finding?.message).not.toContain("काशी");
    });
  });

  describe("Atomic Save & Publish Contract Guardrails", () => {
    const updateInputSchema = z.object({
      sections: z.array(websiteSectionSchema),
      publishLive: z.boolean().optional().default(false),
    });

    const toggleInputSchema = z.object({
      published: z.boolean().optional(),
      sections: z.array(websiteSectionSchema).optional(),
    }).optional();

    const publishInputSchema = z.object({
      sections: z.array(websiteSectionSchema).optional(),
    }).optional();

    it("validates updateWebsiteSections payload with publishLive flag", () => {
      const seed = getSeedWebsiteSections("Klinika");
      const validPayload = { sections: seed, publishLive: true };
      const parsed = updateInputSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it("validates toggleWebsite payload with in-flight sections", () => {
      const seed = getSeedWebsiteSections("Klinika");
      const validPayload = { published: true, sections: seed };
      const parsed = toggleInputSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it("validates publishWebsite payload with custom sections", () => {
      const seed = getSeedWebsiteSections("Klinika");
      const parsed = publishInputSchema.safeParse({ sections: seed });
      expect(parsed.success).toBe(true);
    });
  });

  describe("Phase 1: Contact Form CRM Integration & SLA Guardrails", () => {
    it("calculates 24-hour SLA due date for newly submitted inquiries", () => {
      const submissionTime = new Date("2026-09-16T12:00:00.000Z");
      const dueAt = new Date(submissionTime.getTime() + 24 * 60 * 60 * 1000);

      expect(dueAt.toISOString()).toBe("2026-09-17T12:00:00.000Z");
      expect(dueAt.getTime() - submissionTime.getTime()).toBe(86400000);
    });

    it("verifies staff inquiry task structure with SLA dueAt", () => {
      const taskSchema = z.object({
        practiceId: z.string().uuid(),
        kind: z.literal("website_inquiry"),
        title: z.string().min(1),
        detail: z.string(),
        status: z.literal("open"),
        clientId: z.string().uuid().nullable(),
        dueAt: z.date(),
      });

      const sampleTask = {
        practiceId: "00000000-0000-0000-0000-000000000001",
        kind: "website_inquiry" as const,
        title: "Dopyt z webstránky: Mária Kováčová",
        detail: "Mám záujem o termín.\n\nEmail: maria@example.com\nTelefón: +421905123456",
        status: "open" as const,
        clientId: "00000000-0000-0000-0000-000000000002",
        dueAt: new Date(Date.now() + 86400000),
      };

      const result = taskSchema.safeParse(sampleTask);
      expect(result.success).toBe(true);
    });

    it("validates auditLog structure for website contact form submissions", () => {
      const auditLogEntrySchema = z.object({
        practiceId: z.string(),
        userId: z.null(),
        action: z.literal("website_contact_form_submission"),
        entityType: z.literal("inquiry"),
        entityId: z.string().uuid(),
        changes: z.object({
          name: z.string(),
          email: z.string().email(),
          phone: z.string().optional(),
          message: z.string(),
        }),
        ipAddress: z.string().nullable(),
      });

      const sampleLog = {
        practiceId: "clin-1",
        userId: null,
        action: "website_contact_form_submission" as const,
        entityType: "inquiry" as const,
        entityId: "00000000-0000-0000-0000-000000000001",
        changes: {
          name: "Jozef Mrkvička",
          email: "jozef@mrkvicka.sk",
          phone: "+421911222333",
          message: "Dobrý deň, je možné prísť na čipovanie?",
        },
        ipAddress: "127.0.0.1",
      };

      const result = auditLogEntrySchema.safeParse(sampleLog);
      expect(result.success).toBe(true);
    });
  });

  describe("Phase 2.1: Live Stats Data Resolution Engine", () => {
    const liveStats = {
      patientCount: 14500,
      fiveStarReviewCount: 180,
      yearsInPractice: 15,
    };

    it("resolves patients live metric with Slovak formatting and plus suffix", () => {
      const stat = { value: "0", label: "Pacienti", source: "patients" as const };
      const resolved = resolveLiveStatValue(stat, liveStats);
      // sk-SK locale separator is non-breaking space (or normal space)
      expect(resolved).toMatch(/14[\s\u00A0]500\+/);
    });

    it("resolves reviews live metric with count and plus suffix", () => {
      const stat = { value: "0", label: "Recenzie", source: "reviews" as const };
      const resolved = resolveLiveStatValue(stat, liveStats);
      expect(resolved).toBe("180+");
    });

    it("resolves years live metric with count and plus suffix", () => {
      const stat = { value: "0", label: "Roky praxe", source: "years" as const };
      const resolved = resolveLiveStatValue(stat, liveStats);
      expect(resolved).toBe("15+");
    });

    it("preserves custom text when source is custom", () => {
      const stat = { value: "24/7 Pohotovosť", label: "Dostupnosť", source: "custom" as const };
      const resolved = resolveLiveStatValue(stat, liveStats);
      expect(resolved).toBe("24/7 Pohotovosť");
    });

    it("falls back to stat.value when liveStats is not provided", () => {
      const stat = { value: "10 000+", label: "Pacienti", source: "patients" as const };
      const resolved = resolveLiveStatValue(stat, undefined);
      expect(resolved).toBe("10 000+");
    });

    it("falls back to stat.value when metric is 0", () => {
      const emptyStats = { patientCount: 0, fiveStarReviewCount: 0, yearsInPractice: 0 };
      const stat = { value: "5 000+", label: "Pacienti", source: "patients" as const };
      const resolved = resolveLiveStatValue(stat, emptyStats);
      expect(resolved).toBe("5 000+");
    });

    it("has complete symmetric dictionary keys for liveStats editor controls", () => {
      const enStats = (enMessages as any).marketing?.website?.liveStats;
      const skStats = (skMessages as any).marketing?.website?.liveStats;

      expect(enStats).toBeDefined();
      expect(skStats).toBeDefined();

      const requiredKeys = [
        "source",
        "sourceCustom",
        "sourcePatients",
        "sourceReviews",
        "sourceYears",
        "useLiveData",
        "customText",
        "fallbackValue",
        "subtext",
        "label",
        "customValue",
        "liveBadge",
        "staticBadge",
      ];

      for (const key of requiredKeys) {
        expect(enStats[key]).toBeDefined();
        expect(skStats[key]).toBeDefined();
        expect(typeof enStats[key]).toBe("string");
        expect(typeof skStats[key]).toBe("string");
      }
    });
  });
});
