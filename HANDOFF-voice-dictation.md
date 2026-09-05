# Handoff: Hlasové diktovanie → openvpm-ai (Zero-Conflict)

## Kontext

OpenVPM obsahuje funkciu "Hlasové diktovanie" (`/agent/voice`), ktorá umožňuje veterinárom diktovať klinické poznámky hlasom. Cieľom je preniesť túto funkcionalitu do openvpm-ai ako Zero-Conflict extenziu s vylepšenou architektúrou, perzistenciou, GDPR compliance a integráciou do SOAP note workflowu.

---

## 1. Súčasný stav v OpenVPM

### Čo existuje

| Vrstva | Súbor | Popis |
|--------|-------|-------|
| Page | `apps/web/app/(dashboard)/ai-voice-input/page.tsx` | 865-riadkový monolitický client component |
| Alias | `apps/web/app/(dashboard)/agent/voice/page.tsx` | Re-export predchádzajúceho |
| Hook | `hooks/use-audio-recorder.ts` | Web Audio API wrapper (MediaRecorder + base64) |
| API | `/api/ai-results` (POST) | Uloženie transkripcie ako `voice-transcription` typ |
| i18n | `messages/sk.json` sekcia `ai.voiceInput.*` | ~80 prekladových kľúčov |
| Komponenty | `SearchablePetSelect`, `FormattedAIResult` | Legacy závislosti |

### Ako to funguje

1. **Nahrávanie**: Web Audio API → `MediaRecorder` → `Blob` → `FileReader` → base64 data URL
2. **Transkripcia (real-time)**: Web Speech API (`window.SpeechRecognition`) — beží v prehliadači, nie na serveri. Default `lang: 'en-US'`.
3. **Fallback transkripcia**: Ak Web Speech API nie je dostupné, pošle base64 audio na server → `aiService.generateText()` (LLM prompt).
4. **Formátovanie**: `aiService.generateText()` s promptom "format this transcribed medical voice note into well-structured medical documentation".
5. **Uloženie**: `POST /api/ai-results` s `{ patientId, type: 'voice-transcription', content }` — žiadna štruktúrovaná SOAP integrácia.
6. **UI**: 4 taby (voice, transcription, commands, settings) — väčšina je dekoratívna, nie funkčná.

### Architektonické problémy

1. **Žiadna perzistencia audia** — base64 žije len v `useState`, po refreshi zmizne
2. **Žiadny audit trail** — kto, kedy, pre ktorého pacienta diktoval
3. **Žiadna GDPR skartácia** — surové audio sa nikde neukladá, ale ani nemaže
4. **Web Speech API je browser-dependent** — funguje len v Chrome/Edge, nie vo Firefoxe
5. **Prompt je príliš všeobecný** — "format into well-structured medical documentation" negarantuje SOAP štruktúru
6. **Žiadna väzba na SOAP notes** — ukladá sa ako `voice-transcription`, nie ako SOAP note
7. **Monolitický component** — 865 riadkov, zmiešaná logika nahrávania, AI, UI, state managementu
8. **Navigácia hardcoded** — neprispieva do custom-nav.ts
9. **i18n cez next-intl** — openvpm-ai používa vlastný `useI18n()` hook
10. **Settings tab je nefunkčný** — len vizuálne dropdowny bez backendu

---

## 2. Návrh implementácie v openvpm-ai

### Architektúra

```
openvpm-ai/
├── packages/db/schema/
│   └── ext_voice.ts                    # Schéma: voice_dictations tabuľka
├── apps/web/
│   ├── server/routers/extensions/
│   │   ├── voice.ts                    # tRPC router: transcribe, save, list, get, delete
│   │   └── index.ts                    # Registrácia voice routeru
│   ├── lib/voice/
│   │   ├── transcription.ts            # Server-side STT (Gemini audio transcription)
│   │   ├── soap-formatter.ts           # AI prompt: transkripcia → SOAP štruktúra
│   │   └── retention.ts                # GDPR: 24h auto-delete surového audia
│   ├── config/
│   │   └── custom-nav.ts              # Pridať nav položku
│   ├── messages/sk.json               # i18n kľúče
│   └── app/(dashboard)/agent/voice/
│       └── page.tsx                    # Nová stránka
```

### 2a. Schéma: `packages/db/schema/ext_voice.ts`

