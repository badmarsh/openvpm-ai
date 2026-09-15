import { z } from "zod";

// Base section types
export const sectionTypeSchema = z.enum([
  "hero",
  "about",
  "services",
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
  "wellness",
]);

export type SectionType = z.infer<typeof sectionTypeSchema>;

// 1. Hero
export const heroContentSchema = z.object({
  badge: z.string().default("Veterinárna starostlivosť na najvyššej úrovni"),
  title: z.string().default("Moderná veterinárna starostlivosť"),
  subtitle: z.string().default("Poskytujeme komplexnú odbornú diagnostiku, modernú chirurgiu a preventívnu starostlivosť pre vaše zvieratá s dôrazom na bezstresový prístup."),
  primaryCtaText: z.string().default("Objednať sa online"),
  primaryCtaUrl: z.string().default(""),
  secondaryCtaText: z.string().default("Volať na kliniku"),
  secondaryCtaUrl: z.string().default(""),
  backgroundImage: z.string().nullable().default(null),
  overlayGradient: z.boolean().default(true),
  showContactCard: z.boolean().default(true),
});

// 2. About / Story
export const aboutContentSchema = z.object({
  title: z.string().default("O našej klinike"),
  subtitle: z.string().default("Venujeme sa zdraviu zvierat už viac ako 10 rokov"),
  story: z.string().default("Našou prioritou je individuálny prístup ku každému pacientovi a podrobná komunikácia s majiteľom. Vybavenie našej kliniky zahŕňa digitálny RTG, ultrasonografiu, biochemické laboratórium a inhalačnú anestéziu."),
  imageUrl: z.string().nullable().default(null),
  imageAlt: z.string().default("Naša klinika"),
  imagePosition: z.enum(["left", "right"]).default("right"),
  stats: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })).default([
    { value: "12+", label: "Rokov skúseností" },
    { value: "15 000+", label: "Ošetrených pacientov" },
  ]),
});

// 3. Services Grid
export const serviceItemSchema = z.object({
  id: z.string(),
  icon: z.string().default("Stethoscope"),
  title: z.string(),
  description: z.string(),
  price: z.string().optional(),
  badge: z.string().optional(),
});

export const servicesContentSchema = z.object({
  title: z.string().default("Naše veterinárne služby"),
  subtitle: z.string().default("Komplexná starostlivosť od prevencie až po chirurgické zákroky"),
  columns: z.enum(["2", "3", "4"]).default("3"),
  services: z.array(serviceItemSchema).default([
    {
      id: "srv-1",
      icon: "ShieldCheck",
      title: "Preventívna medicína & očkovanie",
      description: "Pravidelné kontroly, vakcinačné schémy, odčervenie a ochrana proti parazitom.",
    },
    {
      id: "srv-2",
      icon: "Stethoscope",
      title: "Diagnostika & Laboratórium",
      description: "Rýchla analýza krvi do 15 minút, mikroskopia, digitálny RTG a sonografia.",
    },
    {
      id: "srv-3",
      icon: "Activity",
      title: "Chirurgia & Inhalačná anestézia",
      description: "Mäkkotkanivové zákroky a kastrácie s bezpečným monitoringom vitálnych funkcií.",
    },
    {
      id: "srv-4",
      icon: "Smile",
      title: "Dentálna hygiena & Ultrazvuk",
      description: "Odstraňovanie zubného kameňa ultrazvukom a ošetrenie zápalov ďasien.",
    },
    {
      id: "srv-5",
      icon: "Sparkles",
      title: "Čipovanie & Pet Pasy",
      description: "Aplikácia mikročipov a registrácia do Centrálneho registra spoločenských zvierat.",
    },
    {
      id: "srv-6",
      icon: "HeartPulse",
      title: "Akútna pohotovosť",
      description: "Rýchla stabilizácia a neodkladná starostlivosť pri úrazoch a akútnych otravách.",
    },
  ]),
});

// 4. Team (Consent-gated)
export const teamContentSchema = z.object({
  title: z.string().default("Náš veterinárny tím"),
  subtitle: z.string().default("Tím skúsených lekárov a sestier, pre ktorých je zdravie vašich zvierat na prvom mieste."),
  showCertificationBadge: z.boolean().default(true),
  certificationText: z.string().default("Fear-Free Certifikácia"),
  filterRoles: z.array(z.string()).default(["admin", "veterinarian", "technician"]),
  memberOverrides: z.record(z.string(), z.object({
    customTitle: z.string().optional(),
    customBio: z.string().optional(),
    visible: z.boolean().optional(),
  })).default({}),
});

