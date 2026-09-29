# OpenVPM AI — Full Domain Feature Map, Docs-Reality Audit & User Manual Blueprint

> **Usage:** Paste everything below the cut line into a fresh GLM-5.3 orchestrator-agent
> session running at the repo root (`C:\Users\marek\Documents\Vet\openvpm-ai`), with
> subagent/parallel-task capability enabled. This is a **read + write-docs** mission:
> do not modify application source code, schema, or existing docs in place. All output
> is new files under a dedicated `artifacts/` folder (see §6).
>
> Companion prior-art files to read FIRST (do not duplicate their work — verify, extend,
> and cite them):
> - `artifacts/ux-codebase-analysis-2026-09-11.md` — system map, persona workflows,
>   GUI/interaction audit, friction log (F1-F10), ICE-scored roadmap.
> - `artifacts/ai-feature-audit.md` — AI/agent surface census and safety findings.
> - `artifacts/audit-prompts/ai-audit-prompt.md` — the sibling AI-safety prompt this
>   document is modeled on; reuse its grounding/tagging discipline.
>
> Anchor commit/date were NOT hardcoded here on purpose — state your own at run time
> (§0). This repo moves fast; treat every prior-art claim as something to re-verify,
> not something to assume still holds.

---

You are a senior product-documentation architect and applied software auditor with
experience in veterinary/medical practice-management systems, information architecture
for end-user manuals, and monorepo codebase archaeology (Next.js/tRPC/Drizzle stacks).

## MISSION

OpenVPM AI is a large, fast-moving Slovak veterinary PIMS monorepo. It has strong
internal engineering/compliance documentation (`docs/production-readiness/*`,
`docs/*.md`) and two prior deep-dive audits (system architecture, AI safety), but:

- **No built end-user manual exists.** `apps/docs` is an empty workspace stub
  (`package.json` only — no content). `docs/help/` has exactly 7 short files
  (`README.md`, `getting-started.md`, `your-day.md`, `ask-the-ai.md`,
  `client-portal.md`, `calendar-feed.md`, `your-data.md`) covering a small slice
  of a system with 25+ dashboard sections and 35+ tRPC domain routers.
- **No one has produced a complete, domain-by-domain functional inventory** covering
  every module (clinical, billing, inventory, lab, marketing, statutory compliance,
  integrations, import/export, etc.) — the two prior audits are architecture- and
  AI-safety-focused, not a full feature census.
- **No one has cross-checked every doc claim against the current code**, domain by
  domain, the way the AI-safety prompt did for the agent subsystem specifically.

Your job, in four parts:

1. **Map every function of OpenVPM AI, organized by domain** (clinical, scheduling,
   billing, inventory/pharmacy, lab/imaging, insurance, statutory compliance,
   import/export & migration, integrations & API, AI/agent, marketing &
   communications, admin/settings, auth/onboarding, reports, client portal, i18n —
   confirm/expand this list against the actual code; it is a hypothesis, not gospel).
2. **For every domain, audit the state of the information already written about it**
   (README.md, ROADMAP.md, CLAUDE.md, every `docs/*.md`, `docs/help/*`,
   `docs/production-readiness/*`, `.claude/skills/*`, `.agents/skills/*`) — implemented
   vs. partial vs. aspirational vs. stale/contradicted, with evidence.
3. **Propose a complete structure for a user manual** (uzivatelska prirucka) — the
   actual information architecture, not just a recommendation to "write one."
4. **Flag what doesn't make sense** — naming drift, duplicated concepts, orphaned
   features (built but no discoverable UI path), phantom features (UI/nav exists but
   the backing feature is stubbed or future-only), navigation/domain mismatches,
   sk/en inconsistencies — and say what should be reorganized.

---

## §0 ACCESS & GROUNDING PROTOCOL (governs everything, non-negotiable)

- State the commit hash (`git rev-parse --short HEAD`) or clone timestamp you are
  analyzing, at the top of every file you produce.
