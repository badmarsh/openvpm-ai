import { WebsiteSection, SectionType } from "./website-builder-types";

/**
 * Synthesizes the default 5-section array that reproduces the current hardcoded
 * clinic page (/web/[clinicId]) pixel-identically for backwards compatibility.
 */
export function getSeedWebsiteSections(clinicName: string = "Veterinárna klinika"): WebsiteSection[] {
  return [
    {
      id: "seed-hero-1",
      type: "hero",
      order: 0,
      visible: true,
      content: {
        badge: "Veterinárna starostlivosť na najvyššej úrovni",
        title: clinicName,
        subtitle:
          "Poskytujeme komplexnú odbornú diagnostiku, modernú chirurgiu a preventívnu starostlivosť pre vaše domáce zvieratá s dôrazom na bezstresový prístup.",
        primaryCtaText: "Objednať sa online",
        primaryCtaUrl: "",
        secondaryCtaText: "Volať na kliniku",
        secondaryCtaUrl: "",
        backgroundImage: null,
        overlayGradient: true,
        showContactCard: true,
      },
    },
    {
      id: "seed-team-2",
      type: "team",
      order: 1,
      visible: true,
      content: {
        title: "Náš veterinárny tím",
        subtitle:
          "Tím skúsených lekárov a sestier, pre ktorých je zdravie vašich zvierat na prvom mieste.",
        showCertificationBadge: true,
        certificationText: "Fear-Free Certifikácia",
        filterRoles: ["admin", "veterinarian", "technician"],
        memberOverrides: {},
      },
    },
    {
      id: "seed-handouts-3",
      type: "handouts",
      order: 2,
      visible: true,
      content: {
        title: "Rady pre chovateľov & letáky",
        subtitle:
          "Odborné návody, domáca starostlivosť a odpovede na najčastejšie otázky.",
        maxCount: 6,
        filterSpecies: "all",
      },
    },
    {
      id: "seed-reviews-4",
      type: "reviews",
      order: 3,
      visible: true,
      content: {
        title: "Čo hovoria naši klienti",
        subtitle:
          "Reálne overené hodnotenia z Google a Facebooku od majiteľov pacientov.",
        layout: "grid",
        minRating: 4,
        maxCount: 8,
        showPlatformBadge: true,
      },
    },
    {
      id: "seed-booking-5",
      type: "booking_cta",
      order: 4,
      visible: true,
      content: {
        title: "Potrebujete vyšetriť psíka, mačku alebo iné zviera?",
        subtitle:
          "Zarezervujte si presný čas návštevy online bez čakania v čakárni. Pri akútnych stavoch volajte priamo na našu pohotovosť.",
        buttonText: "Rezervovať termín online",
        showPhoneButton: true,
        phoneButtonText: "Volať na kliniku",
      },
    },
  ];
}

/**
 * Creates a new section instance with default content for adding from the palette.
 */
