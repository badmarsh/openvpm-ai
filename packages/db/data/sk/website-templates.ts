// Website template seed data — Slovak (SK) locale
// Each template defines a complete website structure with pages and blocks.
// Template slugs must match lib/templates/metadata.ts single source of truth.

export const websiteTemplatesData: Record<string, {
  title: string;
  description: string;
  pages: {
    title: string;
    slug: string;
    pageType: string;
    isHome: boolean;
    showInNav: boolean;
    sortOrder: number;
    blocks: {
      blockType: string;
      sortOrder: number;
      content: Record<string, unknown>;
      settings: Record<string, unknown>;
    }[];
  }[];
}> = {
  // Template 1: Clean & Modern
  "clean-modern": {
    title: "Moderná veterinárna klinika",
    description: "Čistý, profesionálny dizajn pre modernú kliniku",
    pages: [
      {
        title: "Domov",
        slug: "",
        pageType: "home",
        isHome: true,
        showInNav: true,
        sortOrder: 0,
        blocks: [
          {
            blockType: "hero",
            sortOrder: 0,
            content: {
              heading: "Starostlivosť, ktorej môžete dôverovať",
              subheading: "Profesionálna veterinárna starostlivosť s láskavým prístupom",
              ctaText: "Rezervovať termín",
              ctaLink: "/portal/booking",
              secondaryCtaText: "Naše služby",
              secondaryCtaLink: "/sluzby",
              backgroundImage: null,
            },
            settings: { padding: "large", backgroundColor: "#f0f9ff" },
          },
          {
            blockType: "services",
            sortOrder: 1,
            content: {
              heading: "Naše služby",
              layout: "grid",
              services: [
                { icon: "stethoscope", title: "Preventívna starostlivosť", description: "Pravidelné prehliadky a očkovanie pre zdravie vášho domáceho maznáčika", price: "od 35€" },
                { icon: "heart-pulse", title: "Chirurgia", description: "Moderné chirurgické zákroky v bezpečnom prostredí", price: "od 150€" },
                { icon: "pill", title: "Farmácia", description: "Kompletné lieky a doplnky výživy pre vaše zvieratá" },
                { icon: "microscope", title: "Diagnostika", description: "Pokročilá laboratórna a zobrazovacia diagnostika" },
              ],
            },
            settings: { padding: "medium" },
          },
          {
            blockType: "testimonials",
            sortOrder: 2,
            content: {
              heading: "Čo hovoria naši klienti",
              layout: "carousel",
              testimonials: [
                { name: "Jana K.", text: "Profesionálny prístup a skvelá starostlivosť o nášho psíka. Odporúčame!", rating: 5, source: "google" },
                { name: "Peter M.", text: "Najlepšia veterinárna klinika v meste. Moderné vybavenie a milý personál.", rating: 5, source: "google" },
              ],
            },
            settings: { padding: "medium", backgroundColor: "#f8fafc" },
          },
          {
            blockType: "cta",
            sortOrder: 3,
            content: {
              heading: "Objednajte sa ešte dnes",
              description: "Sme tu pre vás a vaše zvieratá. Rezervujte si termín online.",
              buttonText: "Rezervovať termín",
              buttonLink: "/portal/booking",
              style: "primary",
            },
            settings: { padding: "large" },
          },
        ],
      },
      {
        title: "Služby",
        slug: "sluzby",
        pageType: "services",
        isHome: false,
        showInNav: true,
        sortOrder: 1,
        blocks: [
          {
            blockType: "hero",
            sortOrder: 0,
            content: {
              heading: "Naše služby",
              subheading: "Komplexná veterinárna starostlivosť pre vaše zvieratá",
              ctaText: "Rezervovať termín",
              ctaLink: "/portal/booking",
            },
            settings: { padding: "small" },
          },
        ],
      },
      {
        title: "Kontakt",
        slug: "kontakt",
        pageType: "contact",
        isHome: false,
        showInNav: true,
        sortOrder: 2,
        blocks: [
          {
            blockType: "contact_form",
            sortOrder: 0,
            content: {
              heading: "Kontaktujte nás",
              description: "Napíšte nám a my sa vám ozveme čo najskôr",
              fields: ["name", "email", "phone", "message"],
              submitText: "Odoslať správu",
              successMessage: "Ďakujeme za správu. Ozveme sa vám čo najskôr.",
            },
            settings: { padding: "medium" },
          },
          {
            blockType: "opening_hours",
            sortOrder: 1,
            content: {
              heading: "Ordinačné hodiny",
              source: "practice_settings",
              showEmergency: true,
              emergencyPhone: "+421 911 123 456",
            },
            settings: { padding: "medium", backgroundColor: "#f8fafc" },
          },
        ],
      },
    ],
  },

  // Template 2: Warm & Trusting
  "warm-trusting": {
    title: "Teplá a dôveryhodná klinika",
    description: "Zemské tóny, dôraz na recenzie, rodinná atmosféra",
    pages: [
      {
        title: "Domov",
        slug: "",
        pageType: "home",
        isHome: true,
        showInNav: true,
        sortOrder: 0,
        blocks: [
          {
            blockType: "hero",
            sortOrder: 0,
            content: {
              heading: "Vitajte v našej veterinárnej rodine",
              subheading: "Láska k zvieratám je základom všetkého, čo robíme",
              ctaText: "Rezervovať termín",
              ctaLink: "/portal/booking",
              backgroundImage: null,
            },
            settings: { padding: "large", backgroundColor: "#fef3c7" },
          },
          {
            blockType: "about",
            sortOrder: 1,
            content: {
              heading: "O nás",
              content: "<p>Sme rodinná veterinárna klinika s viac ako 10-ročnou skúsenosťou. Našim poslaním je poskytovať láskavú a profesionálnu starostlivosť každému zvieratku, ktoré k nám príde.</p>",
            },
            settings: { padding: "medium" },
          },
          {
            blockType: "testimonials",
            sortOrder: 2,
            content: {
              heading: "Recenzie našich klientov",
              layout: "grid",
              testimonials: [
                { name: "Mária", text: "Úžasný prístup k zvieratám. Cítime sa tu ako doma.", rating: 5, source: "google" },
                { name: "Jozef", text: "Profesionáli s láskavým srdcom. Ďakujeme!", rating: 5, source: "google" },
                { name: "Zuzana", text: "Naša mačička sa vždy teší na návštevu. Skvelý kolektív!", rating: 5, source: "google" },
              ],
            },
            settings: { padding: "medium", backgroundColor: "#fffbeb" },
          },
        ],
      },
    ],
  },

  // Template 3: Clinical & Professional
  "clinical-professional": {
    title: "Klinická a profesionálna klinika",
    description: "Dáta a fakty, zoznam služieb, autorita",
    pages: [
      {
        title: "Domov",
        slug: "",
        pageType: "home",
        isHome: true,
        showInNav: true,
        sortOrder: 0,
        blocks: [
          {
            blockType: "hero",
            sortOrder: 0,
            content: {
              heading: "Špičková veterinárna starostlivosť",
              subheading: "Moderné vybavenie, skúsený tím, najlepšia starostlivosť",
              ctaText: "Rezervovať termín",
              ctaLink: "/portal/booking",
            },
            settings: { padding: "large", backgroundColor: "#e0f2fe" },
          },
          {
            blockType: "services",
            sortOrder: 1,
            content: {
              heading: "Komplexné služby",
              layout: "grid",
              services: [
                { icon: "stethoscope", title: "Interná medicína", description: "Diagnostika a liečba vnútorných chorôb" },
                { icon: "bone", title: "Ortopédia", description: "Liečba ochorení pohybového aparátu" },
                { icon: "tooth", title: "Zubné lekárstvo", description: "Profesionálne čistenie a ošetrenie zubov" },
                { icon: "syringe", title: "Vakcinácia", description: "Prevencia podľa najnovších protokolov" },
                { icon: "microscope", title: "Laboratórium", description: "Vlastné laboratórium s rýchlymi výsledkami" },
                { icon: "ultrasound", title: "Ultrazvuk", description: "Moderná zobrazovacia diagnostika" },
              ],
            },
            settings: { padding: "medium" },
          },
          {
            blockType: "cta",
            sortOrder: 2,
            content: {
              heading: "Objednajte sa na konzultáciu",
              description: "Sme tu pre vás od pondelka do soboty",
              buttonText: "Rezervovať termín",
              buttonLink: "/portal/booking",
              style: "primary",
            },
            settings: { padding: "medium", backgroundColor: "#f0f9ff" },
          },
        ],
      },
    ],
  },

  // Template 4: Playful & Friendly
  "playful-friendly": {
    title: "Hravá a priateľská klinika",
    description: "Ilustrovaný, farebný, priateľský k zvieratám",
    pages: [
      {
        title: "Domov",
        slug: "",
        pageType: "home",
        isHome: true,
        showInNav: true,
        sortOrder: 0,
        blocks: [
          {
            blockType: "hero",
            sortOrder: 0,
            content: {
              heading: "Kde sa zvieratká cítia ako doma",
              subheading: "Hravé prostredie, profesionálna starostlivosť",
              ctaText: "Rezervovať termín",
              ctaLink: "/portal/booking",
            },
            settings: { padding: "large", backgroundColor: "#fce7f3" },
          },
          {
            blockType: "team",
            sortOrder: 1,
            content: {
              heading: "Náš tím",
              members: [
                { name: "MVDr. Zuzana Horváthová", role: "Veterinárka", bio: "Špecializácia na internú medicínu a chirurgiu" },
                { name: "MVDr. Marek Kováč", role: "Veterinár", bio: "Špecializácia na ortopédiu a zubné lekárstvo" },
                { name: "Ján Molnár", role: "Veterinárny technik", bio: "Skúsený technik so zameraním na laboratórnu diagnostiku" },
              ],
            },
            settings: { padding: "medium" },
          },
          {
            blockType: "gallery",
            sortOrder: 2,
            content: {
              heading: "Naša klinika",
              layout: "grid",
              images: [
                { url: null, alt: "Čakáreň", caption: "Pohodlná čakáreň" },
                { url: null, alt: "Vyšetrovňa", caption: "Moderná vyšetrovňa" },
                { url: null, alt: "Operačná sála", caption: "Špičková operačná sála" },
              ],
            },
            settings: { padding: "medium", backgroundColor: "#fdf2f8" },
          },
        ],
      },
    ],
  },

  // Template 5: Emergency First
  "emergency-first": {
    title: "Pohotovostná klinika",
    description: "Pohotovosť a urgentné kontakty v popredí",
    pages: [
      {
        title: "Domov",
        slug: "",
        pageType: "home",
        isHome: true,
        showInNav: true,
        sortOrder: 0,
        blocks: [
          {
            blockType: "hero",
            sortOrder: 0,
            content: {
              heading: "Pohotovostná veterinárna služba",
              subheading: "Sme tu pre vás 24/7 v prípade núdze",
              ctaText: "Zavolať pohotovosť",
              ctaLink: "tel:+421911123456",
              secondaryCtaText: "Rezervovať termín",
              secondaryCtaLink: "/portal/booking",
            },
            settings: { padding: "large", backgroundColor: "#fee2e2" },
          },
          {
            blockType: "opening_hours",
            sortOrder: 1,
            content: {
              heading: "Ordinačné hodiny",
              source: "practice_settings",
              showEmergency: true,
              emergencyPhone: "+421 911 123 456",
            },
            settings: { padding: "medium" },
          },
          {
            blockType: "cta",
            sortOrder: 2,
            content: {
              heading: "V prípade núdze neváhajte zavolať",
              description: "Náš pohotovostný tím je pripravený 24 hodín denne, 7 dní v týždni",
              buttonText: "Zavolať +421 911 123 456",
              buttonLink: "tel:+421911123456",
              style: "primary",
            },
            settings: { padding: "large", backgroundColor: "#fef2f2" },
          },
        ],
      },
    ],
  },
};