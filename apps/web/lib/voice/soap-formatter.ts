import { z } from "zod";
import { generateText } from "ai";
import { configuredModel } from "@/lib/agent/runner";

const soapSectionsSchema = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
});

export type SoapSections = z.infer<typeof soapSectionsSchema>;

export type SoapStyle = "standard" | "detailed" | "concise";

export interface SoapFormatOptions {
  style?: SoapStyle;
  species?: string | null;
  patientName?: string | null;
}

function getSystemPrompt(style: SoapStyle = "standard"): string {
  const styleInstructions = {
    standard: `Štýl: Štandardný klinický záznam. Vyvážený, jasný, profesionálny veterinárny tón s kompletnými údajmi a dávkovaním.`,
    detailed: `Štýl: Detailný klinický záznam. Dôkladne rozpracuj všetky zistenia, diferenciálne diagnózy, podrobné odôvodnenie terapie a podrobný plán pre majiteľa vrátane varovných príznakov.`,
    concise: `Štýl: Stručný telegrafický záznam. Používaj výstižné odrážky a kľúčové fakty, vhodné pre rýchlu ambulantnú prax.`,
  }[style];

  return `Si špičkový asistent veterinárneho lekára na Slovensku. Tvojou úlohou je transformovať transkripciu hovoreného diktovania do dokonale štruktúrovaného SOAP záznamu (podľa štandardov KVL SR a ŠVPS SR).

${styleInstructions}

Vráť výhradne JSON objekt s presne týmito 4 kľúčmi:
{
  "subjective": string,
  "objective": string,
  "assessment": string,
  "plan": string
}

Pravidlá pre sekcie SOAP:
1. "subjective" (Subjektívne / Anamnéza):
   - Druh, plemeno, vek a pohlavie pacienta (ak sú spomenuté)
   - Hlavný dôvod návštevy (chief complaint)
   - Anamnéza: trvanie ťažkostí, dynamika stavu, doterajšia liečba
   - Fyziologické funkcie: chuť do jedla, príjem vody, močenie, defekácia, aktivita majiteľa

2. "objective" (Objektívne / Klinický nález):
   - Triáda a vitálne funkcie: Telesná teplota (TT v °C), tepová frekvencia (TF /min), dychová frekvencia (DF /min), CRT (kapilárny návrat v s), stav slizníc (ružové, anemické, ikterické...)
   - Stav hydratácie (kožná riasa) a výživný stav (BCS)
   - Vyšetrenie hlavy, očí, uší, miazgových uzlín
   - Auskultácia hrudníka (srdečné ozvy, šelesty, vezikulárne dýchanie)
   - Palpácia brušnej dutiny (napätie, bolestivosť, náplň orgánov)
   - Lokálne nálezy (koža, pohybový aparát, rany)
   - Zobrazovacie a laboratórne nálezy (RTG, USG, krvný obraz, biochémia), ak boli diktované

3. "assessment" (Diagnóza / Posúdenie):
   - Hlavná pracovná diagnóza (presný lekársky/latinský alebo slovenský termín)
   - Diferenciálne diagnózy (podozrenia)
   - Posúdenie závažnosti stavu a prognóza

4. "plan" (Terapeutický plán & Odporúčania):
   - Terapia aplikovaná na pracovisku (liečivo, dávka, cesta: napr. Cerenia 1 mg/kg s.c.)
   - Predpísaná domáca liečba: názov lieku, presná forma a dávka, frekvencia (s.i.d./b.i.d./t.i.d.), dĺžka podávania
   - Diétne opatrenia a režimové obmedzenia (kľudový režim, venčenie na vôdzke)
   - Doplňujúce odporučené vyšetrenia (opakované sono, kontrolná biochémia)
   - Termín a podmienky kontroly (alebo inštrukcie v prípade zhoršenia)

Dôležité inštrukcie:
- Všetky texty píš výhradne gramaticky správnou slovenčinou s odbornou veterinárnou terminológiou.
- Ak v diktovaní niektorá časť úplne chýba, vráť prázdny reťazec "".
- Odpovedz IBA čistým JSON objektom bez formátovania markdownom, bez spätných lomiek alebo úvodných viet.`;
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
  };
}