```typescript
import { pgTable, pgEnum, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { users } from "./users";
import { appointments } from "./scheduling";

export const voiceDictationStatusEnum = pgEnum("voice_dictation_status", [
  "RECORDING",       // Klient nahráva
  "TRANSCRIBING",    // Server transkribuje audio
  "FORMATTING",      // AI formátuje do SOAP
  "COMPLETED",       // Hotové, uložené
  "FAILED",          // Chyba
]);

export const voiceDictations = pgTable(
  "voice_dictations",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id").notNull().references(() => practices.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    dictatedBy: uuid("dictated_by").notNull().references(() => users.id),

    // Audio
    audioFileKey: text("audio_file_key"),          // S3/R2 key pre surové audio
    audioMimeType: text("audio_mime_type"),         // "audio/webm" | "audio/mp4"
    audioDurationSeconds: text("audio_duration_seconds"),

    // Transkripcia
    modelId: text("model_id").notNull(),            // "gemini-3.7-flash"
    rawTranscript: text("raw_transcript"),          // Surová transkripcia z STT
    language: text("language").default("sk"),       // Jazyk diktovania

    // SOAP výstup
    subjective: text("subjective"),
    objective: text("objective"),
    assessment: text("assessment"),
    plan: text("plan"),
    rawAiResponse: jsonb("raw_ai_response"),        // Kompletná AI odpoveď

    // Stav
    status: voiceDictationStatusEnum("status").notNull().default("RECORDING"),
    errorMessage: text("error_message"),
    transcribedAt: timestamp("transcribed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // GDPR: audio sa automaticky maže po 24 hodinách
    audioDeletedAt: timestamp("audio_deleted_at", { withTimezone: true }),
  },
  (table) => ({
    practiceIdx: index("voice_dictations_practice_idx").on(table.practiceId, table.deletedAt),
    patientIdx: index("voice_dictations_patient_idx").on(table.practiceId, table.patientId, table.deletedAt),
    statusIdx: index("voice_dictations_status_idx").on(table.practiceId, table.status, table.deletedAt),
  }),
);

export const voiceDictationsRelations = relations(voiceDictations, ({ one }) => ({
  practice: one(practices, { fields: [voiceDictations.practiceId], references: [practices.id] }),
  patient: one(patients, { fields: [voiceDictations.patientId], references: [patients.id] }),
  appointment: one(appointments, { fields: [voiceDictations.appointmentId], references: [appointments.id] }),
  dictator: one(users, { fields: [voiceDictations.dictatedBy], references: [users.id] }),
}));
```

**Prečo vlastná tabuľka**: Audio diktovanie je samostatná doménová entita s vlastným lifecycle. SOAP note sa vytvorí až po potvrdení používateľom — dovtedy je diktovanie "draft".

### 2b. Router: `apps/web/server/routers/extensions/voice.ts`

```typescript
export const voiceRouter = createRouter({
  // 1. Vytvorí záznam o diktovaní a vráti upload URL pre audio
  start: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .use(requireFeature("agent"))
    .input(z.object({
      patientId: z.string().uuid(),
      appointmentId: z.string().uuid().optional(),
      language: z.string().default("sk"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Vytvorí záznam so statusom RECORDING
      // Vráti { dictationId, uploadUrl }
    }),

  // 2. Potvrdí upload audia a spustí transkripciu + SOAP formátovanie
  process: protectedProcedure
    .input(z.object({ dictationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // 1. Načíta audio z objektového úložiska
      // 2. Transkribuje cez Gemini audio understanding
      // 3. Formátuje transkripciu do SOAP štruktúry
      // 4. Uloží výsledok
      // 5. Naplánuje 24h skartáciu audia
    }),

  // 3. Vráti detail diktovania (vrátane SOAP sekcií)
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => { /* ... */ }),

  // 4. Zoznam diktovaní pre pacienta
  listByPatient: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => { /* ... */ }),

  // 5. Uloží potvrdený SOAP note do records (vytvorí skutočný soapNote záznam)
  saveAsSoapNote: protectedProcedure
    .input(z.object({
      dictationId: z.string().uuid(),
      subjective: z.string(),
      objective: z.string(),
      assessment: z.string(),
      plan: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Vytvorí záznam v soapNotes tabuľke (vanilla tabuľka, cez records router)
      // Označí diktovanie ako COMPLETED
    }),

  // 6. Zmaže diktovanie (soft delete)
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),
});
```

### 2c. Server-side AI pipeline

