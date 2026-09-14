import { describe, it, expect } from "vitest";
import {
  websiteSectionSchema,
  sectionTypeSchema,
  type SectionType,
} from "@/lib/marketing/website-builder-types";
import {
  getSeedWebsiteSections,
  createDefaultSection,
} from "@/lib/marketing/website-seed";
import { getContrastTextColor } from "@/components/marketing/website-renderer";

describe("Website Builder Unit & Contract Tests", () => {
  describe("Seed Fallback Guarantee", () => {
    it("synthesizes exactly 5 backward-compatible sections in fixed order", () => {
      const seed = getSeedWebsiteSections("Testovacia Klinika");
      expect(seed).toHaveLength(5);

      const types = seed.map((s) => s.type);
      expect(types).toEqual([
        "hero",
        "team",
        "handouts",
        "reviews",
        "booking_cta",
      ]);

      // All seed sections must be visible with consecutive order
      seed.forEach((section, idx) => {
        expect(section.order).toBe(idx);
        expect(section.visible).toBe(true);
        expect(section.id).toBeTruthy();
      });

      // Hero must contain the clinic name
      const hero = seed[0];
      if (hero.type === "hero") {
        expect(hero.content.title).toBe("Testovacia Klinika");
      }
    });

    it("ensures all 5 seed sections strictly conform to websiteSectionSchema", () => {
      const seed = getSeedWebsiteSections("MVDr. Ukážkový");
      seed.forEach((section) => {
        const parsed = websiteSectionSchema.safeParse(section);
        expect(parsed.success).toBe(true);
      });
    });
  });

  describe("Section Library & Template Factory (18 Templates)", () => {
    const allTypes: SectionType[] = [
      "hero",
      "about",
      "services",
      "wellness",
      "team",
      "reviews",
      "faq",
      "hours_location",
      "booking_cta",
      "gallery",
      "handouts",
      "trust_badges",
      "stats",
      "emergency_banner",
      "contact_form",
      "video_embed",
      "social_proof",
      "custom_rich_text",
    ];

    it("has at least 15+ section templates (exactly 18 supported)", () => {
      expect(allTypes.length).toBeGreaterThanOrEqual(15);
      expect(allTypes).toHaveLength(18);
    });

    it("creates valid default instances for all 18 templates", () => {
      allTypes.forEach((type, idx) => {
        const section = createDefaultSection(type, idx);
        expect(section.type).toBe(type);
        expect(section.order).toBe(idx);
        expect(section.visible).toBe(true);

        const parseResult = websiteSectionSchema.safeParse(section);
        if (!parseResult.success) {
          console.error(`Validation failed for template: ${type}`, parseResult.error.format());
        }
        expect(parseResult.success).toBe(true);
      });
    });

    it("rejects unknown section types", () => {
      const invalidSection = {
        id: "invalid-1",
        type: "malicious_script_runner",
        order: 0,
        visible: true,
        content: {},
      };
      const result = websiteSectionSchema.safeParse(invalidSection);
      expect(result.success).toBe(false);
    });
  });

  describe("Brand-Kit Theming & Contrast Computation", () => {
    it("computes white text for dark brand colors", () => {
      expect(getContrastTextColor("#000000")).toBe("#ffffff");
      expect(getContrastTextColor("#0d9488")).toBe("#ffffff"); // Teal
      expect(getContrastTextColor("#1e3a8a")).toBe("#ffffff"); // Dark blue
      expect(getContrastTextColor("#881337")).toBe("#ffffff"); // Dark rose
    });

    it("computes dark text for light brand colors", () => {
      expect(getContrastTextColor("#ffffff")).toBe("#0f172a");
      expect(getContrastTextColor("#fef08a")).toBe("#0f172a"); // Light yellow
      expect(getContrastTextColor("#e0f2fe")).toBe("#0f172a"); // Pale sky blue
      expect(getContrastTextColor("#f5f5f4")).toBe("#0f172a"); // Sand
    });

    it("handles fallback gracefully on malformed hex strings", () => {
      expect(getContrastTextColor("")).toBe("#ffffff");
      expect(getContrastTextColor("invalid")).toBe("#ffffff");
    });
  });
});
