# Arena Sprint 16: Clinical AI Voice Dictation & Ambient Scribe `/agent/voice`

> **Mission for Arena Agent:**
> Analyze, audit, improve, and fix bugs in veterinary ambient scribing, real-time voice dictation, and clinical SOAP extraction:
> `apps/web/app/(dashboard)/agent/voice/page.tsx` (~1,431 lines).
> This is a **presentation, audio pipeline resilience, and UI Kit harmonization sprint**.
> Do not alter transcription STT endpoints, Whisper prompts, or GDPR audio retention lifecycle rules.
> Zero new ESLint warnings, 0 type errors, 100% bilingual (SK/EN) i18n leaf symmetry, all pinned tests green.

> **Independence:**
> Touches strictly `apps/web/app/(dashboard)/agent/voice/page.tsx`.
> Does not touch `app/api/transcribe/route.ts` or `server/routers/extensions/ai-scribe.ts`.

---

## 0. Preflight

1. `git status` clean on your working branch.
2. Read `AGENTS.md` (§5 Clinical Safety, §7 GDPR), `docs/UIKIT.md`, and `components/layout/page-kit.tsx`.
3. Facts verified in the repo:
   - Slovak Veterinary Law (Zákon 39/2007 Z. z.) mandates all AI SOAP notes remain in `draft` status until signed by a licensed KVL veterinarian.
   - Zákon 139/1998 Z. z. prohibits automatic prefill of controlled substances (opiates, ketamine, propofol, butorphanol, fentanyl) from voice transcripts.
   - GDPR 24h retention: raw audio buffers must be discarded from client memory and temporary storage within 24 hours.
   - `agent/voice/page.tsx` currently lacks `pageShellClass`, `PageToolbar`, and standard `DataTableFrame` structures.
4. Baseline test command (must pass BEFORE editing):
   `pnpm --filter @openpims/web exec vitest run lib/__tests__/i18n-structure.test.ts`

---

## 1. DO NOT TOUCH / ALREADY COMPLETED

- **Standard non-negotiables:** Never modify `ClinicalDiffConfirmModal`, controlled substances zero-prefill, sympathy-gate suppression, `packages/db/schema/*.ts`, or `_journal.json`.
- **Audio Privacy & Retention (AGENTS.md §7):**
  - Raw audio buffers must never be persisted permanently in local storage or client state.
  - Telemetry logs must never contain transcript PII (owner names, patient details).
- **Controlled Substances Gate (AGENTS.md §5):**
  - If a controlled substance is detected in speech, the extracted dosage/unit fields must remain blank for manual entry.

---

## 2. Architectural Rules (Analyze → Audit → Improve → Fix Bugs → Verify)

1. **Phase 1: Analyze & Recon**
   - Trace the microphone recording lifecycle: WebAudio MediaStream → AudioContext analyser (waveform visualization) → audio chunks buffer → STT transcription → SOAP structured draft.
2. **Phase 2: Audit & Findings**
   - Audit microphone permission errors: verify that user denial or lack of microphone hardware displays an informative alert card with browser permission instructions.
   - Audit background tab switching: ensure audio recording does not hang or produce corrupt WAV/WebM headers when the browser tab loses focus.
   - Audit empty states: verify that previous dictation sessions display a clean `EmptyState` when no history exists.
3. **Phase 3: Fix Bugs & Hardening**
   - Clean up MediaStream tracks and close AudioContext on component unmount or recording stop to prevent red recording indicator remaining stuck in browser tab.
   - Handle network timeout during transcription gracefully with an actionable retry button without losing the recorded buffer.
   - Ensure audio waveform visualizer adjusts smoothly to dark/light theme tokens.
4. **Phase 4: UI Kit Harmonization**
   - Wrap the page in `pageShellClass`.
   - Wrap recording controls and session filters in `PageToolbar`.
   - Wrap previous dictation history and SOAP extraction previews in `DataTableFrame`.
   - Harmonize KPI summary cards using `KpiGrid` and `KpiCard`.
5. **Phase 5: Verification**
   - Run Vitest suite, scan i18n, type-check.

---

## 3. Detailed Requirements

### 3A. Layout & Header
- Apply `pageShellClass` to the outer wrapper.
- Use canonical `PageHeader` with title and subtitle.
- Use `PageToolbar` for recording mode selection (Live Ambient vs Dictation vs File Upload).

### 3B. Voice Recorder & Extraction Frame
- Standardize audio controls (Record, Pause, Stop, Process) with semantic design tokens.
- Wrap session logs and structured note drafts in `DataTableFrame`.
- Ensure extracted SOAP fields have clear `Draft` indicators and confirmation action.

---

## 4. Tests

Create `apps/web/lib/__tests__/voice-scribe-pagekit.test.ts` to assert:
- `pageShellClass` and `DataTableFrame` presence in `agent/voice/page.tsx`.
- Presence of controlled substance warning markers and statutory draft indicators.

---

## 5. i18n

- Ensure all recording statuses, microphone error messages, and clinical draft labels exist symmetrically in `en.json` and `sk.json`.

---

## 6. Verification Suite

Run:
```bash
pnpm --filter @openpims/web exec vitest run lib/__tests__/voice-scribe-pagekit.test.ts lib/__tests__/i18n-structure.test.ts
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web i18n:scan
```

---

## 7. Definition of Done

- [ ] AudioContext cleanup verified on unmount.
- [ ] Controlled substance zero-prefill and draft status badges preserved.
- [ ] `pageShellClass`, `PageToolbar`, and `DataTableFrame` adopted.
- [ ] 100% bilingual leaf symmetry.
- [ ] Type-check passes with 0 errors.