// 5. Reviews
export const reviewsContentSchema = z.object({
  title: z.string().default("Čo hovoria naši klienti"),
  subtitle: z.string().default("Reálne overené hodnotenia z Google a Facebooku od majiteľov pacientov."),
  layout: z.enum(["grid", "carousel"]).default("grid"),
  minRating: z.number().default(4),
  maxCount: z.number().default(6),
  showPlatformBadge: z.boolean().default(true),
});

// 6. FAQ Accordion
export const faqItemSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
});

export const faqContentSchema = z.object({
  title: z.string().default("Často kladené otázky"),
  subtitle: z.string().default("Odpovede na najčastejšie otázky pred vašou návštevou."),
  items: z.array(faqItemSchema).default([
    {
      id: "faq-1",
      question: "Musím sa na vyšetrenie vopred objednať?",
      answer: "Odporúčame online rezerváciu termínu, aby ste sa vyhli čakaniu. Akútne a neodkladné prípady však ošetrujeme prednostne.",
    },
    {
      id: "faq-2",
      question: "Ako pripraviť psíka alebo mačku pred operáciou?",
      answer: "Pacient musí byť 12 hodín pred zákrokom nalačno bez jedla. Prístup k čistej vode ponechajte do 2 hodín pred príchodom na kliniku.",
    },
    {
      id: "faq-3",
      question: "Aké spôsoby platby prijímate?",
      answer: "Prijímame platby v hotovosti, platobnými kartami (Visa, Mastercard) a prostredníctvom okamžitého QR kódu.",
    },
    {
      id: "faq-4",
      question: "Poskytujete aj pohotovostnú službu?",
      answer: "Áno, mimo bežných ordinačných hodín sme dostupní na pohotovostnom telefónnom čísle pre akútne stavy.",
    },
  ]),
});

// 7. Hours & Location
export const hoursLocationContentSchema = z.object({
  title: z.string().default("Ordinačné hodiny & Kde nás nájdete"),
  subtitle: z.string().default("Klinika s bezproblémovým parkovaním priamo pred vchodom."),
  customHours: z.array(z.object({
    day: z.string(),
    hours: z.string(),
    note: z.string().optional(),
  })).default([
    { day: "Pondelok – Piatok", hours: "08:00 – 19:00" },
    { day: "Sobota", hours: "09:00 – 13:00" },
    { day: "Nedeľa & Sviatky", hours: "Pohotovosť na telefón" },
  ]),
  emergencyNote: z.string().default("V prípade nočných núdzových stavov volajte pohotovostnú linku."),
  showMap: z.boolean().default(true),
  mapQuery: z.string().default(""),
});

// 8. Booking CTA Banner
export const bookingCtaContentSchema = z.object({
  title: z.string().default("Potrebujete vyšetriť psíka, mačku alebo iné zviera?"),
  subtitle: z.string().default("Zarezervujte si presný čas návštevy online bez čakania v čakárni. Pri akútnych stavoch volajte priamo na našu pohotovosť."),
  buttonText: z.string().default("Rezervovať termín online"),
  showPhoneButton: z.boolean().default(true),
  phoneButtonText: z.string().default("Volať na kliniku"),
});

// 9. Gallery
export const galleryContentSchema = z.object({
  title: z.string().default("Náhľad do našej kliniky"),
  subtitle: z.string().default("Moderné priestory navrhnuté pre pokoj a pohodlie vašich miláčikov."),
  layout: z.enum(["grid", "carousel"]).default("grid"),
  columns: z.enum(["2", "3", "4"]).default("3"),
  images: z.array(z.object({
    id: z.string(),
    url: z.string(),
    altText: z.string().optional(),
    caption: z.string().optional(),
  })).default([]),
});

// 10. Handouts (Patient Education)
export const handoutsContentSchema = z.object({
  title: z.string().default("Rady pre chovateľov & letáky"),
  subtitle: z.string().default("Odborné návody, domáca starostlivosť a odpovede na najčastejšie otázky."),
  maxCount: z.number().default(6),
  filterSpecies: z.string().default("all"),
});

