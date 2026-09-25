import os, sys

base = os.path.join(os.path.expanduser("~"), "Documents", "Vet", "openvpm-ai", "tasks")
print("base:", base)
assert os.path.isdir(base), "tasks dir not found: " + base
NL = chr(10)

defs = [
  (21,"settings-master-hub","Practice Settings Master Hub /settings",
   "Analyze audit and improve the settings master page (~6008 lines). UI Kit harmonization i18n audit pageShellClass DataTableFrame per panel. Do not alter credential storage PKCS12 or encryption paths.",
   "settings/ekasa/page.tsx settings/ai/page.tsx settings/simulation/page.tsx lib/crypto.ts",
   "settings-master-pagekit.test.ts",
   ["pageShellClass + PageHeader icon=Settings title=Nastavenia","underlineTabsListClass + DataTableFrame per settings panel","i18n sweep: all missing keys under settings namespace","Fix no-explicit-any and exhaustive-deps warnings","Lazy PDF import pattern preserved - no top-level import"]),
  (22,"clinical-records-soap","Clinical Records and SOAP Workspace /records",
   "Audit and harmonize clinical records hub (~4034 lines). DataTableFrame for records table underline tabs for SOAP sections. Do not alter ClinicalDiffConfirmModal or AI-draft prefill.",
   "ClinicalDiffConfirmModal server/routers/extensions/clinical-register.ts records/new-soap records/replace-soap",
   "clinical-records-pagekit.test.ts",
   ["pageShellClass + PageHeader icon=BookOpen title=Klinicke zaznamy","DataTableFrame for visit list with species filter chip","Underline tabs: SOAP / Zaznamy / Historia / Prilohy","i18n: records and soap namespaces","KpiGrid: total visits avg duration open diagnoses"]),
  (23,"appointment-scheduler","Appointment Scheduler and Calendar /schedule",
   "Harmonize appointment scheduler (~3495 lines). PageToolbar with date-range picker and provider filter DataTableFrame for list view. Do not alter recurring-appointment logic SMS triggers or drag-drop engine.",
   "server/routers/extensions/automation-events.ts lib/sms.ts recurrence rule logic calendar engine",
   "scheduler-pagekit.test.ts",
   ["pageShellClass + PageHeader icon=CalendarDays title=Rozvrh","PageToolbar: date navigator + provider selector + Add Appointment button","DataTableFrame agenda/list view with appointment status badges","Underline tabs: Den / Tyzden / Mesiac / Zoznam","i18n: schedule namespace full sweep"]),
  (24,"admin-panel-swarm","Admin Panel and AI Swarm Hub /admin /admin/ai-swarm",
   "Harmonize admin panel (~1769 lines) and AI swarm hub (~1052 lines). Role-gated admin only. KpiGrid system health DataTableFrame sprint logs. Do not alter role-gate middleware or AgentOS API.",
   "middleware.ts role checks server/routers/extensions/ai-swarm.ts AgentOS endpoint config",
   "admin-panel-pagekit.test.ts",
   ["pageShellClass + PageHeader icon=ShieldCheck with ADMIN badge","KpiGrid: active agents sprints dispatched arena sessions last deploy","DataTableFrame sprint log with merged/running/failed badges","ai-swarm: agent roster DataTableFrame with health indicators","i18n: admin and aiSwarm namespaces"]),
  (25,"encounter-detail-soap-editor","Encounter Detail and SOAP Editor /encounters/appointmentId",
   "Implement encounter detail from stub 0 lines. Patient banner SOAP editor tabs vital signs AI-draft panel advisory medication plan discharge link. Clinical safety gates apply.",
   "ClinicalDiffConfirmModal controlled-substance zero-prefill clinical-register.ts internals",
   "encounter-detail-pagekit.test.ts",
   ["Patient banner: name species breed owner last visit chip","Underline tabs: SOAP / Vitalne / Lieky / Prilohy / Prepustenie","AI draft panel: advisory badge + ClinicalDiffConfirmModal + draft-to-confirmed workflow","Medication plan: controlled-substance zero-prefill enforcement","Link to /agent/discharge for discharge summary"]),
  (26,"marketing-studio-reviews-website","Marketing Studio Part 2 Reviews and Website /marketing/reviews /marketing/website",
   "Harmonize marketing reviews (~1313 lines) and clinic website CMS (~877 lines). Sympathy gate suppresses review requests for deceased patients. Do not alter webhook security or AI reply generation.",
   "marketing.ts review triggers automation-suppression.ts write paths webhook signature verification",
   "marketing-reviews-pagekit.test.ts",
   ["pageShellClass + PageHeader icon=Star reviews / icon=Globe website","DataTableFrame review list with sentiment badges positive/neutral/negative","PageToolbar: platform filter + date range","Website CMS DataTableFrame page sections with preview chip","Sympathy gate: deceased patient suppression indicator in review queue","i18n: marketing.reviews and marketing.website namespaces"]),
  (27,"inventory-hardening","Inventory Hardening and Supplier Integration /inventory",
   "Harden inventory management (~1810 lines). Expiry-date warning badges controlled-substance audit trail PDF invoice import resilience. Do not alter wholesaler import router or audit log write path.",
   "wholesaler-import.ts medication-oversight.ts audit writes pdf-invoice-parser.ts core logic",
   "inventory-hardening-pagekit.test.ts",
   ["pageShellClass + PageHeader icon=Package title=Sklad","DataTableFrame with expiry badge <30d amber expired red token","PageToolbar: category + supplier filter + low-stock toggle","KpiGrid: total SKUs low stock expiring soon controlled substance count","PDF invoice import error state with filename and retry button","i18n: inventory namespace full sweep"]),
  (28,"ai-agent-hub","AI Agent Hub /agent",
   "Harmonize AI agent hub landing page (~808 lines). KpiGrid session stats navigation cards to sub-agents recent sessions DataTableFrame. All AI outputs advisory. Do not alter AgentOS session API.",
   "imaging.ts voice.ts discharge.ts AgentOS session management API calls",
   "ai-agent-hub-pagekit.test.ts",
   ["pageShellClass + PageHeader icon=Bot with AI BETA badge","KpiGrid: active sessions completed today avg response time SOAP drafts pending","Navigation cards to Voice / Imaging / Discharge with live status indicators","DataTableFrame: recent AI sessions type badge duration status draft/confirmed/expired","Advisory banner: all AI outputs require vet confirmation before clinical use","i18n: agent namespace"]),
  (29,"patient-detail-clinical-card","Patient Detail and Clinical Card /patients/id /patients",
   "Implement patient detail page stub 0 lines and harmonize patient list ~360 lines. Tabbed clinical card visit history vaccines prescriptions imaging owner. Sympathy gate for deceased patients.",
   "duplicate-shield.ts ClinicalDiffConfirmModal ext_automation_suppression_log write path",
   "patient-detail-pagekit.test.ts",
   ["Patient list: pageShellClass + PageHeader icon=Users DataTableFrame species/status filter","Patient detail banner: name species breed DOB chip owner contact","Underline tabs: Klinicka karta / Ockovania / Predpisy / Zobrazovacie / Majitel","Sympathy gate: deceased/euthanized condolence banner + suppression badge logged to ext_automation_suppression_log","i18n: patients namespace full sweep"]),
  (30,"automations-crm-journeys","Automations and CRM Journey Builder /automations",
   "Implement automations hub ~80 line stub. CRM journey list rule builder UI enrollment stats suppression log viewer. Sympathy gate suppression read-only. Do not alter event-bus trigger or suppression write paths.",
   "automation-journeys.ts automation-events.ts automation-suppression.ts write paths automation-rules.ts trigger logic",
   "automations-hub-pagekit.test.ts",
   ["pageShellClass + PageHeader icon=Zap title=Automatizacie","KpiGrid: active journeys enrolled patients sent this week suppressed by sympathy gate","DataTableFrame journey list with active/paused/draft badge enrollment count last triggered","PageToolbar: type filter + status filter + New Journey button","Suppression log panel: read-only DataTableFrame patient reason suppressed-at","i18n: automations namespace full sweep"]),
]

