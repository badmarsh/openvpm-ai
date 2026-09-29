import { generateText } from "ai";
import { configuredModel } from "@/lib/agent/runner";

/**
 * Systémový prompt pre parsing diktátu terénneho výjazdu hovädzieho dobytka.
 */
const FIELD_VISIT_PARSE_SYSTEM_PROMPT = `Si asistent MVDr. Martina Sýkoru — terénneho veterinára pre hovädzí dobytok na Slovensku.
Z jeho hlasového diktátu z terénu extrahuj štruktúrované údaje pre záznam terénneho výjazdu.

Pravidlá:
- Vráť VÝHRADNE JSON objekt, žiadne komentáre ani markdown.
- Ak informácia chýba, použi null.
- Ušné číslo kravy: hľadaj vzor SK + číslice, alebo len číslice, alebo meno kravy.
- Diagnóza: hlavná klinická diagnóza alebo nález v odbornej terminológii.
- Liek: prvý zmienený liečivý prípravok (obchodný alebo generický názov).
- Ochranné lehoty: hľadaj lehota mlieko X dní a lehota mäso X dní.
- Poznámka: všetko ostatné relevantné (pokyny, kontrola, dávkovanie, spôsob podania).
- Názov farmy: hľadaj farma, Agro, chov, meno vlastníka alebo lokalitu.
- cowName: meno kravy ak bolo spomenuté.

Vráť JSON:
{
  "farmNameHint": string | null,
  "cowNameOrEarTag": string | null,
  "diagnosis": string | null,
  "medicationName": string | null,
  "meatWithdrawalDays": number | null,
  "milkWithdrawalDays": number | null,
  "notes": string | null,
  "confidence": "high" | "medium" | "low"
}`;

export interface FieldVisitDraft {
  farmNameHint: string | null;
  cowNameOrEarTag: string | null;
  diagnosis: string | null;
  medicationName: string | null;
  meatWithdrawalDays: number | null;
  milkWithdrawalDays: number | null;
  notes: string | null;
  confidence: "high" | "medium" | "low";
  /** Raw prepis pre kontrolu lekárom */
  transcript: string;
}

/**
 * Parsuje prepis terénneho výjazdu do štruktúrovaného draftu formulára.
 */
export async function parseFieldVisitTranscript(
  transcript: string
): Promise<FieldVisitDraft> {
  const model = configuredModel();

  const { text } = await generateText({
    model,
    system: FIELD_VISIT_PARSE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Diktát terénneho výjazdu:\n\n${transcript.slice(0, 2000)}`,
      },
    ],
    maxOutputTokens: 512,
    temperature: 0.1,
  });

  let parsed: Omit<FieldVisitDraft, "transcript">;
  try {
    const clean = text
      .trim()
      .replace(/^```json?\n?/, "")
      .replace(/```$/, "")
      .trim();
    parsed = JSON.parse(clean) as Omit<FieldVisitDraft, "transcript">;
  } catch {
    parsed = {
      farmNameHint: null,
      cowNameOrEarTag: null,
      diagnosis: transcript.slice(0, 200),
      medicationName: null,
      meatWithdrawalDays: null,
      milkWithdrawalDays: null,
      notes: null,
      confidence: "low",
    };
  }

  return { ...parsed, transcript };
}