**`lib/voice/transcription.ts`** — Gemini audio transcription:
```typescript
import { generateText } from "ai";
import { configuredModel } from "@/lib/agent/runner";
import { readPrimaryObject } from "@/lib/s3";

const STT_SYSTEM_PROMPT = `Transkribuj slovenské veterinárne diktovanie.
Používaj oficiálnu veterinárnu terminológiu ŠVPS SR.
Zachovaj všetky číselné hodnoty (teplota, dávky, hmotnosť).
Vráť čistý text bez komentárov.`;

export async function transcribeAudio(fileKey: string): Promise<string> {
  const object = await readPrimaryObject(fileKey, { maxBytes: 25 * 1024 * 1024 });
  if (object.status !== "available") throw new Error("Audio not found");

  const base64Audio = Buffer.from(object.body).toString("base64");
  const mimeType = object.contentType ?? "audio/webm";

  const result = await generateText({
    model: configuredModel(),
    system: STT_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Transkribuj toto audio." },
        { type: "file", data: base64Audio, mimeType },
      ],
    }],
  });

  return result.text.trim();
}
```

**`lib/voice/soap-formatter.ts`** — Transkripcia → SOAP:
```typescript
const SOAP_FORMAT_PROMPT = `Si veterinárny asistent. Analyzuj transkripciu diktovania a rozdeľ ju do 4 sekcií SOAP.
Vráť JSON s presne týmito kľúčmi: { "subjective", "objective", "assessment", "plan" }

Pravidlá:
- Subjektívne: čo majiteľ popisuje, anamnéza, sťažnosti
- Objektívne: fyzikálne vyšetrenie, teplota, hmotnosť, palpácia, auskultácia
- Diagnóza (Assessment): pracovná diagnóza, diferenciálne diagnózy
- Plán: predpísané lieky, dávky, diéta, kontrola, ďalšie vyšetrenia

Ak sekcia nemá obsah, vráť prázdny string "".
Odpovedz výhradne v slovenčine s veterinárnou terminológiou.`;

export async function formatTranscriptToSoap(transcript: string): Promise<SoapSections> {
  // generateText s JSON output mode
  // Parse a validácia Zod schémou
}
```

**`lib/voice/retention.ts`** — GDPR 24h skartácia:
```typescript
import { deleteFile } from "@/lib/s3";

// Cron job alebo scheduled task
export async function purgeExpiredAudio() {
  // Nájsť voice_dictations kde:
  //   audioDeletedAt IS NULL
  //   AND completedAt < NOW() - INTERVAL '24 hours'
  // Pre každý:
  //   1. deleteFile(audioFileKey)
  //   2. UPDATE voice_dictations SET audioDeletedAt = NOW(), audioFileKey = NULL
}
```

### 2d. Stránka: `apps/web/app/(dashboard)/agent/voice/page.tsx`

**Rozdelenie do komponentov** (nie monolit):

```
voice/
├── page.tsx                 # Hlavná stránka (layout + state orchestrácia)
├── components/
│   ├── recording-button.tsx # Mikrofón tlačidlo + animácia + timer
│   ├── patient-selector.tsx # Znovupoužije trpc.patients.search
│   ├── transcript-view.tsx  # Zobrazenie transkripcie + editácia
│   ├── soap-preview.tsx     # Náhľad SOAP sekcií pred uložením
│   └── history-list.tsx     # Zoznam predchádzajúcich diktovaní
```

**Key UX flow:**
1. Vyberie pacienta (rovnaký pattern ako imaging page)
2. Stlačí "Nahrávať" → MediaRecorder API → audio chunks
3. Stlačí "Stop" → upload cez `/api/upload` (kategória `patient-photos`) → tRPC `voice.start` + `voice.process`
4. Zobrazí sa transkripcia a SOAP návrh (4 editovateľné polia)
5. Veterinár upraví → "Uložiť do záznamov" → tRPC `voice.saveAsSoapNote`
6. História diktovaní pre vybraného pacienta

**Dôležité zmeny oproti OpenVPM:**
- Žiadne taby "Commands" a "Settings" — zbytočné
- Real-time Web Speech API sa použije len ako preview — finálna transkripcia vždy server-side
- Audio sa uploaduje na server, nie je base64 v pamäti
- SOAP output je štruktúrovaný JSON, nie voľný text

### 2e. Registrácia a navigácia