index_rows = []
for n, slug, title, mission, dnt, test, scope in defs:
    fname = "arena-sprint-" + str(n) + "-" + slug + ".md"
    fpath = os.path.join(base, fname)
    parts = [
        "# Arena Sprint " + str(n) + ": " + title, "",
        "> **Mission for Arena Agent:**",
        "> " + mission,
        "> Zero new ESLint warnings, 0 type errors, 100% bilingual SK/EN i18n leaf symmetry, all pinned tests green.", "",
        "> **Independence:**",
        "> Does not touch: " + dnt, "",
        "---", "",
        "## 0. Preflight", "",
        "1. git status clean on your working branch.",
        "2. Read AGENTS.md, docs/UIKIT.md, components/layout/page-kit.tsx.",
        "3. Baseline tests BEFORE editing:",
        "   pnpm --filter @openpims/web exec vitest run lib/__tests__/i18n-structure.test.ts lib/__tests__/heavy-client-imports.test.ts", "",
        "## 1. DO NOT TOUCH", "",
        "- ClinicalDiffConfirmModal, controlled-substance zero-prefill, sympathy-gate suppression logic.",
        "- packages/db/schema/*.ts upstream vanilla or packages/db/drizzle/meta/_journal.json.",
        "- " + dnt, "",
        "## 2. Sprint Scope", "",
    ]
    for item in scope:
        parts.append("- " + item)
    parts += [
        "",
        "## 3. Acceptance Criteria", "",
        "- pnpm --filter @openpims/web type-check -> 0 errors.",
        "- pnpm lint -> 0 new warnings.",
        "- pnpm --filter @openpims/web exec vitest run lib/__tests__/" + test + " lib/__tests__/i18n-structure.test.ts -> all green.",
        "- pnpm --filter @openpims/web i18n:scan -> 0 missing keys in target namespace.",
        "- PR description must list every section restructured and every i18n key added.",
    ]
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(NL.join(parts))
    print("wrote: " + fname + " (" + str(len(parts)) + " lines)")
    index_rows.append("| " + str(n) + " | " + fname + " | " + title + " | written |")

idx_path = os.path.join(base, "SPRINT-INDEX.md")
with open(idx_path, encoding="utf-8") as f:
    idx = f.read()
if "arena-sprint-21" not in idx:
    with open(idx_path, "a", encoding="utf-8") as f:
        f.write(NL + NL.join(index_rows) + NL)
    print("SPRINT-INDEX updated with sprints 21-30")
else:
    print("SPRINT-INDEX already has sprint 21")
