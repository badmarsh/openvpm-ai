# TASK: Inbox — Prílohy faktúr + Import PDF faktúr do skladu

[STATUS: READY_FOR_IMPLEMENTATION]

---

## 1. Context / Why

Dodávatelia (Cymedica, Pharmacopola, Pharmos a ďalší) posielajú faktúry emailom ako PDF prílohy na inbox@significa.sk. Recepcia ich dnes prepisuje ručne do skladu. Inbox v OpenVPM AI už prijíma tieto emaily, ale prílohy sa nezobrazujú a import do skladu neexistuje. Pharmacopola (pravidelný dodávateľ) chýba v parseri.

---

## 2. Scope

### In Scope
- [x] Oprava zobrazovania príloh v inbox-view.tsx — klikateľné karty (ikona, názov, veľkosť, stiahnutie/náhľad)
- [x] Nový lib: apps/web/lib/inventory/pdf-invoice-parser.ts — AI extraction cez Gemini proxy
- [x] Nový tRPC endpoint: communications.parseAttachmentAsInvoice
- [x] Python pdfplumber pre PDF → text extrakciu (child_process)
- [x] PHARMACOPOLA v wholesaler-import.ts (typ, detektor, parser)
- [x] UI tlačidlo "Importovať do skladu" pri PDF prílohách v inboxe
- [x] Reuse existujúceho WholesalerImportReviewDialog — potvrdenie pred zápisom do skladu
- [x] i18n: EN + SK pre všetky nové UI reťazce

### Out of Scope
- [ ] OCR pre rasterové skeny (len text-based PDF v1)
- [ ] Automatický import bez potvrdenia — vždy review krok
- [ ] Reply z nepriradených konverzácií (separátny task)
- [ ] WhatsApp prílohy (len email)

---

## 3. Acceptance Criteria (Definition of Done)

### A — Zobrazovanie príloh
- [ ] Email s PDF prílohou zobrazuje kartu: ikona PDF + názov + veľkosť + tlačidlo stiahnutia
- [ ] Klik otvorí PDF inline (Content-Disposition: inline) v novej záložke
- [ ] image/* prílohy → thumbnail + lightbox
- [ ] Funguje pre existujúce INBOX_ATTACHMENTS záznamy v DB

### B — AI Parsovanie faktúry
- [ ] Klik "Importovať do skladu" zavolá parseAttachmentAsInvoice
- [ ] Endpoint fetchne PDF binary z Resend API (server-side, API key neskompromitovaný)
- [ ] Python pdfplumber extrahuje text, Gemini vráti strukturovaný JSON (supplierName, invoiceNumber, issueDate, items[])
- [ ] Review dialog zobrazí parsované položky pred zápisom
- [ ] Potvrdenie zapíše do skladu cez wholesalerImportRouter.confirmImport

### C — Pharmacopola Parser
- [ ] detectWholesaler() rozpozná "PHARMACOPOLA" v obsahu aj "ZF" prefix v názve súboru
- [ ] parsePharmacopolaText() správne sparsuje ZF26074471 (Relosyl 6 ks, €95.04, DPH 5%)
- [ ] pnpm --filter @openpims/web type-check prechádza

### D — i18n
- [ ] Všetky nové reťazce sú v en.json aj sk.json (100% symetria)
- [ ] pnpm --filter @openpims/web i18n:scan nevykazuje hardcoded string

---

## 4. Technical Architecture

### Nové súbory
- apps/web/lib/inventory/pdf-invoice-parser.ts  — AI extraction via OpenCodex Gemini proxy
- apps/web/components/communications/attachment-card.tsx  — reusable attachment chip

### Zmenené súbory
- apps/web/lib/inventory/wholesaler-import.ts  — + PHARMACOPOLA
- apps/web/server/routers/communications.ts  — + parseAttachmentAsInvoice mutation
- apps/web/components/communications/inbox-view.tsx  — prílohy UI + import button
- apps/web/messages/en.json, sk.json  — i18n keys

### AI Proxy
- Endpoint: http://127.0.0.1:10100/v1 (OpenCodex Gemini 3.1 Flash)
- Structured JSON output — rovnaký vzor ako suggestClientAction

### Python PDF Extrakcia
- Binary: C:\Users\marek\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe
- Lib: pdfplumber (overené dostupné)
- child_process.spawnSync s inline skriptom

### Bezpečnosť
- parseAttachmentAsInvoice → inboxStaffProcedure (staff/admin only)
- PDF fetch cez server (API key nie je vystavený klientovi)
- Import len do ctx.practiceId tenanta
- Controlled substances gate: isControlledSubstanceName() check pred zápisom

### Riziko: risk:prod — zápis do skladu, vždy review-gated

---

## 5. Verification & Test Plan

### Automatizované
- pnpm --filter @openpims/web type-check
- pnpm --filter @openpims/web exec vitest run apps/web/lib/inventory/__tests__/

### Manuálne (localhost:3001/inbox)
1. Otvor email s PDF prílohou → karta prílohy s názvom, veľkosťou, stiahnutím
2. Klikni "Importovať do skladu" → review dialog s parsovanými položkami (FAV_31 + ZF26074471)
3. Potvrď → položky v /inventory
4. Prepni jazyk EN → všetky texty preložené

---

## 6. Reálne vzorové faktúry

| Súbor | Dodávateľ | Stav |
|---|---|---|
| FAV_31_2026_7071.pdf | Cymedica SK | Dostupné |
| Predajna faktura ZF26074471.pdf | PHARMACOPOLA s.r.o. | Dostupné |
| erika-Tlačfaktúra...pdf | Erika (encoding issue) | Skip v1 |

Cymedica: ENZAPROST, Ihla 16G, Metricure, Nafpenzal DC, VETRIMOXIN, Hemosilate, PE rukavice — €704.10
Pharmacopola: Relosyl 50µg/ml inj. 20ml, 6 ks — €95.04 (DPH 5%)

---

## 7. Definition of Ready
- [x] Acceptance criteria jednoznačné a testovateľné
- [x] Architektúra vrátane dotknutých súborov špecifikovaná
- [x] Reálne PDF faktúry dostupné na testovanie
- [x] AI proxy http://127.0.0.1:10100/v1 aktívny
- [x] Python pdfplumber dostupný
- [x] WholesalerImportReviewDialog reusable

