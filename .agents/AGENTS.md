# OpenVPM AI — Agent Rules

These rules are automatically loaded for every agent interaction in this workspace.
For full architectural context, examples, and Slovak legislation references, read the
[openvpm-ai skill](file:///c:/Users/marek/Documents/Vet/openvpm-ai/.agents/skills/openvpm-ai/SKILL.md).

---

## 1. Secrets & Credentials Safety

- **NEVER** commit, copy, log, or hardcode any secret: API keys, tokens, passwords,
  private keys, connection strings with credentials, or encryption keys.
- All secrets belong **exclusively** in `.env` (gitignored) or environment variables.
- Code that needs a secret MUST use `process.env.VARIABLE_NAME` — never a literal value.
- Before `git add` / `git commit`, verify staged files do NOT contain patterns:
  `sk_`, `pk_`, `key-`, `-----BEGIN`, `Bearer ey`, `token=`, `password=`, `secret=`,
  `ANTHROPIC_API_KEY=sk-`, `TELNYX_API_KEY=KEY`, `STRIPE_SECRET_KEY=sk_`,
  `IDEXX_API_KEY=`, `ANTECH_API_KEY=`, `ZOETIS_API_KEY=`.
- `.env`, `.env.local`, `.env.*.local` are in `.gitignore` — **never** remove them.
- When introducing a new environment variable, add a **placeholder** (empty value) to
  `.env.example` with a descriptive comment. Never put real values into `.env.example`.
- OAuth tokens (Google Business Profile, Facebook, Instagram, YouTube) stored in
  `ext_channel_accounts` MUST be encrypted at rest and NEVER exposed over tRPC APIs.

---

## 2. Git Commit Hygiene

- Before every commit, run `git diff --staged` and review the output.
- **Never commit:**
  - Files containing PII (client names, patient UUIDs, phone numbers, real email addresses)
  - Debug `console.log` / `console.error` statements that print sensitive data
  - `node_modules/`, `.next/`, `.env`, `.mcp.json`, or any file listed in `.gitignore`
  - One-off migration scripts from `apps/web/scripts/` (gitignored for GDPR reasons)
  - Production database dumps, JSON exports with real data, or screenshot artifacts
- Commit messages should be descriptive and in English.

---

## 3. Architectural Guardrails (Zero-Conflict Upstream Sync)

- **Do NOT modify** vanilla upstream table definitions in `packages/db/schema/*.ts`.
- All new tables/enums go into `packages/db/schema/ext_{name}.ts` files only.
- Schema changes via `pnpm db:push` — never modify `_journal.json`.
- Custom tRPC routers go under `apps/web/server/routers/extensions/` and mount
  via `extensions: extensionsRouter` in `_app.ts`.
- Navigation items go into `apps/web/config/custom-nav.ts` — do NOT edit `sidebar.tsx` directly.
- When merging from upstream (`https://github.com/evangauer/openvpm.git`):
  1. Verify vanilla schemas remain untouched.
  2. Re-verify 100% i18n dictionary symmetry.
  3. Run: `pnpm --filter @openpims/web type-check`
- **Upstream-Backport-Aware Coding:** We actively contribute improvements back to
  the upstream OpenVPM project. Write code with this in mind:
  - Features touching **vanilla files** (components, hooks, routers outside `extensions/`)
    must be written generically — no Slovak-specific, clinic-specific, or AI-specific
    logic hardcoded into upstream-shared code paths.
  - When a feature benefits both OpenVPM AI and vanilla OpenVPM, implement the generic
    part in vanilla files and the SK/AI-specific part in `ext_*` schemas or `extensions/`
    routers, so the generic part can be cleanly cherry-picked upstream.
  - Bug fixes and improvements to vanilla upstream code should be self-contained,
    well-tested commits that can be submitted as PRs to the upstream repo without
    carrying OpenVPM AI dependencies.

---

## 4. Strict i18n (Multilingual Compatibility)

- Maintain **100% key symmetry** between `apps/web/messages/en.json` and `apps/web/messages/sk.json`.
- **Zero hardcoded text in JSX/TSX** — all user-facing strings via `useI18n()`:
  ```ts
  const { t } = useI18n();
  t("section.key", "Fallback text", { param })
  ```
- Use nested JSON objects for keys (`nav: { item: "..." }`), never dotted root-level
  strings (`"nav.item": "..."`).
- tRPC server routers throw **English** error messages; localization happens on the client only.
- No `app/[locale]/...` URL path prefixes — URLs remain clean and canonical.
- **Conscientious, Independent Translation Quality:**
  - EN and SK translations must each be **authored independently as native-quality text**.
    SK is NOT a mechanical translation of EN — it must read naturally to a Slovak
    veterinarian (correct declension, professional terminology, natural word order).
  - EN must read naturally to an English-speaking vet — not as a back-translation from SK.
  - When adding or updating i18n keys, write **both** translations thoughtfully in the
    same commit. Never leave one language as a placeholder or copy of the other.
  - Use correct Slovak veterinary terminology: "Kniha ošetrení" (not "Treatment Book"),
    "ochranná lehota" (not "withdrawal period" translated literally), "očkovací preukaz"
    (not "vaccination card").
  - Avoid machine-translation artifacts: unnatural word order, missing diacritics,
    incorrect grammatical gender, or literal calques from English.

---

## 5. Clinical & Safety Gates (Slovak Veterinary Law)

- **Human-in-the-loop (Zákon 39/2007 Z. z. §3):** AI is strictly an assistant. AI drafts
  MUST remain in `draft` status until reviewed and signed by a licensed KVL veterinarian
  via `ClinicalDiffConfirmModal`.
- **Zero AI prefill for controlled substances (Zákon 139/1998 Z. z.):** Opiates, ketamine,
  propofol, butorphanol, fentanyl — the system must blank out AI proposals and require
  manual, authenticated entry.
- **Sympathy Gate:** When a patient is `deceased`, immediately suppress all automated
  outreach (reminders, review asks, promotions). Log to `ext_automation_suppression_log`.
- **Clinical claims in marketing** require `clinicalApprovalCheck` + approving vet UUID.
- **Medical imaging** uses category `"imaging"` — never overwrite `patient.photoUrl`.

---

## 6. Next.js 15 & React 19 Runtime

- `optimizePackageImports` in `next.config.js` — **production only** (causes HMR crashes in dev).
- Service Workers **never** register on `localhost`. Gate with production + hostname check.
- Theme-dependent rendering must use a `mounted` state guard to prevent hydration mismatch.
- All `<table>` elements in dashboard/portal must be wrapped in `overflow-x-auto` or `<TableScroll>`.

---

## 7. GDPR & Data Protection

- **Voice audio retention:** Raw audio for voice transcription must be deleted within 24 hours.
- **Suppression logging:** All suppressed messages logged to `ext_automation_suppression_log`
  with reason codes (`sympathy_gate`, `quiet_hours`, `sms_rate_limit`, `opt_out`, `frequency_cap`).
- Legal basis: `contract` for transactional reminders; `consent` / `legitimate_interest` for campaigns.
- One-off ops scripts (`apps/web/scripts/`) contain production UUIDs and PII — they are
  gitignored and must never be committed.

---

## Development Environment Quick Reference

| | Primary (Active Development) | Reference (Upstream Vanilla) |
|---|---|---|
| Path | `C:\Users\marek\Documents\Vet\openvpm-ai` | `C:\Users\marek\Documents\Vet\OpenVPM` |
| Port | 3001 | 3005 |
| Database | Docker `openvpm-postgres-1`, port 5434, DB `openvpm_ai` | — |
