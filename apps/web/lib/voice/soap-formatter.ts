import { z } from "zod";
import { generateText } from "ai";
import { configuredModel } from "@/lib/agent/runner";

const soapSectionsSchema = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
  clientSummary: z.string().optional(),
});

export type SoapSections = z.infer<typeof soapSectionsSchema>;

export type SoapStyle = "standard" | "detailed" | "concise";

export interface SoapFormatOptions {
  style?: SoapStyle;
  species?: string | null;
  patientName?: string | null;
}

export function getSystemPrompt(style: SoapStyle = "standard"): string {
  if (style === "concise") {
    return `Si asistent veterinárneho lekára na Slovensku. Tvojou úlohou je transformovať diktát do STRUČNÉHO, TELEGRAFICKÉHO SOAP záznamu (štýl: Stručný telegrafický záznam).

Pravidlá pre štýl CONCISE (rýchla ambulancia):
- Žiadne dlhé vety ani zbytočný úvod. Používaj výstižné body a odborné skratky (s.c., i.v., p.o., b.i.d., TT, TF, DF, CRT).
- "subjective": Iba hlavný problém a trvanie (napr. "Vracanie 2 dni, inapetencia.").
- "objective": Iba nameraná triáda a zistené patologické nálezy (napr. "TT 38.8°C, TF 110, brucho bolestivé v epigastriu, CRT <2s. Ostatné bpn.").
- "assessment": Priama pracovná diagnóza bez teórie.
- "plan": Aplikované a predpísané lieky v odrážkach s presnou dávkou a diétnym pokynom.
- "clientSummary": Krátke 2-3 zrozumiteľné vety pre majiteľa.

Vráť výhradne JSON objekt:
{
  "subjective": string,
  "objective": string,
  "assessment": string,
  "plan": string,
  "clientSummary": string
}`;
  }

  if (style === "detailed") {
    return `Si špičkový asistent veterinárneho lekára na Slovensku. Tvojou úlohou je transformovať diktát do DÔKLADNÉHO, REFERENČNÉHO SOAP záznamu (štýl: Detailný klinický záznam).

Pravidlá pre štýl DETAILED (špecializované vyšetrenie / hospitalizácia):
- "subjective": Dôkladná anamnéza, časový priebeh ťažkostí, vakcinačný a odčervovací status, prostredie, doterajšia medikácia a fyziologické funkcie (apetít, smäd, defekácia, mikcia).
- "objective": Systematický anatomický rozpis orgánových sústav (celkový stav a habitus, triáda TT/TF/DF, CRT, sliznice, lymfatické uzliny, auskultácia hrudníka, palpácia brucha, koža/srsť, pohybový a nervový aparát, laboratórne a zobrazovacie nálezy).
- "assessment": Hlavná diagnóza, diferenciálne diagnózy podľa pravdepodobnosti s klinickým odôvodnením a posúdenie prognózy.
- "plan": Kompletný terapeutický protokol na pracovisku (liečivo, dávka v mg/kg a ml, cesta podania), domáca medikácia, nutričný a režimový manažment, kontrolné vyšetrenia a podrobný rozpis varovných príznakov.
- "clientSummary": Podrobný, empatický a zrozumiteľný súhrn pre majiteľa zvieraťa.

Vráť výhradne JSON objekt:
{
  "subjective": string,
  "objective": string,
  "assessment": string,
  "plan": string,
  "clientSummary": string
}`;
  }

  return `Si špičkový asistent veterinárneho lekára na Slovensku. Tvojou úlohou je transformovať transkripciu hovoreného diktovania do dokonale štruktúrovaného SOAP záznamu (podľa štandardov KVL SR a ŠVPS SR) A ZÁROVEŇ vygenerovať zrozumiteľný súhrn pre majiteľa.

Štýl: Štandardný klinický záznam. Vyvážený, jasný, profesionálny veterinárny tón s kompletnými údajmi a dávkovaním.

Vráť výhradne JSON objekt s presne týmito 5 kľúčmi:
{
  "subjective": string,
  "objective": string,
  "assessment": string,
  "plan": string,
  "clientSummary": string
}

Pravidlá pre sekcie SOAP:
1. "subjective" (Subjektívne / Anamnéza):
   - Druh, plemeno, vek a pohlavie pacienta (ak sú spomenuté)
   - Hlavný dôvod návštevy (chief complaint)
   - Anamnéza: trvanie ťažkostí, dynamika stavu, doterajšia liečba
   - Fyziologické funkcie: chuť do jedla, príjem vody, močenie, defekácia, aktivita

2. "objective" (Objektívne / Klinický nález):
   - Triáda a vitálne funkcie: Telesná teplota (TT v °C), tepová frekvencia (TF /min), dychová frekvencia (DF /min), CRT (kapilárny návrat v s), stav slizníc
   - Stav hydratácie (kožná riasa) a výživný stav (BCS)
   - Vyšetrenie hlavy, očí, uší, miazgových uzlín
   - Auskultácia hrudníka (srdečné ozvy, šelesty, vezikulárne dýchanie)
   - Palpácia brušnej dutiny (napätie, bolestivosť, náplň orgánov)
   - Lokálne nálezy (koža, pohybový aparát, rany)
   - Zobrazovacie a laboratórne nálezy (RTG, USG, krvný obraz, biochémia)

3. "assessment" (Diagnóza / Posúdenie):
   - Hlavná pracovná diagnóza (odborný termín)
   - Diferenciálne diagnózy (podozrenia)
   - Posúdenie závažnosti stavu a prognóza

4. "plan" (Terapeutický plán & Odporúčania):
   - Terapia aplikovaná na pracovisku (liečivo, dávka, cesta: napr. Cerenia 1 mg/kg s.c.)
   - Predpísaná domáca liečba: názov lieku, presná forma a dávka, frekvencia (s.i.d./b.i.d./t.i.d.), dĺžka podávania
   - Diétne opatrenia a režimové obmedzenia
   - Doplňujúce odporučené vyšetrenia a termín kontroly

5. "clientSummary" (Zrozumiteľný súhrn pre majiteľa zvieraťa):
   - Ľudskou, empatickou slovenčinou bez zložitej latinčiny vysvetli majiteľovi diagnózu, vykonané úkony, domáce dávkovanie liekov a varovné príznaky.

Dôležité inštrukcie:
- Všetky texty píš výhradne gramaticky správnou slovenčinou s odbornou veterinárnou terminológiou.
- Ak v diktovaní niektorá časť úplne chýba, vráť prázdny reťazec "".
- Odpovedz IBA čistým JSON objektom bez formátovania markdownom.`;
}

