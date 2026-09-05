import { generateText } from "ai";
import { configuredModel } from "@/lib/agent/runner";
import { readPrimaryObject } from "@/lib/s3";

const STT_SYSTEM_PROMPT = `Transkribuj slovenské veterinárne diktovanie.
Používaj oficiálnu veterinárnu terminológiu ŠVPS SR.
Zachovaj všetky číselné hodnoty (teplota, dávky, hmotnosť).
Vráť čistý text bez komentárov.`;

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
  });

  return result.text.trim();
}