- Every claim gets a source tag, exactly as in `ai-audit-prompt.md`:
    - `[VERIFIED: path/to/file.ts:L42]` — you read this exact line/function
    - `[VERIFIED: path/to/file.ts]` — you read the file, no specific line
    - `[INFERRED]` — reasonable deduction, not directly seen
    - `[CLAIMED IN DOCS]` — from README/docs, not confirmed in code
    - `[UNVERIFIED — could not access]` — could not check at all
- Never state a finding as fact without a tag. A fabricated path or line number is
  worse than an honest "could not verify."
- Preserve this repo's existing honesty culture: README.md and ROADMAP.md already
  distinguish "MVP shipped" vs. "Phase 2 (v0.7)" vs. "future (v1.0)" vs. explicitly
  "simulated/shadow-run, not real production" (see the "Transparentny register
  technickeho dlhu" section of ROADMAP.md). Your feature map and manual outline MUST
  carry the same distinctions forward — never document a planned or simulated
  capability as if it is live today.


═══════════════════════════════════════════════════════
§1 DOMAIN LIST (starting hypothesis — verify against code first)
═══════════════════════════════════════════════════════

Before spawning subagents, the orchestrator MUST re-derive the domain list from:
`apps/web/server/routers/_app.ts` + `apps/web/server/routers/extensions/*`,
`apps/web/lib/*` subfolders, `apps/web/app/(dashboard)/*` route folders, and
`apps/web/config/custom-nav.ts`. Reconcile against this starting list, correct it,
and record the reconciliation (added/merged/split domains + why) in `INDEX.md`.

| # | Domain (hypothesis) | Representative anchors |
|---|---|---|
| 1 | Core Clinical / EMR | `records`, `encounters`, `templates`, `vitals`, `treatment-plans`, `recent-clinical-items` routers; `lib/records`, `lib/encounters` |
| 2 | Scheduling & Front Desk | `appointments`, `booking`, `waitlist`, `whiteboard` routers; `lib/scheduling`, `lib/booking`, `lib/calendar` |
| 3 | Clients & Client Portal | `clients`, `portal` routers; `lib/clients`, `lib/portal`; `app/portal/*` |
| 4 | Billing & Finance | `billing`, `subscription` routers; `lib/billing`, `lib/accounting`; e-Kasa (see #8) |
| 5 | Inventory & Pharmacy | `inventory`, `dosing`, `controlled-substances` routers; `lib/inventory`, `lib/dosing`, `lib/controlled-substances` |
| 6 | Lab & Imaging | `lib/lab`, `lib/imaging`; analyzer parsers; DICOM/imaging AI |
| 7 | Insurance | `insurance` router; `lib/insurance` (PetExpert, Generali/Union) |
| 8 | Slovak Statutory Compliance | KVEPIS/CRSZ/CEHZ/e-Kasa/ÚPVS; `lib/kvepis`, `lib/crsz`, `lib/ekasa`, `app/(dashboard)/statutory` |
| 9 | Import / Export & Migration | `migration-archive` router; `lib/csv`; wholesaler import (Cymedica/Pharmos/Samohýl/Henry Schein); `docs/migrating-to-openvpm.md`; backup/restore |
| 10 | Integrations & API / Webhooks | `api-keys`, `webhooks` routers; `app/api/v1/*`; `docs/api/README.md`; `/api-docs` |
| 11 | AI / Agent | `agent`, `ai` routers; `lib/agent`, `lib/ai`; voice dictation; already deep-audited in `ai-feature-audit.md` — verify + reference only |
| 12 | Marketing & Communications | `communications`, `messaging`, `care-reminders` routers; `lib/marketing`, `lib/communications`; `/marketing/*` (brand kit, plan, reviews, handouts, website, TV, automations, consents, media, wellness) |
| 13 | Admin & Settings | `admin`, `settings`, `data`, `dashboard` routers; `lib/admin`, `platform-admin.ts`, `/support`, `/admin/support` |
| 14 | Auth & Onboarding | `auth` router; `lib/auth*`; `demo-access.ts`, `demo-role-switcher.ts`; `/onboarding` |
| 15 | Reports | `reports` router; `lib/reports` |
| 16 | Wellness plans | `wellness` router (note: distinct from `/marketing/wellness` — confirm whether these are the same feature exposed twice, or two different features; this looks like exactly the kind of naming collision §4 asks you to flag) |
| 17 | i18n / Localization | `lib/i18n`, `components/i18n`, `messages/en.json` + `messages/sk.json`; `docs/I18N.md` |

Each domain's subagent scope should also note which `packages/db/schema/*.ts` files
back it, and whether it lives in vanilla schema or an `ext_*` extension (per
`.claude/skills/openvpm-ai/SKILL.md` zero-conflict rule) — this materially affects
whether a feature is "core OpenVPM" or an OpenVPM-AI/Slovak-market addition, which the
user manual should probably distinguish for readers coming from upstream OpenVPM.


═══════════════════════════════════════════════════════
§2 PER-DOMAIN SUBAGENT DELIVERABLE (one file per domain)
═══════════════════════════════════════════════════════

For each domain from §1, a dedicated subagent produces
`artifacts/feature-map-<date>/domains/<domain-slug>.md` containing:

### A. Feature inventory table
| Feature | Entry point(s) (route / tRPC procedure / REST path / agent tool) | Roles that can reach it | DB tables touched | Lifecycle state (per README/ROADMAP MVP-scope table) | Source tag |

### B. Import / Export specifics (only if the domain has any)
What can be imported or exported, in what format, from which screen or endpoint,
whether a dry-run/preview exists before committing (README explicitly claims
"Every import shows a dry run first" in `docs/help/README.md` — verify this per
importer: CSV client/pet import, wholesaler delivery-note import, lab analyzer
import, migration-archive import, backup/restore export). Flag any importer that
does NOT show a dry run if the claim implies all of them do.

### C. Integration specifics (only if the domain has any)
External system, protocol/format, and — critically for this repo — **certification
reality**: cross-check against ROADMAP.md's own "Transparentny register technickeho
dlhu" (KVEPIS B2G not yet live, e-Kasa hardware-supported-but-not-certified, no real
production clinic yet, lab connectors are parsers not live API integrations). Your
domain file must state plainly, per integration, whether it is: live & certified /
functionally complete but uncertified or unsubmitted / simulated only / parser-only.

### D. Docs-vs-reality pass
For every sentence touching this domain in README.md, ROADMAP.md, CLAUDE.md, the
relevant `docs/help/*.md`, any matching `docs/*.md`, and any matching
`docs/production-readiness/*.md` file: mark
`IMPLEMENTED-VERIFIED` / `IMPLEMENTED-PARTIAL` / `ASPIRATIONAL-ONLY` /
`STALE-OR-CONTRADICTED-BY-CODE`, with the source tag from §0. Quote the doc claim
briefly (paraphrase, not verbatim) and cite the code that confirms or contradicts it.

### E. Friction / "doesn't make sense" notes for this domain
Naming inconsistencies (code vs. UI label vs. doc term), the domain's placement in
`custom-nav.ts` (right section? findable?), duplicate or overlapping concepts with
another domain (flag it even if you're not sure which domain "owns" it — that's a
finding in itself), dead-end UI (a feature with no way back / no clear next step),
UI present for a feature that's actually future/stubbed, and inconsistent sk/en
handling (e.g. hardcoded Slovak `label` strings in `custom-nav.ts` alongside an
`i18nKey` that may or may not actually control what's shown — verify which one wins).
Cross-reference `artifacts/ux-codebase-analysis-2026-09-11.md`'s Friction Log
(F1-F10) and ICE roadmap — if you rediscover one of those, cite it as confirmed
rather than re-numbering; if you find something new, assign it a new ID scoped to
your domain (e.g. `BILLING-01`).

### F. Proposed user-manual section(s) for this domain
Which persona(s) this serves (admin / veterinarian / technician / front_desk /
viewer / pet-owner-via-portal — the actual role enum, not invented personas).
A suggested outline (H2/H3 headings) in the style of the existing `docs/help/*.md`
files (short, plain-language, task-oriented, 1-2 minute reads) — but flag explicitly
if this domain is too complex/regulatory for that format (statutory compliance,
e-Kasa, controlled substances) and instead needs a longer reference-style document,
and say why.


═══════════════════════════════════════════════════════
§3 SUBAGENT ORCHESTRATION (how to run this with GLM-5.3 + subagents)
═══════════════════════════════════════════════════════

1. **Orchestrator pass (you, first):** read the three prior-art files listed at the
   top, re-derive the domain list (§1), create the output skeleton (§6), and write a
   short `RUN-NOTES.md` recording your commit hash, the reconciled domain list, and
   any domain merges/splits you made and why.
2. **Fan out:** spawn one subagent per reconciled domain, in parallel. Give each
   subagent: (a) its domain name and anchor paths, (b) the full §2 template, (c) the
   §0 grounding/tagging rules, (d) an explicit **read-only-on-app-code** constraint —
   subagents analyze and cite code; they never edit `apps/`, `packages/`, existing
   `docs/`, README.md, ROADMAP.md, or CLAUDE.md. Each subagent writes only its own
   `domains/<slug>.md` file and must not touch another domain's file.
3. **Collision handling:** if two subagents both claim a feature (e.g. `wellness`
   router vs. `/marketing/wellness`, or anything else that looks owned by two
   domains), do not let either subagent silently resolve it — both should flag it in
   their own file's §2.E, and the orchestrator resolves/merges it explicitly in the
   consolidation pass (§4), stating which domain now owns the manual section.
4. **Consolidation pass (you, last):** once every subagent file exists, read them
   all and produce the cross-domain deliverables in §4 below. Do not re-derive
   findings from scratch here — synthesize what the subagents already verified.

═══════════════════════════════════════════════════════
§4 CROSS-DOMAIN CONSOLIDATION (orchestrator, after all subagents finish)
═══════════════════════════════════════════════════════

### `artifacts/feature-map-<date>/FEATURE-INDEX.md`
One master table aggregating every domain's feature inventory (§2.A), sortable
mentally by domain then feature. This is the "what does OpenVPM AI actually do"
document — it should be usable on its own without opening every domain file.

### `artifacts/feature-map-<date>/DOCS-ACCURACY-INDEX.md`
One row per top-level doc file (README.md, ROADMAP.md, CLAUDE.md, every
`docs/*.md`, every `docs/help/*.md`, every `docs/production-readiness/*.md`) with a
one-line verdict (accurate / partially stale / significantly stale / aspirational)
and a link to the domain file(s) with the detailed evidence. Call out specifically
whether `docs/help/README.md`'s claim that "the same walkthroughs live inside the
app: open Settings and click Guides" is actually true today (find the in-app Guides
viewer, or confirm it doesn't exist yet).

### `artifacts/feature-map-<date>/USER-MANUAL-PROPOSAL.md`
The actual information-architecture proposal, not just a recommendation to write one:
- **Format decision with justification:** single manual vs. persona-specific manuals
  (e.g. a front-desk quick guide, a vet clinical guide, an admin/compliance manual,
  a pet-owner portal help center) — recommend one, and say why, given the existing
  `docs/help/*` precedent (short task-oriented pages) and the in-app Guides viewer.
- **Proposed file/folder layout** (e.g. under `docs/help/` or a new `docs/manual/`),
  and how each new page would surface inside the app's Settings → Guides viewer.
- **Full table of contents**, domain by domain, built from every §2.F proposal —
  resolve ordering, grouping, and persona-based navigation.
- **Coverage gap table:** for every domain, current state = zero coverage / partial
  coverage (which `docs/help/*` file touches it, incompletely) / fully covered.
- **Language strategy:** how the manual should handle the sk.json/en.json bilingual
  UI — is the manual sk-only, en-only, or parallel, and does that match how
  `docs/help/*` is written today (currently English prose describing a
  Slovak-labeled UI — confirm this mismatch and recommend a resolution).

### `artifacts/feature-map-<date>/REORGANIZATION-FINDINGS.md`
App-wide (not per-domain) structural findings: navigation clustering vs. the current
25 flat sidebar sections (verify `artifacts/ux-codebase-analysis-2026-09-11.md`'s F4
still holds), duplicate/overlapping domain names surfaced during collision handling
(§3.3), features that exist in code with no discoverable UI entry point ("orphaned"),
UI/nav entries whose backing feature is future-only or stubbed ("phantom"), and any
branding/naming leaks (e.g. verify whether F7's "VET.IS Cloud" string still exists).
Each finding gets an ID, severity, evidence, and a one-line suggested fix — do not
repeat full remediation specs here; that level of detail belongs in the domain files.


═══════════════════════════════════════════════════════
§5 STATE-OF-INFO TAGGING (reuse everywhere in §2.D and §4)
═══════════════════════════════════════════════════════

| Tag | Meaning |
|---|---|
| `IMPLEMENTED-VERIFIED` | Doc claim confirmed directly in working code you read |
| `IMPLEMENTED-PARTIAL` | Some of the claim is true; some is not (say which part) |
| `ASPIRATIONAL-ONLY` | Documented but no corresponding code found |
| `STALE-OR-CONTRADICTED-BY-CODE` | Doc claim is actively wrong given current code |

═══════════════════════════════════════════════════════
§6 OUTPUT LOCATION
═══════════════════════════════════════════════════════

```
artifacts/feature-map-<YYYY-MM-DD>/
  RUN-NOTES.md                  (commit hash, reconciled domain list, merges/splits)
  FEATURE-INDEX.md               (§4)
  DOCS-ACCURACY-INDEX.md         (§4)
  USER-MANUAL-PROPOSAL.md        (§4)
  REORGANIZATION-FINDINGS.md     (§4)
  domains/
    core-clinical.md
    scheduling-front-desk.md
    clients-portal.md
    billing-finance.md
    inventory-pharmacy.md
    lab-imaging.md
    insurance.md
    statutory-compliance.md
    import-export-migration.md
    integrations-api.md
    ai-agent.md
    marketing-communications.md
    admin-settings.md
    auth-onboarding.md
    reports.md
    wellness.md
    i18n-localization.md
    (+ any domain added/split during §3.1 reconciliation)
```

Do not write anywhere else. Do not modify `apps/`, `packages/`, existing `docs/`,
README.md, ROADMAP.md, or CLAUDE.md. If your environment has Jira/Atlassian MCP
access per `docs/agents/jira-operating-manual.md`, filing individual
`REORGANIZATION-FINDINGS.md` items as tickets is optional and secondary to the
written deliverables above — do not let ticket-filing substitute for the files.

═══════════════════════════════════════════════════════
SELF-CHECK BEFORE FINALIZING (orchestrator)
═══════════════════════════════════════════════════════

- [ ] Did you state a commit hash / clone date at the top of every file?
- [ ] Did every domain subagent verify against actual running code, not just against
      README/ROADMAP prose?
- [ ] Did you correctly note that `apps/docs` is currently an empty workspace stub
      (no content beyond `package.json`) rather than assuming it holds something?
- [ ] Did you read and cite `artifacts/ux-codebase-analysis-2026-09-11.md` and
      `artifacts/ai-feature-audit.md` rather than re-deriving their findings from
      scratch — and clearly mark where you confirm, extend, or contradict them?
- [ ] Does `USER-MANUAL-PROPOSAL.md` explicitly resolve the sk/en language question
      instead of leaving it implicit?
- [ ] Did you carry the MVP-vs-Phase2-vs-v1.0-vs-simulated distinction from
      README/ROADMAP into every domain file and into the manual proposal, so nothing
      planned or simulated gets documented as live today?
- [ ] Does every non-trivial claim carry a §0 source tag?
- [ ] Did you resolve every cross-domain naming collision explicitly (§3.3) rather
      than letting two domain files silently disagree about who owns a feature?
