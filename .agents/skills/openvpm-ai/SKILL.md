---
name: openvpm-ai
description: Architectural guidelines, zero-conflict upstream sync, strict i18n rules, and Slovak veterinary compliance for OpenVPM AI.
---

# OpenVPM AI Development Guidelines & Skill

This skill enforces core architectural rules, zero-conflict upstream synchronization, multilingual stability, and veterinary clinical safety gates for OpenVPM AI.

## 1. Architectural Guardrails (Zero-Conflict Upstream Sync)

- **Do NOT modify vanilla tables directly:**
  Never alter existing upstream table definitions in `packages/db/schema/*.ts`.
- **Isolated `ext_*` Schemas:**
  All new tables and enums MUST live in `packages/db/schema/ext_{name}.ts` (e.g., `ext_ekasa.ts`, `ext_imaging.ts`, `ext_statutory.ts`). Export them via wildcard in `packages/db/schema/index.ts`:
  ```ts
  export * from "./ext_ekasa";
  export * from "./ext_imaging";
  ```
- **Database Migrations via `pnpm db:push`:**
  Always use `pnpm db:push` for development schema updates to keep the upstream migration journal `_journal.json` pristine.
- **Single tRPC Mount Point:**
  Mount all custom extension routers inside `apps/web/server/routers/extensions/` and attach under `extensions: extensionsRouter` in `apps/web/server/routers/_app.ts`:
  ```ts
  trpc.extensions.ekasa.*
  trpc.extensions.imaging.*
  ```
- **Modular Navigation via `custom-nav.ts`:**
  Do NOT modify `sidebar.tsx` directly to hardcode links. Instead, add items to `apps/web/config/custom-nav.ts`.

## 2. Strict Multilingual Compatibility (i18n)

- **No Route Rewriting:**
  Do NOT add `app/[locale]/...` URL path prefixes. URLs must remain clean and canonical (`/schedule`, `/billing`, `/patients`, `/records`, `/agent/imaging`).
- **English as Safe Fallback:**
  If a translation key is missing in `messages/sk.json`, it must fall back cleanly to `messages/en.json` or inline default text. Maintain 100% dictionary symmetry between `en.json` and `sk.json`.
- **Modular i18n Architecture:**
  All i18n logic lives in `apps/web/lib/i18n/`, `apps/web/components/i18n/`, and `apps/web/messages/`.
- **`useI18n()` Hook Usage:**
  Always use `const { t } = useI18n();` with dot notation and parameters:
  ```ts
  t("nav.agentImaging", "Image Analysis")
  t("patients.count", "{count} patients", { count: 5 })
  ```

## 3. Clinical & Safety Gates (Veterinary Ethics)

- **Sympathy Flow Safety Gate (Euthanasia / Deceased Patient Protection):**
  When a patient's status is `deceased` or after a recorded euthanasia, the system MUST strictly block:
  - Automated vaccination and care reminder SMS messages.
  - Automated post-discharge review requests ("Google Review Ask").
  - Promotional or re-engagement notifications.
  Instead, the system creates an internal staff condolence task.
- **Medical Imaging File Ownership:**
  Medical imaging uploads (`xray`, `ct`, `mri`, `ultrasound`, `photo`) must use category `"imaging"` and attach to the patient record WITHOUT overwriting `patient.photoUrl`.
- **Legal Statutory Registers (ŠVPS SR & KVL SR):**
  Compliance with Slovak veterinary legislation (Law 39/2007 Z. z. and Law 139/1998 Z. z.):
  - Rabies Register (Kniha besnoty) with 3-day notification window to RVPS.
  - Treatment Diary (Kniha ošetrení) with withdrawal period (ochranná lehota) tracking.
  - Euthanasia Register with exact dosing and rendering plant disposal records.
  - Controlled Substances Register (Opiates & psychotropic substances).
  - Informed consent protocols (Anesthesia, Surgery, Hospitalization, Euthanasia).

## 4. AI Agent & Inference Standards

- **Multimodal Inference:**
  Use `configuredModel()` or inference proxy with Vercel AI SDK (`generateText`).
- **Storage Direct Reads:**
  Always load medical files directly from object storage via `readPrimaryObject(file.fileKey)` from `@/lib/s3`. Never perform HTTP self-fetch loops against `/api/files/...`.
- **GDPR 24-Hour Voice Purge:**
  Raw audio files used for voice transcription and SOAP drafting must be scheduled for deletion within 24 hours.
