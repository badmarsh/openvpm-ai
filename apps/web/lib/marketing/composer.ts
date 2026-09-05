import { generateText } from "ai";
import { configuredModel } from "@/lib/agent/runner";
import type { ClinicBrand } from "./planner";
import { RECIPES } from "./recipes";

export interface ComposeCtx {
  recipeKey: string;
  lang: string;
  brand: ClinicBrand;
  facts: Record<string, string>;
  allowName?: boolean;
}

function seededPick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

const CTA: Record<string, string> = {
  sk: "Termín si rezervujte online:",
  en: "Book an appointment online:",
  hu: "Időpontot itt foglalhat:",
};

function cta(lang: string, url: string, def: string): string {
  const label = CTA[lang] ?? CTA[def] ?? CTA.en;
  return `${label} ${url}`.trim();
}

export function localCompose(ctx: ComposeCtx): string {
  const { recipeKey, lang, brand, facts } = ctx;
  const def = brand.defaultLanguage;
  const link = facts.booking_url ?? brand.bookingUrl;
  const pet = ctx.allowName && facts.pet_name ? facts.pet_name : "";
  const name = brand.name;
  const L = (m: Record<string, string>) => m[lang] ?? m[def] ?? m.en ?? "";

  let body = "";
  switch (recipeKey) {
    case "patient_photo":
      body = L({
        sk: `${pet ? `${pet} a ďalší pacienti` : "Každý pacient"} u nás dostávajú pokojnú a trpezlivú starostlivosť. Preventívna prehliadka trvá krátko – a dlho z nej máte pokoj. ${seededPick(["Aj takéto dni nás na práci bavia najviac.", "Presne pre takéto návštevy tu sme."], facts.seed ?? recipeKey)}`,
        hu: "Minden páciensünk nyugodt, türelmes ellátást kap. A szűrővizsgálat rövid – a nyugalom, amit ad, hosszan tart. Pontosan az ilyen látogatásokért vagyunk itt.",
        en: "Every patient receives calm, patient care with us. A check-up takes a moment – the peace of mind lasts. Visits like these are why we are here.",
      });
      body += `\n\n${cta(lang, link, def)}`;
      break;
    case "seasonal_tip":
      body = L({
        sk: facts.tip_sk || `Sezónne upozornenie: ${facts.title ?? ""}. Pri prechádzkach dávajte pozor a v prípade pochybností nás kontaktujte.`,
        hu: facts.tip_hu || `Szezonális figyelmeztetés: ${facts.title ?? ""}. Ha bizonytalan, keressen minket.`,
        en: facts.tip_en || `Seasonal notice: ${facts.title ?? ""}. If in doubt, contact us.`,
      });
      body += `\n\n${cta(lang, link, def)}`;
      break;
    case "service_spotlight":
      body = L({
        sk: `${facts.title ?? "Naša starostlivosť"}. ${facts.detail ?? ""} Stačí sa ozvať – poradíme s plánovaním aj termínom.`,
        hu: `${facts.title ?? "Szolgáltatásunk"}. ${facts.detail ?? ""} Hívjon minket, segítünk a tervezésben is.`,
        en: `${facts.title ?? "Our Service"}. ${facts.detail ?? ""} Get in touch – we will help you plan it.`,
      });
      body += `\n\n${cta(lang, link, def)}`;
      break;
    case "hours_notice":
      body = L({
        sk: `${facts.title ?? "Otváracie hodiny"}: ${facts.detail ?? ""} Akútne stavy riešime telefonicky, poradíme vám, kam sa obrátiť.`,
        hu: `${facts.title ?? "Nyitvatartás"}: ${facts.detail ?? ""} Sürgős esetben hívjon minket.`,
        en: `${facts.title ?? "Opening Hours"}: ${facts.detail ?? ""} In urgent cases, call us any time.`,
      });
      break;
    case "intel_alert":
      body = L({
        sk: `Dôležité pre majiteľov zvierat v našom regióne: ${facts.title ?? "Upozornenie"}. Odporúčame venovať tomu pozornosť a pri akýchkoľvek príznakoch nás kontaktovať. Zdroj: ${facts.source ?? name}.`,
        hu: `Fontos helyi állattartói figyelmeztetés: ${facts.title ?? "Figyelmeztetés"}. Kérjük, legyen figyelmes, tünetek esetén keressen minket. Forrás: ${facts.source ?? name}.`,
        en: `Important for pet owners in our area: ${facts.title ?? "Notice"}. Please stay alert and contact us if you notice symptoms. Source: ${facts.source ?? name}.`,
      });
      body += `\n\n${cta(lang, link, def)}`;
      break;
    case "patient_of_week":
      body = L({
        sk: `Pacient týždňa${pet ? `: ${pet}` : ""}! Malý hrdina, ktorý tento týždeň u nás zvládol všetko s pokojom a odvahou. Ďakujeme za vašu dôveru v ${name}.`,
        hu: `A hét páciense${pet ? `: ${pet}` : ""}! Egy kis hős, aki ezen a héten mindent nyugodtan és bátran vett. Köszönjük a bizalmat.`,
        en: `Patient of the week${pet ? `: ${pet}` : ""}! A little hero who handled everything calmly this week. Thank you for trusting ${name}.`,
      });
      body += `\n\n${cta(lang, link, def)}`;
      break;
    case "custom":
    default:
      body = L({
        sk: `Téma pre zdravie vašich miláčikov: ${facts.topic ?? facts.title ?? "Odborná starostlivosť"}. Najdôležitejšie v skratke – čo sledovať, kedy je to banalita a kedy radšej zavolať nám. Ak máte pochybnosti, ozvite sa, poradíme.`,
        hu: `Téma a kisállatok egészségéért: ${facts.topic ?? facts.title ?? "Szakértő gondoskodás"}. A legfontosabbakat foglaltuk össze – mit érdemes figyelni, és mikor hívjon minket.`,
        en: `A topic for your pet's health: ${facts.topic ?? facts.title ?? "Expert care"}. The essentials in short – what to watch for and when to call us. If in doubt, reach out.`,
      });
      body += `\n\n${cta(lang, link, def)}`;
      break;
  }
  if (facts.hashtags === "1" && ["patient_photo", "patient_of_week"].includes(recipeKey)) {
    body += `\n#${name.toLowerCase().replace(/[^a-z0-9]+/g, "")} #veterinar`;
  }
  return body.trim();
}

export async function composePost(ctx: ComposeCtx): Promise<string> {
  try {
    const model = await configuredModel();
    if (model) {
      const prompt = `Vytvor príspevok na sociálne siete pre veterinárnu kliniku "${ctx.brand.name}" v jazyku "${ctx.lang}".
Téma/Recept: ${ctx.recipeKey}.
Fakty: ${JSON.stringify(ctx.facts)}.
Tón komunikácie: ${ctx.brand.tone}.
Dodržuj striktné pravidlá:
- ŽIADNE názvy liekov viazaných na predpis (Rx)
- ŽIADNE garancie vyliečenia (100%, zaručene)
- ŽIADNE porovnávanie s inými klinikami
- ŽIADNE diagnostické závery o konkrétnom zvierati
- Zahrň výzvu na objednanie (CTA): ${ctx.facts.booking_url ?? ctx.brand.bookingUrl}`;

      const { text } = await generateText({
        model,
        prompt,
        temperature: 0.7,
      });
      if (text && text.trim().length > 20) {
        return text.trim();
      }
    }
  } catch {
    // Fallback to deterministic composer
  }
  return localCompose(ctx);
}
