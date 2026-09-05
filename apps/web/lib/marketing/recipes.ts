// Interná knižnica „content recipes" (M1) – používateľ ju nikdy nevidí.
// Recept má: účel, sezónnosť, požadované vstupy, rizikovú triedu pre validátor.
// Zakázané recepty (Rx liečivá, porovnávanie, garantované výsledky, zľavy mimo kódex KVL SR)
// tu jednoducho NIE SÚ – nedajú sa vybrať, namiesto toho ich stopne validátor.

export interface Recipe {
  key: string;
  purpose: string;
  months?: number[]; // 1–12, sezónnosť pre SR
  requiresMedia?: boolean;
  consentScope?: "photo_social" | "photo_web" | "photo_tv" | "story" | "testimonial";
  requiresEventKind?: "campaign" | "holiday" | "hours_note";
  requiresIntel?: boolean;
  allowPrice: boolean; // recept má schválený cenník ako vstup
  allowIllustration?: boolean; // explicitne povoľuje generovanú ilustráciu
  riskClass: "low" | "medium";
  type: "post" | "tv_slide";
  platforms: string[];
}

export const RECIPES: Recipe[] = [
  {
    key: "patient_photo",
    purpose: "Dôvera cez skutočný deň na klinike",
    requiresMedia: true,
    consentScope: "photo_social",
    allowPrice: false,
    riskClass: "low",
    type: "post",
    platforms: ["instagram", "facebook"],
  },
  {
    key: "patient_of_week",
    purpose: "Oslava pacienta (len so súhlasom)",
    requiresMedia: true,
    consentScope: "photo_social",
    allowPrice: false,
    riskClass: "medium", // obsahuje osobu/zviera → vyžaduje individuálne potvrdenie
    type: "post",
    platforms: ["instagram", "facebook"],
  },
  {
    key: "seasonal_tip",
    purpose: "Sezónna prevencia (kliešte, teplo, ohňostroje…)",
    allowPrice: false,
    allowIllustration: true,
    riskClass: "low",
    type: "post",
    platforms: ["instagram", "facebook", "gbp"],
  },
  {
    key: "service_spotlight",
    purpose: "Aktuálna kampaň/služba z kalendára kliniky",
    requiresEventKind: "campaign",
    allowPrice: false,
    riskClass: "low",
    type: "post",
    platforms: ["facebook", "gbp"],
  },
  {
    key: "hours_notice",
    purpose: "Otváracie hodiny / sviatky",
    requiresEventKind: "holiday",
    allowPrice: false,
    riskClass: "low",
    type: "post",
    platforms: ["gbp", "facebook"],
  },
  {
    key: "intel_alert",
    purpose: "Varovanie z odborného feedu označené „Zdieľať s klientmi“",
    requiresIntel: true,
    allowPrice: false,
    riskClass: "medium",
    type: "post",
    platforms: ["facebook", "gbp"],
  },
  {
    key: "tv_tip",
    purpose: "Edukačný slajd do čakárne",
    allowPrice: false,
    riskClass: "low",
    type: "tv_slide",
    platforms: ["tv"],
  },
  {
    key: "custom",
    purpose: "Téma na vyžiadanie z jediného poľa",
    allowPrice: false,
    riskClass: "low",
    type: "post",
    platforms: ["instagram", "facebook"],
  },
];

// Sezónny veterinárny kalendár pre SR (nastaviteľný – v produkcii per klinika).
export interface SeasonTheme {
  key: string;
  months: number[];
  title: Record<string, string>;
  tip: Record<string, string>;
}

export const SEASON_THEMES: SeasonTheme[] = [
  {
    key: "ticks",
    months: [3, 4, 5, 6, 9, 10],
    title: { sk: "Kliešte sú opäť aktívne", hu: "Kullancsszezon", en: "Tick season is back" },
    tip: {
      sk: "Po každej prechádzke skontrolujte srsť – najmä okolo uší, brucha a labiek. Ak si nie ste istí správnym odstránením kliešťa, ukážeme vám to pri najbližšej návšteve.",
      hu: "Minden séta után ellenőrizze a szőrt – különösen a fülek, a has és a mancsok környékén. Ha bizonytalan a kullancs eltávolításában, szívesen megmutatjuk.",
      en: "After every walk, check the coat – especially around ears, belly and paws. If you are unsure how to remove a tick safely, we will gladly show you.",
    },
  },
  {
    key: "heat",
    months: [7, 8],
    title: { sk: "Horúčavy a zvieratá", hu: "Hőség és a kisállatok", en: "Heat and pets" },
    tip: {
      sk: "V horúčavách choďte so psom skoro ráno alebo večer, chodník si najprv vyskúšajte dlaňou a vodu majte vždy so sebou. Prehriatie poznáte podľa prudkého dýchania a apatie – vtedy volajte hneď.",
      hu: "Hőségben kora reggel vagy este sétáltasson, az aszfaltot előbb tenyérrel ellenőrizze, és mindig legyen Önnél víz. Tünetek esetén azonnal hívjon minket.",
      en: "Walk your dog early morning or late evening, test the pavement with your palm, and always carry water. Heavy panting and apathy are warning signs – call us right away.",
    },
  },
  {
    key: "fireworks",
    months: [12, 1],
    title: { sk: "Silvester bez stresu", hu: "Szilveszter stressz nélkül", en: "A calm New Year's Eve" },
    tip: {
      sk: "Pripravte zvieratu tiché miesto v interiéri, zatvorte okná a večernú prechádzku posuňte skôr. Ak vie váš pes vyľakať sa, poraďte sa s nami vopred – nie 31. decembra.",
      hu: "Készítsen csendes helyet a lakásban, csukja be az ablakokat, és az esti sétát hozza előbbre. Ha kutyája fél, beszéljünk előre – nem szilveszterkor.",
      en: "Prepare a quiet indoor spot, close the windows, and move the evening walk earlier. If your dog gets scared, talk to us in advance – not on Dec 31.",
    },
  },
  {
    key: "chocolate",
    months: [4, 12],
    title: { sk: "Pozor na sladkosti", hu: "Óvatosan az édességekkel", en: "Watch out for sweets" },
    tip: {
      sk: "Čokoláda, hrozienka a sladidlá s xylitolom nepatria do dosahu zvierat. Ak zviera niečo zje, panika nepomôže – zavolajte nám a povedzte, čo a koľko to asi bolo.",
      hu: "A csokoládé, mazsola és xilites édességek nem valók állatoknak. Ha baj történt, hívjon minket, és mondja meg, mi és mennyi fogyott.",
      en: "Chocolate, raisins and xylitol-sweetened treats must stay out of reach. If your pet eats something, call us and say what and how much it was.",
    },
  },
];

export function seasonFor(month: number): SeasonTheme | undefined {
  const order = ["heat", "fireworks", "chocolate", "ticks"];
  return [...SEASON_THEMES]
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .find((t) => t.months.includes(month));
}
