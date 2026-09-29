export interface HandoutThemeInfo {
  src: string;
  category: string;
  badgeColor: string;
  alt: string;
}

/**
 * Maps educational handouts to appropriate thematic images and category metadata
 * based on slug, title, species, and tags.
 */
export function getHandoutThematicImage(handout: {
  slug?: string;
  title?: string;
  tags?: string[] | null;
  species?: string[] | null;
}): HandoutThemeInfo {
  const text = `${handout.slug || ""} ${handout.title || ""} ${(handout.tags || []).join(" ")}`.toLowerCase();

  // 1. Surgery / Castration / Sterilization / Post-op
  if (
    text.includes("kastr") ||
    text.includes("steriliz") ||
    text.includes("chirurg") ||
    text.includes("pooperac") ||
    text.includes("steh") ||
    text.includes("rana") ||
    text.includes("zakrok")
  ) {
    return {
      src: "/marketing/postop-care.svg",
      category: "Chirurgia & Hojenie",
      badgeColor: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
      alt: "Starostlivosť po chirurgickom zákroku",
    };
  }

  // 2. Dental / Stomatology
  if (
    text.includes("dental") ||
    text.includes("zub") ||
    text.includes("stomatolog") ||
    text.includes("chrup") ||
    text.includes("dasn")
  ) {
    return {
      src: "/marketing/dental-hygiene.jpg",
      category: "Stomatológia & Zuby",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      alt: "Dentálna hygiena a starostlivosť o chrup",
    };
  }

  // 3. Ticks / Fleas / Parasites
  if (
    text.includes("kliest") ||
    text.includes("parazit") ||
    text.includes("blch") ||
    text.includes("babezi") ||
    text.includes("odcerven") ||
    text.includes("cerv")
  ) {
    return {
      src: "/marketing/tick-prevention.jpg",
      category: "Parazity & Prevencia",
      badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      alt: "Ochrana pred kliešťami a blchami",
    };
  }

  // 4. Toxic foods / Chocolate / Poison
  if (
    text.includes("cokolad") ||
    text.includes("toxick") ||
    text.includes("jed") ||
    text.includes("otrav") ||
    text.includes("nebezpec")
  ) {
    return {
      src: "/marketing/toxic-chocolate.svg",
      category: "Toxikológia & Výstraha",
      badgeColor: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
      alt: "Toxické potraviny a nebezpečné látky",
    };
  }

  // 5. Nutrition / Diets / Feeding
  if (
    text.includes("vyziv") ||
    text.includes("krmiv") ||
    text.includes("diet") ||
    text.includes("obezit") ||
    text.includes("hmotnost")
  ) {
    return {
      src: "/marketing/pet-nutrition.svg",
      category: "Výživa & Diéty",
      badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      alt: "Správna výživa zvierat",
    };
  }

  // 6. Microchipping / Registration
  if (
    text.includes("cipov") ||
    text.includes("mikrocip") ||
    text.includes("identifik") ||
    text.includes("register")
  ) {
    return {
      src: "/marketing/pet-microchipping.svg",
      category: "Čipovanie & Evidencia",
      badgeColor: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
      alt: "Mikročipovanie a registrácia zvierat",
    };
  }

  // 7. Travel / Pet Passport
  if (
    text.includes("cestov") ||
    text.includes("petpas") ||
    text.includes("dovolen") ||
    text.includes("hranic") ||
    text.includes("pas")
  ) {
    return {
      src: "/marketing/travel-petpass.svg",
      category: "Cestovanie & Petpas",
      badgeColor: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
      alt: "Cestovanie so zvieraťom a petpas",
    };
  }

  // 8. Senior Pet Care / Geriatrics
  if (
    text.includes("senior") ||
    text.includes("geriat") ||
    text.includes("starn") ||
    text.includes("artroz") ||
    text.includes("stary")
  ) {
    return {
      src: "/marketing/senior-pet-care.jpg",
      category: "Geriatria & Seniori",
      badgeColor: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
      alt: "Starostlivosť o seniorných pacientov",
    };
  }

  // 9. Vaccination & Puppy Care
  if (
    text.includes("ockov") ||
    text.includes("vakcin") ||
    text.includes("stena") ||
    text.includes("maciat") ||
    text.includes("imun")
  ) {
    return {
      src: "/marketing/vaccination-care.svg",
      category: "Očkovanie & Imunita",
      badgeColor: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
      alt: "Očkovací plán a imunizácia",
    };
  }

  // 10. First Aid & Emergencies
  if (
    text.includes("prva-pomoc") ||
    text.includes("pomoc") ||
    text.includes("urgent") ||
    text.includes("akutn") ||
    text.includes("upal")
  ) {
    return {
      src: "/marketing/first-aid.svg",
      category: "Prvá pomoc",
      badgeColor: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
      alt: "Zásady prvej pomoci",
    };
  }

  // Default fallback: Nutrition / Prevention
  return {
    src: "/marketing/pet-nutrition.svg",
    category: "Edukačný leták",
    badgeColor: "bg-primary/15 text-primary border-primary/30",
    alt: "Edukačné pokyny kliniky",
  };
}
