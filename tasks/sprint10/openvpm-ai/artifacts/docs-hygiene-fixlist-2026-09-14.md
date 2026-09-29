# Docs Hygiene Fixlist — 2026-09-14 (Updated)

**Repo:** `badmarsh/openvpm-ai`  
**Commit audited:** `301d3d74d7b68fc6d43912d580b5bf0a4e639eb2`  
**Report:** `artifacts/docs-hygiene-report-2026-09-14.md`

---

## P0 — Fix immediately (correctness / broken navigation)

- [x] **Fix broken link in `docs/clinic-pilot-readiness.md`** [COMPLETED ✅]  
  Changed `docs/production-readiness/GAP_ANALYSIS_POST_PILOT_READY.md` → `production-readiness/GAP_ANALYSIS_POST_PILOT_READY.md`.

- [ ] **Add `[0.6.0]` entry to `CHANGELOG.md`**  
  ROADMAP.md declares v0.6 PILOT-READY as of 2026-09-12 but CHANGELOG has no corresponding version entry. Add `[0.6.0] - 2026-09-13` capturing the v0.6 milestone items (CRSZ, CEHZ, ÚPVS, PetExpert payload, audit chain hardening, RLS test suite, clinical eval harness, portal PWA).

---

## P1 — Fix soon (low-risk mechanical)

- [ ] **Add `website-builder.md` to `docs/help/README.md`** (both EN and SK sections)  
  EN: `- [Clinic Website Builder](en/website-builder.md) — drag-and-drop website editor, brand kit, publishing`  
  SK: `- [Webová stránka kliniky](sk/website-builder.md)`

- [ ] **Add `website-builder.md` to `ROADMAP.md`** documentation section (9 → 10 topics per language)

- [x] **Clarify MVDr. Martin Sýkora / VetSykora in README and ROADMAP** [COMPLETED ✅]  
  Updated README and ROADMAP: Súkromná veterinárna klinika MVDr. Martin Sýkora (Kvetná 3, 979 01 Rimavská Sobota, vetsykora.sk) is the first real pilot client of OpenVPM AI.

- [x] **Add "superseded by" banner to `docs/9.3-correctness-closure-audit.md`** [COMPLETED ✅]

- [x] **Add "superseded by" banner to `docs/pilot-readiness-audit.md`** [COMPLETED ✅]

- [x] **Add "superseded by" banner to `docs/pilot-readiness-plan.md`** [COMPLETED ✅]

- [ ] **Create `packages/api/README.md`** (stub — see report §8 for content)

- [ ] **Create `packages/config/README.md`** (stub — see report §8 for content)

- [ ] **Create `packages/db/README.md`** (stub — see report §8 for content)

- [ ] **Create `packages/email/README.md`** (stub — see report §8 for content)

- [ ] **Create `apps/web/README.md`** (stub — see report §8 for content)

- [ ] **Create `apps/docs/README.md`** (stub referencing Outline at `outline.dev.significa.sk`)

- [ ] **Create `artifacts/README.md`** (index of all artifact groups — draft in report §11)

---

## P2 — Propose / discuss with operator before acting

- [x] **Resolve `.claude/skills/openvpm-ai/SKILL.md` duplicate** [COMPLETED ✅]  
  `.agents/skills/openvpm-ai/SKILL.md` confirmed as authoritative (184 lines). `.claude/skills/openvpm-ai/SKILL.md` replaced with a redirect stub.

- [x] **Replace `@Evan` in CLAUDE.md and jira-operating-manual.md** [COMPLETED ✅]  
  Replaced with `@Marek` in both files.

- [x] **Document origin date for JSON artifacts** [COMPLETED ✅]  
  Confirmed generated on September 5, 2026.

- [ ] **Relocate `HANDOFF-voice-dictation.md`** → `docs/handoffs/voice-dictation-migration.md`  
  Feature shipped (v0.5.0), file has engineering reference value but doesn't belong at repo root.

- [ ] **Archive or delete `RICH_TEXT_IMPLEMENTATION.md`**  
  Legacy PR description from April 23, 2026 for TipTap integration. Ready to archive to `docs/handoffs/` or delete.

- [ ] **Resolve `docs/help/getting-started.md` (root-level) status**  
  Redirect stub → versioned files (`en/getting-started.md`, `sk/getting-started.md`), or keep as language-agnostic entry point.

- [x] **Address `apps/docs/` workspace stub** [RESOLVED ✅]  
  Documentation is hosted on Outline (`outline.dev.significa.sk`).

- [x] **Clarify `.qwen/tmp/` files** [RESOLVED ✅]  
  Local uncommitted scratch files from Qwen AI experiments; no action needed.

- [ ] **Fix CHANGELOG `[0.1.0]` em dash inconsistency** (cosmetic)  
  `[0.1.0] — unreleased baseline` uses `—` (em dash); other entries use `-` (hyphen-minus).