// 11. Trust Badges / Certifications
export const trustBadgesContentSchema = z.object({
  title: z.string().default("Certifikácie a štandardy kvality"),
  items: z.array(z.object({
    id: z.string(),
    icon: z.string().default("ShieldCheck"),
    label: z.string(),
    description: z.string().optional(),
  })).default([
    { id: "tb-1", icon: "ShieldCheck", label: "Fear-Free Certified", description: "Odborná certifikácia bezstresového prístupu" },
    { id: "tb-2", icon: "Award", label: "Člen KVL SR", description: "Komora veterinárnych lekárov Slovenskej republiky" },
    { id: "tb-3", icon: "Lock", label: "GDPR Bezpečnosť", description: "Ochrana osobných a zdravotných údajov" },
    { id: "tb-4", icon: "Clock", label: "Inovácie & Digitálna Kasa", description: "Okamžité digitálne účtenky a správy" },
  ]),
});

// 12. Stats Strip
export const statItemSchema = z.object({
  id: z.string(),
  value: z.string(),
  label: z.string(),
  subtext: z.string().optional(),
  source: z.enum(["custom", "patients", "reviews", "years"]).optional(),
});

export const statsContentSchema = z.object({
  title: z.string().default("Naša klinika v číslach"),
  items: z.array(statItemSchema).default([
    { id: "st-1", value: "10+", label: "Rokov praxe", subtext: "V regióne", source: "years" },
    { id: "st-2", value: "14 000+", label: "Vyliečených pacientov", subtext: "Psov, mačiek a drobných zvierat", source: "patients" },
    { id: "st-3", value: "99.4%", label: "Spokojných klientov", subtext: "Podľa Google recenzií", source: "reviews" },
    { id: "st-4", value: "24/7", label: "Pohotovostný kontakt", subtext: "Pre akútne stavy", source: "custom" },
  ]),
});

// 13. Emergency / Urgent Care Banner
export const emergencyBannerContentSchema = z.object({
  alertText: z.string().default("Máte akútny veterinárny stav?"),
  subtext: z.string().default("Pri otrave, autonehode alebo náhlom zhoršení stavu nečakajte a ihneď volajte pohotovosť."),
  phone: z.string().default("+421 900 123 456"),
  available247: z.boolean().default(true),
  dismissible: z.boolean().default(true),
});

// 14. Newsletter / Contact Form
export const contactFormContentSchema = z.object({
  title: z.string().default("Máte otázku? Napíšte nám"),
  subtitle: z.string().default("Odpovieme vám spravidla do 24 hodín počas pracovných dní."),
  showPhoneField: z.boolean().default(true),
  successMessage: z.string().default("Ďakujeme! Vaša správa bola úspešne odoslaná, čoskoro vás budeme kontaktovať."),
  recipientEmail: z.string().optional(),
});

// 15. Video Embed
export const videoEmbedContentSchema = z.object({
  title: z.string().default("Pozrite si video o našej klinike"),
  subtitle: z.string().default("Ako prebieha vyšetrenie u nás a na čo sa pripraviť."),
  videoUrl: z.string().default("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
  aspectRatio: z.enum(["16:9", "4:3"]).default("16:9"),
  caption: z.string().default("Prehliadka ambulancie a operačného traktu"),
});

// 16. Social Proof / Links
export const socialProofContentSchema = z.object({
  title: z.string().default("Sledujte nás na sociálnych sieťach"),
  subtitle: z.string().default("Tipy na starostlivosť, zaujímavé prípady a aktuality z našej ambulancie."),
  showInstagram: z.boolean().default(true),
  showFacebook: z.boolean().default(true),
  showTiktok: z.boolean().default(true),
});

// 17. Custom Rich Text Block
export const customRichTextContentSchema = z.object({
  title: z.string().default("Dôležité oznamy a informácie"),
  content: z.string().default("Vážení klienti, radi by sme vás informovali o nových pravidlách prevencie v letnom období.\n\n* **Kliešťová encefalitída:** Nezabúdajte na pravidelné pipety a obojky.\n* **Prehriatie organizmu:** Nenechávajte zvieratá v zaparkovanom aute."),
  alignment: z.enum(["left", "center"]).default("left"),
  maxWidth: z.enum(["narrow", "normal", "full"]).default("normal"),
});

// 18. Wellness / Preventive Loyalty Plans
export const wellnessPlanItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.string(),
  billingInterval: z.enum(["monthly", "annual"]).default("monthly"),
  badge: z.string().optional(),
  features: z.array(z.string()).default([]),
});