export function createDefaultSection(type: SectionType, order: number): WebsiteSection {
  const id = `sec-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  switch (type) {
    case "hero":
      return {
        id,
        type: "hero",
        order,
        visible: true,
        content: {
          badge: "Veterinárna starostlivosť na najvyššej úrovni",
          title: "Moderná veterinárna starostlivosť",
          subtitle: "Poskytujeme komplexnú odbornú diagnostiku, modernú chirurgiu a preventívnu starostlivosť s dôrazom na bezstresový prístup.",
          primaryCtaText: "Objednať sa online",
          primaryCtaUrl: "",
          secondaryCtaText: "Volať na kliniku",
          secondaryCtaUrl: "",
          backgroundImage: null,
          overlayGradient: true,
          showContactCard: true,
        },
      };

    case "about":
      return {
        id,
        type: "about",
        order,
        visible: true,
        content: {
          title: "O našej klinike",
          subtitle: "Venujeme sa zdraviu zvierat už viac ako 10 rokov",
          story: "Našou prioritou je individuálny prístup ku každému pacientovi a podrobná komunikácia s majiteľom. Vybavenie našej kliniky zahŕňa digitálny RTG, ultrasonografiu, biochemické laboratórium a modernú inhalačnú anestéziu.",
          imageUrl: null,
          imageAlt: "Naša klinika",
          imagePosition: "right",
          stats: [
            { value: "12+", label: "Rokov skúseností" },
            { value: "15 000+", label: "Ošetrených pacientov" },
          ],
        },
      };

    case "services":
      return {
        id,
        type: "services",
        order,
        visible: true,
        content: {
          title: "Naše veterinárne služby",
          subtitle: "Komplexná starostlivosť od prevencie až po chirurgické zákroky",
          columns: "3",
          services: [
            { id: "srv-1", icon: "ShieldCheck", title: "Preventívna medicína & očkovanie", description: "Pravidelné kontroly, vakcinačné schémy, odčervenie a ochrana proti parazitom." },
            { id: "srv-2", icon: "Stethoscope", title: "Diagnostika & Laboratórium", description: "Rýchla analýza krvi do 15 minút, mikroskopia, digitálny RTG a sonografia." },
            { id: "srv-3", icon: "Activity", title: "Chirurgia & Inhalačná anestézia", description: "Mäkkotkanivové zákroky a kastrácie s bezpečným monitoringom vitálnych funkcií." },
            { id: "srv-4", icon: "Smile", title: "Dentálna hygiena & Ultrazvuk", description: "Odstraňovanie zubného kameňa ultrazvukom a ošetrenie zápalov ďasien." },
            { id: "srv-5", icon: "Sparkles", title: "Čipovanie & Pet Pasy", description: "Aplikácia mikročipov a registrácia do Centrálneho registra spoločenských zvierat." },
            { id: "srv-6", icon: "HeartPulse", title: "Akútna pohotovosť", description: "Rýchla stabilizácia a neodkladná starostlivosť pri úrazoch a akútnych otravách." },
          ],
        },
      };

    case "team":
      return {
        id,
        type: "team",
        order,
        visible: true,
        content: {
          title: "Náš veterinárny tím",
          subtitle: "Tím skúsených lekárov a sestier, pre ktorých je zdravie vašich zvierat na prvom mieste.",
          showCertificationBadge: true,
          certificationText: "Fear-Free Certifikácia",
          filterRoles: ["admin", "veterinarian", "technician"],
          memberOverrides: {},
        },
      };

    case "reviews":
      return {
        id,
        type: "reviews",
        order,
        visible: true,
        content: {
          title: "Čo hovoria naši klienti",
          subtitle: "Reálne overené hodnotenia z Google a Facebooku od majiteľov pacientov.",
          layout: "grid",
          minRating: 4,
          maxCount: 6,
          showPlatformBadge: true,
        },
      };

    case "faq":
      return {
        id,
        type: "faq",
        order,
        visible: true,
        content: {
          title: "Často kladené otázky",
          subtitle: "Odpovede na najčastejšie otázky pred vašou návštevou.",
          items: [
            { id: "f-1", question: "Musím sa na vyšetrenie vopred objednať?", answer: "Odporúčame online rezerváciu termínu, aby ste sa vyhli čakaniu. Akútne prípady však ošetrujeme prednostne." },
            { id: "f-2", question: "Ako pripraviť psíka alebo mačku pred operáciou?", answer: "Pacient musí byť 12 hodín pred zákrokom nalačno bez jedla. Vodu ponechajte do 2 hodín pred príchodom." },
            { id: "f-3", question: "Aké spôsoby platby prijímate?", answer: "Prijímame platby v hotovosti, kartami aj cez okamžitý QR kód." },
            { id: "f-4", question: "Poskytujete aj pohotovostnú službu?", answer: "Áno, mimo bežných ordinačných hodín sme dostupní na pohotovostnom telefónnom čísle." },
          ],
        },
      };

    case "hours_location":
      return {
        id,
        type: "hours_location",
        order,
        visible: true,
        content: {
          title: "Ordinačné hodiny & Kde nás nájdete",
          subtitle: "Klinika s bezproblémovým parkovaním priamo pred vchodom.",
          customHours: [
            { day: "Pondelok – Piatok", hours: "08:00 – 19:00" },
            { day: "Sobota", hours: "09:00 – 13:00" },
            { day: "Nedeľa & Sviatky", hours: "Pohotovosť na telefón" },
          ],
          emergencyNote: "V prípade nočných núdzových stavov volajte pohotovostnú linku.",
          showMap: true,
          mapQuery: "",
        },
      };

    case "booking_cta":
      return {
        id,
        type: "booking_cta",
        order,
        visible: true,
        content: {
          title: "Potrebujete vyšetriť psíka, mačku alebo iné zviera?",
          subtitle: "Zarezervujte si presný čas návštevy online bez čakania v čakárni.",
          buttonText: "Rezervovať termín online",
          showPhoneButton: true,
          phoneButtonText: "Volať na kliniku",
        },
      };

    case "gallery":
      return {
        id,
        type: "gallery",
        order,
        visible: true,
        content: {
          title: "Náhľad do našej kliniky",
          subtitle: "Moderné priestory navrhnuté pre pokoj a pohodlie vašich miláčikov.",
          layout: "grid",
          columns: "3",
          images: [],
        },
      };

    case "handouts":
      return {
        id,
        type: "handouts",
        order,
        visible: true,
        content: {
          title: "Rady pre chovateľov & letáky",
          subtitle: "Odborné návody, domáca starostlivosť a odpovede na najčastejšie otázky.",
          maxCount: 6,
          filterSpecies: "all",
        },
      };

    case "trust_badges":
      return {
        id,
        type: "trust_badges",
        order,
        visible: true,
        content: {
          title: "Certifikácie a štandardy kvality",
          items: [
            { id: "tb-1", icon: "ShieldCheck", label: "Fear-Free Certified", description: "Odborná certifikácia bezstresového prístupu" },
            { id: "tb-2", icon: "Award", label: "Člen KVL SR", description: "Komora veterinárnych lekárov Slovenskej republiky" },
            { id: "tb-3", icon: "Lock", label: "GDPR Bezpečnosť", description: "Ochrana osobných a zdravotných údajov" },
            { id: "tb-4", icon: "Clock", label: "Inovácie & Digitálna Kasa", description: "Okamžité digitálne účtenky a správy" },
          ],
        },
      };

    case "stats":
      return {
        id,
        type: "stats",
        order,
        visible: true,
        content: {
          title: "Naša klinika v číslach",
          items: [
            { id: "st-1", value: "10+", label: "Rokov praxe", subtext: "V regióne" },
            { id: "st-2", value: "14 000+", label: "Vyliečených pacientov", subtext: "Psov, mačiek a drobných zvierat" },
            { id: "st-3", value: "99.4%", label: "Spokojných klientov", subtext: "Podľa Google recenzií" },
            { id: "st-4", value: "24/7", label: "Pohotovostný kontakt", subtext: "Pre akútne stavy" },
          ],
        },
      };

    case "emergency_banner":
      return {
        id,
        type: "emergency_banner",
        order,
        visible: true,
        content: {
          alertText: "Máte akútny veterinárny stav?",
          subtext: "Pri otrave, autonehode alebo náhlom zhoršení stavu nečakajte a ihneď volajte pohotovosť.",
          phone: "+421 900 123 456",
          available247: true,
          dismissible: true,
        },
      };

    case "contact_form":
      return {
        id,
        type: "contact_form",
        order,
        visible: true,
        content: {
          title: "Máte otázku? Napíšte nám",
          subtitle: "Odpovieme vám spravidla do 24 hodín počas pracovných dní.",
          showPhoneField: true,
          successMessage: "Ďakujeme! Vaša správa bola úspešne odoslaná, čoskoro vás budeme kontaktovať.",
        },
      };

    case "video_embed":
      return {
        id,
        type: "video_embed",
        order,
        visible: true,
        content: {
          title: "Pozrite si video o našej klinike",
          subtitle: "Ako prebieha vyšetrenie u nás a na čo sa pripraviť.",
          videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          aspectRatio: "16:9",
          caption: "Prehliadka ambulancie a operačného traktu",
        },
      };

    case "social_proof":
      return {
        id,
        type: "social_proof",
        order,
        visible: true,
        content: {
          title: "Sledujte nás na sociálnych sieťach",
          subtitle: "Tipy na starostlivosť, zaujímavé prípady a aktuality z našej ambulancie.",
          showInstagram: true,
          showFacebook: true,
          showTiktok: true,
        },
      };

    case "custom_rich_text":
      return {
        id,
        type: "custom_rich_text",
        order,
        visible: true,
        content: {
          title: "Dôležité oznamy a informácie",
          content: "Vážení klienti, radi by sme vás informovali o nových pravidlách prevencie v letnom období.\n\n* **Kliešťová encefalitída:** Nezabúdajte na pravidelné pipety a antiparazitné obojky.\n* **Prehriatie organizmu:** Nenechávajte zvieratá v zaparkovanom aute ani na priamom slnku.",
          alignment: "left",
          maxWidth: "normal",
        },
      };

    case "wellness":
      return {
        id,
        type: "wellness",
        order,
        visible: true,
        content: {
          title: "Wellness & Preventívne programy",
          subtitle: "Doprajte svojmu miláčikovi pravidelnú veterinárnu starostlivosť a ušetrite s našimi členskými plánmi.",
          showPrice: true,
          ctaText: "Mám záujem o program",
          plans: [
            {
              id: "wp-basic",
              name: "Základná prevencia",
              description: "Pravidelná ochrana a prehliadka pre mladé a zdravé zvieratá.",
              price: "19 €",
              billingInterval: "monthly",
              badge: "Štartér",
              features: [
                "Ročná preventívna prehliadka",
                "Základné očkovanie a odčervenie",
                "Zľava 10% na krmivá",
              ],
            },
            {
              id: "wp-complete",
              name: "Kompletný wellness",
              description: "Najpopulárnejší balík pre dospelých psov a mačky so zľavou na zákroky.",
              price: "29 €",
              billingInterval: "monthly",
              badge: "Odporúčané",
              features: [
                "Kompletné preventívne vyšetrenie",
                "Vakcinačná schéma a čipovanie",
                "Dentálna hygiena s 20% zľavou",
                "Neobmedzené konzultácie po telefóne",
              ],
            },
          ],
        },
      };
  }
}