function parseAiJson(raw: string): Record<string, unknown> {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
  }
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");
  cleaned = cleaned.replace(/[\x00-\x1f\x7f]/g, "");
  return JSON.parse(cleaned);
}

export async function formatTranscriptToSoap(
  transcript: string,
  options: SoapFormatOptions = {},
): Promise<SoapSections> {
  const { style = "standard", species, patientName } = options;

  let patientContext = "";
  if (patientName || species) {
    patientContext = `Pacient: ${patientName ?? "Neznámy"}${species ? ` (${species})` : ""}\n\n`;
  }

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(new Error("SOAP formatting timed out after 30s")), 30_000);

  let result;
  try {
    result = await generateText({
      model: configuredModel(),
      system: getSystemPrompt(style),
      prompt: `${patientContext}Transkripcia diktovania:\n\n${transcript}`,
      abortSignal: ac.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  try {
    const raw = parseAiJson(result.text);
    const parsed = soapSectionsSchema.safeParse(raw);

    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // Ak by model vrátil neštruktúrovaný text, bezpečne ho umiestnime do subjektívnej sekcie
  }

  return {
    subjective: transcript,
    objective: "",
    assessment: "",
    plan: "",
    clientSummary: `Dnes sme vyšetrili Vášho miláčika ${patientName ? `(${patientName})` : ""}. Na ambulancii sme vykonali potrebné ošetrenie. Dodržiavajte kľudový režim a v prípade pretrvávania ťažkostí nás bezodkladne kontaktujte.`,
  };
}