export const wellnessContentSchema = z.object({
  title: z.string().default("Wellness & Preventívne programy"),
  subtitle: z.string().default("Doprajte svojmu miláčikovi pravidelnú veterinárnu starostlivosť a ušetrite s našimi členskými plánmi."),
  showPrice: z.boolean().default(true),
  ctaText: z.string().default("Mám záujem o program"),
  plans: z.array(wellnessPlanItemSchema).default([]),
});

// Section Discriminated Union Schema
export const websiteSectionSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("hero"), order: z.number(), visible: z.boolean(), content: heroContentSchema }),
  z.object({ id: z.string(), type: z.literal("about"), order: z.number(), visible: z.boolean(), content: aboutContentSchema }),
  z.object({ id: z.string(), type: z.literal("services"), order: z.number(), visible: z.boolean(), content: servicesContentSchema }),
  z.object({ id: z.string(), type: z.literal("team"), order: z.number(), visible: z.boolean(), content: teamContentSchema }),
  z.object({ id: z.string(), type: z.literal("reviews"), order: z.number(), visible: z.boolean(), content: reviewsContentSchema }),
  z.object({ id: z.string(), type: z.literal("faq"), order: z.number(), visible: z.boolean(), content: faqContentSchema }),
  z.object({ id: z.string(), type: z.literal("hours_location"), order: z.number(), visible: z.boolean(), content: hoursLocationContentSchema }),
  z.object({ id: z.string(), type: z.literal("booking_cta"), order: z.number(), visible: z.boolean(), content: bookingCtaContentSchema }),
  z.object({ id: z.string(), type: z.literal("gallery"), order: z.number(), visible: z.boolean(), content: galleryContentSchema }),
  z.object({ id: z.string(), type: z.literal("handouts"), order: z.number(), visible: z.boolean(), content: handoutsContentSchema }),
  z.object({ id: z.string(), type: z.literal("trust_badges"), order: z.number(), visible: z.boolean(), content: trustBadgesContentSchema }),
  z.object({ id: z.string(), type: z.literal("stats"), order: z.number(), visible: z.boolean(), content: statsContentSchema }),
  z.object({ id: z.string(), type: z.literal("emergency_banner"), order: z.number(), visible: z.boolean(), content: emergencyBannerContentSchema }),
  z.object({ id: z.string(), type: z.literal("contact_form"), order: z.number(), visible: z.boolean(), content: contactFormContentSchema }),
  z.object({ id: z.string(), type: z.literal("video_embed"), order: z.number(), visible: z.boolean(), content: videoEmbedContentSchema }),
  z.object({ id: z.string(), type: z.literal("social_proof"), order: z.number(), visible: z.boolean(), content: socialProofContentSchema }),
  z.object({ id: z.string(), type: z.literal("custom_rich_text"), order: z.number(), visible: z.boolean(), content: customRichTextContentSchema }),
  z.object({ id: z.string(), type: z.literal("wellness"), order: z.number(), visible: z.boolean(), content: wellnessContentSchema }),
]);

export type WebsiteSection = z.infer<typeof websiteSectionSchema>;

export interface BrandKitData {
  brandColor?: string;
  secondaryColor?: string;
  toneOfVoice?: string;
  brandVoiceInstructions?: string;
  disclaimer?: string;
  defaultHashtags?: string[];
  socialHandles?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  };
  clinicName?: string;
  logoUrl?: string | null;
}

export interface WebsitePublicData {
  practice: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    website?: string | null;
  };
  isPublished: boolean;
  bookingSlug?: string | null;
  team?: Array<{
    id: string;
    name: string;
    role: string;
    avatarUrl?: string | null;
  }>;
  handouts?: Array<{
    id: string;
    slug: string;
    title: string;
    body: string;
    species?: string[] | string | null;
    tags?: string[] | null;
  }>;
  reviews?: Array<{
    id: string;
    rating: number | null;
    reviewText?: string | null;
    reviewerName?: string | null;
    platform?: string | null;
    receivedAt?: string | Date | null;
  }>;
  brandKit?: BrandKitData;
  liveStats?: {
    patientCount: number;
    fiveStarReviewCount: number;
    yearsInPractice: number;
  };
  liveServices?: Array<{
    id: string;
    name: string;
    category?: string | null;
    defaultPrice?: string | null;
  }>;
  wellnessPlans?: Array<{
    id: string;
    name: string;
    description?: string | null;
    price: string;
    billingInterval: "monthly" | "annual";
  }>;
}
