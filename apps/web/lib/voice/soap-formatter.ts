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

const SOAP_FORMAT_PROMPT = `Si veterinárny asistent. Analyzuj transkripciu diktovania a rozdeľ ju do 4 sekcií SOAP.
Vráť JSON s presne týmito kľúčmi: { "subjective", "objective", "assessment", "plan" }

Pravidlá:
- Subjektívne: čo majiteľ popisuje, anamnéza, sťažnosti
- Objektívne: fyzikálne vyšetrenie, teplota, hmotnosť, palpácia, auskultácia
- Diagnóza (Assessment): pracovná diagnóza, diferenciálne diagnózy
- Plán: predpísané lieky, dávky, diéta, kontrola, ďalšie vyšetrenia

Ak sekcia nemá obsah, vráť prázdny string "".
Odpovedz výhradne v slovenčine s veterinárnou terminológiou.
Odpovedz IBA platným JSON objektom, bez akéhokoľvek ďalšieho textu.`;

function parseAiJson(raw: string): Record<string, unknown> {
  let cleaned = raw.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
  }
  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");
  // Remove control characters
  cleaned = cleaned.replace(/[\x00-\x1f\x7f]/g, "");
  return JSON.parse(cleaned);
}

export async function formatTranscriptToSoap(
  transcript: string,
): Promise<SoapSections> {
  const result = await generateText({
    model: configuredModel(),
    system: SOAP_FORMAT_PROMPT,
    prompt: `Transkripcia diktovania:\n\n${transcript}`,
  });

  const raw = parseAiJson(result.text);
  const parsed = soapSectionsSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(
      `AI odpoveď neobsahuje platnú SOAP štruktúru: ${parsed.error.message}`,
    );
  }

  return parsed.data;
}
