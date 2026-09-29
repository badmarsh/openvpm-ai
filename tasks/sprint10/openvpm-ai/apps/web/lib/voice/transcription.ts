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
const PROXY_TIMEOUT_MS = 60_000;

/**
 * Model candidates for the AT inference proxy, in priority order. The first
 * candidate is the default Gemini model served by the proxy; the second is a
 * conservative fallback when the first is unavailable at the proxy.
 */
const PROXY_MODEL_CANDIDATES = ["gemini-3.8-flash", "gemini-2.5-flash"];

/**
 * Map a MIME type to the `format` accepted by OpenAI-compatible
 * `input_audio` parts. Returns null when the format is unknown and the
 * input_audio fallback should be skipped.
 */
function inputAudioFormat(mimeType: string): string | null {
  const m = (mimeType ?? "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a")) return "mp4";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav") || m.includes("wave")) return "wav";
  if (m.includes("aac")) return "aac";
  return null;
}

/**
 * Map a MIME type to a data-URL media type accepted by Gemini's
 * `image_url` content part (Gemini accepts audio inside image_url data URLs
 * on its OpenAI-compatible endpoint).
 */
function audioDataUrl(base64Audio: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64Audio}`;
}

/**
 * One chat-completions call against the AT proxy with a single audio content
 * part. Throws an Error whose message contains the HTTP status on failure so
 * callers can distinguish request-format rejections (4xx) from server errors.
 */
async function proxyTranscribeCall(opts: {
  model: string;
  audioPart: Record<string, unknown>;
  signal: AbortSignal;
}): Promise<string | null> {
  const baseURL = inferenceProxyBaseUrl()!;
  const apiKey = process.env.AT_PROXY_KEY ?? "at-proxy";

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: "system", content: STT_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transkribuj toto veterinárne audio slovo po slove. Vráť výhradne čistý prepísaný text:",
            },
            opts.audioPart,
          ],
        },
      ],
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Model ${opts.model} transcription failed (${res.status}): ${errText}`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}

function isRequestFormatError(err: unknown): boolean {
  return err instanceof Error && /\(4\d\d\)/.test(err.message);
}

/**
 * Transcribe base64 audio through the AT inference proxy.
 *
 * The audio is first sent as a Gemini-style `image_url` data URL (the
 * multimodal content part Gemini accepts on its OpenAI-compatible endpoint).
 * If the endpoint rejects the request format (4xx) — which happens when the
 * proxy routes to a non-Gemini model — the same model is retried once with
 * the OpenAI-compatible `input_audio` part. Each model candidate gets a
 * fresh AbortController chained to the overall budget, so a timeout on one
 * candidate cannot silently kill the remaining candidates with a stale
 * aborted signal.
 */
async function transcribeViaProxy(
  base64Audio: string,
  mimeType: string,
  overallSignal: AbortSignal,
): Promise<string> {
  const imagePart: Record<string, unknown> = {
    type: "image_url",
    image_url: { url: audioDataUrl(base64Audio, mimeType) },
  };
  const format = inputAudioFormat(mimeType);
  const audioPart: Record<string, unknown> | null = format
    ? {
        type: "input_audio",
        input_audio: { data: base64Audio, format },
      }
    : null;

  let lastError: Error | null = null;
  for (const model of PROXY_MODEL_CANDIDATES) {
    if (overallSignal.aborted) break;

    const candidateAc = new AbortController();
    const onOverallAbort = () => candidateAc.abort(overallSignal.reason);
    overallSignal.addEventListener("abort", onOverallAbort, { once: true });
    try {
      const parts = audioPart ? [imagePart, audioPart] : [imagePart];
      for (let partIndex = 0; partIndex < parts.length; partIndex++) {
        try {
          const text = await proxyTranscribeCall({
            model,
            audioPart: parts[partIndex],
            signal: candidateAc.signal,
          });
          if (text) return text;
          lastError =
            lastError ??
            new Error(`Model ${model} returned an empty transcription`);
          // Empty response: try the next part/model, keep going.
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (overallSignal.aborted) break;
          // Only a request-format rejection (4xx) makes sense to retry with a
          // different audio content part; server (5xx) or network errors go
          // straight to the next model candidate.
          if (
            partIndex === 0 &&
            audioPart &&
            !isRequestFormatError(lastError)
          ) {
            break;
          }
        }
      }
    } finally {
      overallSignal.removeEventListener("abort", onOverallAbort);
    }
  }

  throw lastError ?? new Error("Inference proxy failed to transcribe audio");
}

async function transcribeWithFallbackModel(
  base64Audio: string,
  mimeType: string,
  ac: AbortController,
): Promise<string> {
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
}

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
    PROXY_TIMEOUT_MS,
  );

  try {
    // When using the AT inference proxy (e.g. Gemini behind Cloudflare), send
    // the multimodal audio data URL directly to chat completions instead of
    // relying on @ai-sdk/openai-compatible's file-part support.
    if (hasInferenceProxyConfiguration()) {
      return await transcribeViaProxy(base64Audio, mimeType, ac.signal);
    }

    return await transcribeWithFallbackModel(base64Audio, mimeType, ac);
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

  // Defence in depth: the tRPC layer already caps the input, but the function
  // must not be able to base64-decode an unbounded string into ~33MB+ of
  // memory (a 25MB binary becomes ~33MB of base64 before JSON.stringify).
  const approxBytes = Math.floor((base64Clean.length * 3) / 4);
  if (approxBytes > MAX_AUDIO_BYTES) {
    throw new Error(
      `Audio presahuje povoleny limit ${MAX_AUDIO_BYTES / (1024 * 1024)} MB`,
    );
  }

  const ac = new AbortController();
  const timeout = setTimeout(
    () => ac.abort(new Error("Audio transcription timed out after 60s")),
    PROXY_TIMEOUT_MS
  );

  try {
    if (hasInferenceProxyConfiguration()) {
      return await transcribeViaProxy(base64Clean, mimeType, ac.signal);
    }

    return await transcribeWithFallbackModel(base64Clean, mimeType, ac);
  } finally {
    clearTimeout(timeout);
  }
}