**`extensions/index.ts`**: Pridať `voice: voiceRouter`
**`custom-nav.ts`**: Pridať položku:
```typescript
{
  href: "/agent/voice",
  label: "Hlasové diktovanie",
  i18nKey: "nav.agentVoice",
  icon: Mic,
  roles: ["admin", "veterinarian"],
}
```
**`messages/sk.json`**: `nav.agentVoice` už existuje (riadok 1769)

---

## 3. Väzby na existujúcu infraštruktúru openvpm-ai

| Komponent | openvpm-ai | Použitie |
|-----------|-----------|----------|
| `configuredModel()` | `lib/agent/runner.ts` | Gemini model pre STT aj SOAP formátovanie |
| `readPrimaryObject()` | `lib/s3.ts` | Čítanie audia z objektového úložiska |
| `deleteFile()` | `lib/s3.ts` | GDPR skartácia audia |
| `/api/upload` | `app/api/upload/route.ts` | Upload audio súboru (kategória `patient-photos`) |
| `trpc.patients.search` | `server/routers/patients.ts` | Vyhľadávanie pacienta |
| `soapNotes` tabuľka | `packages/db/schema/clinical.ts` | Finálne uloženie SOAP note (vanilla, nepridávame) |
| `records.createSoapNote` | `server/routers/records.ts` | tRPC mutation pre uloženie SOAP (použijeme) |
| `requireFeature("agent")` | `server/trpc.ts` | Feature gate pre AI funkcie |
| `ai.ts` router | `server/routers/ai.ts` | Existujúci `draftSoapNote` — možno rozšíriť o voice input |

---

## 4. Čo sa NEMENÍ (Zero-Conflict)

- ❌ `soapNotes` tabuľka — nepridávame stĺpce
- ❌ `records.ts` router — nemeníme existujúce mutácie
- ❌ `ai.ts` router — nemeníme `draftSoapNote`
- ❌ `_app.ts` — už mountuje `extensions: extensionsRouter`
- ❌ `sidebar.tsx` — už concat-uje `customNavItems`
- ❌ Žiadne vanilla schémy, žiadne vanilla routery

Jediné zmeny:
1. Nový `ext_voice.ts` (schéma)
2. Nový `extensions/voice.ts` (router)
3. Jeden riadok v `extensions/index.ts` (registrácia)
4. Jedna položka v `custom-nav.ts` (navigácia)
5. Nový `app/(dashboard)/agent/voice/` (page)
6. Nový `lib/voice/` (AI pipeline)

---

## 5. Kľúčové rozhodnutia

1. **Server-side STT, nie Web Speech API** — Gemini audio understanding je presnejší, podporuje slovenčinu, nezávisí od prehliadača. Web Speech API sa použije len ako real-time preview (voliteľné).

2. **Audio perzistencia** — surové audio sa ukladá do objektového úložiska (S3/R2) cez existujúci upload endpoint. Umožňuje replay, audit a re-transkripciu.

3. **Štruktúrovaný SOAP output** — AI vracia JSON `{ subjective, objective, assessment, plan }`, nie voľný text. Validácia Zod schémou.

4. **24h GDPR skartácia** — cron job maže surové audio po 24 hodinách. Transkripcia a SOAP note zostávajú (sú klinickým záznamom). `audioDeletedAt` timestamp zaznamenáva skartáciu.

5. **Dvojstupňové uloženie** — diktovanie je najprv "draft" (transkripcia + SOAP návrh). Veterinár musí explicitne potvrdiť "Uložiť do záznamov". Až vtedy sa vytvorí záznam v `soapNotes` tabuľke.

6. **Model** — `gemini-3.7-flash` (podľa memory: gemini-model-name-standardization). Podporuje audio input natívne.

---

## 6. Implementačné kroky

1. `packages/db/schema/ext_voice.ts` — schéma
2. `packages/db/schema/index.ts` — export
3. `apps/web/lib/voice/transcription.ts` — STT pipeline
4. `apps/web/lib/voice/soap-formatter.ts` — SOAP formátovanie
5. `apps/web/lib/voice/retention.ts` — GDPR skartácia
6. `apps/web/server/routers/extensions/voice.ts` — tRPC router
7. `apps/web/server/routers/extensions/index.ts` — registrácia
8. `apps/web/config/custom-nav.ts` — navigácia
9. `apps/web/app/(dashboard)/agent/voice/page.tsx` — stránka + komponenty
10. `apps/web/messages/sk.json` — i18n (nav.agentVoice už existuje)
11. `apps/web/server/__tests__/voice.test.ts` — testy
12. `pnpm db:push` — migrácia
