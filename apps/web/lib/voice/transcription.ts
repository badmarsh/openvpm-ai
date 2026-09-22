import { generateText } from "ai";
import { configuredModel } from "@/lib/agent/runner";
import {
  hasInferenceProxyConfiguration,
  inferenceProxyBaseUrl,
} from "@/lib/agent/inference-proxy";
import { readPrimaryObject } from "@/lib/s3";

const STT_SYSTEM_PROMPT = `Si profesionálny asistent veterinárneho lekára na Slovensku špecializovaný na presný prepis hovoreného slova do textu.
Tvojou úlohou je verne a bez skreslenia transkribovať veterinárne diktovanie v slovenskom jazyku.

Pravidlá prepisu:
1. Používaj oficiálnu veterinárnu a lekársku terminológiu uznávanú ŠVPS SR a KVL SR.
2. Zachovaj všetky číselné hodnoty a jednotky presne tak, ako boli povedané:
   - Telesná teplota (napr. 38,5 °C alebo TT 38,5)
   - Frekvencia srdca / tepu (TF v úderoch/min)
   - Frekvencia dychu (DF v dychoch/min)
   - Dávky liekov (mg/kg, ml, mg, tbl, kvapky)
   - Kapilárny návrat (CRT pod 2 sekundy)
   - Hmotnosť zvieraťa (kg)
3. Správne zapisuj bežné veterinárne skratky:
   - Cesty podania: s.c. (subkutánne), i.v. (intravenózne), p.o. (perorálne), i.m. (intramuskulárne), lok. (lokálne)
   - Frekvencie: s.i.d. (1x denne), b.i.d. (2x denne), t.i.d. (3x denne), q.i.d. (4x denne), p.r.n. (podľa potreby)
   - Diagnostika: RTG, USG/SONO, EKG, DKK, DLK, KPR, CRSZ, KVL SR, ŠVPS SR
4. Správne zapisuj názvy bežných veterinárnych liečiv a vakcín:
   - NSAID: Meloxoral, Metacam, Rimadyl, Onsior, Cimalgex, Previcox
   - Antibiotiká: Synulox, Kesium, Noroclav, Baytril, Marbocyl, Veraflox, Doxybactin
   - Antiemetiká/GI: Cerenia (maropitant), Degan, Famosan, Ranisan, Omeprazol, Pro-Kolin, Canikur
   - Antiparazitiká: Bravecto, NexGard, Simparica, Credelio, Milprazon, Dehinel, Drontal, Advantix
   - Vakcíny: Nobivac, Eurican, Versican, Biocan, Purevax
   - Dermatológia: Apoquel, Cytopoint, Prednison, Medrol, Malaseb, Posatex, EasOtic, Surolan
5. Vráť výhradne čistý prepísaný text bez akýchkoľvek úvodných alebo záverečných komentárov, vysvetlení alebo formátovania markdownom.`;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function transcribeAudio(fileKey: string): Promise<string> {
  const object = await readPrimaryObject(fileKey, {
    maxBytes: MAX_AUDIO_BYTES,
  });
  if (object.status !== "available") {
    throw new Error(
      object.status === "missing"
        ? "Audio sa v úložisku nenašlo"
        : "Audio sa nepodarilo načítať z úložiska",
    );
  }

  const base64Audio = Buffer.from(object.body).toString("base64");
  const mimeType = object.contentType ?? "audio/webm";

  const ac = new AbortController();
  const timeout = setTimeout(
    () => ac.abort(new Error("Audio transcription timed out after 60s")),
    60_000,
  );

  try {
    // When using a local inference proxy (e.g. Gemini via Antigravity), bypass
    // @ai-sdk/openai-compatible's UnsupportedFunctionalityError on audio files
    // by sending the multimodal audio data URL directly to chat completions.
    if (hasInferenceProxyConfiguration()) {
      const baseURL = inferenceProxyBaseUrl()!;
      const apiKey = process.env.AT_PROXY_KEY ?? "at-proxy";
      const modelCandidates = [
        "gemini-3.8-flash",
        "gemini-2.5-flash",
        
      ].filter((m): m is string => Boolean(m && m.trim()));

      let lastError: Error | null = null;
      for (const model of modelCandidates) {
        try {
          const res = await fetch(`${baseURL}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: STT_SYSTEM_PROMPT },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Transkribuj toto veterinárne audio slovo po slove. Vráť výhradne čistý prepísaný text:",
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:${mimeType};base64,${base64Audio}`,
                      },
                    },
                  ],
                },
              ],
            }),
            signal: ac.signal,
          });

          if (res.ok) {
            const data = (await res.json()) as any;
            const content = data?.choices?.[0]?.message?.content;
            if (typeof content === "string" && content.trim()) {
              return content.trim();
            }
          } else {
            const errText = await res.text().catch(() => "");
            lastError = new Error(
              `Model ${model} transcription failed (${res.status}): ${errText}`,
            );
          }
        } catch (err: any) {
          lastError = err;
        }
      }

      throw (
        lastError ??
        new Error("Inference proxy failed to transcribe audio")
      );
    }

    const result = await generateText({
      model: configuredModel(),
      system: STT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transkribuj toto audio." },
            { type: "file", data: base64Audio, mediaType: mimeType },
          ],
        },
      ],
      abortSignal: ac.signal,
    });

    return result.text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Transkribuje audio priamo z base64 reťazca bez S3 (pre terénny modul).
 */
export async function transcribeAudioDirect(
  base64Audio: string,
  mimeType = "audio/webm"
): Promise<string> {
  let base64Clean = base64Audio.trim();
  if (base64Clean.includes(",")) {
    base64Clean = base64Clean.split(",")[1] ?? base64Clean;
  }

  const ac = new AbortController();
  const timeout = setTimeout(
    () => ac.abort(new Error("Audio transcription timed out after 60s")),
    60_000
  );

  try {
    if (hasInferenceProxyConfiguration()) {
      const baseURL = inferenceProxyBaseUrl()!;
      const apiKey = process.env.AT_PROXY_KEY ?? "at-proxy";
      const modelCandidates = [
        "gemini-3.8-flash",
        "gemini-2.5-flash",
        
      ].filter((m): m is string => Boolean(m && m.trim()));

      let lastError: Error | null = null;
      for (const model of modelCandidates) {
        try {
          const res = await fetch(`${baseURL}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: STT_SYSTEM_PROMPT },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Transkribuj toto veterinárne audio slovo po slove. Vráť výhradne čistý prepísaný text:",
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:${mimeType};base64,${base64Clean}`,
                      },
                    },
                  ],
                },
              ],
            }),
            signal: ac.signal,
          });

          if (res.ok) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = (await res.json()) as any;
            const content = data?.choices?.[0]?.message?.content;
            if (typeof content === "string" && content.trim()) {
              return content.trim();
            }
          } else {
            const errText = await res.text().catch(() => "");
            lastError = new Error(
              `Model ${model} failed (${res.status}): ${errText}`
            );
          }
        } catch (err: unknown) {
          lastError = err as Error;
        }
      }
      throw lastError ?? new Error("Inference proxy failed to transcribe audio");
    }

    const result = await generateText({
      model: configuredModel(),
      system: STT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transkribuj toto audio." },
            { type: "file", data: base64Clean, mediaType: mimeType },
          ],
        },
      ],
      abortSignal: ac.signal,
    });

    return result.text.trim();
  } finally {
    clearTimeout(timeout);
  }
}
