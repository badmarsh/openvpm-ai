# OpenVPM AI — Inbox, Omnichannel Komunikácia & AI Asistent Odpovedí (Modul 5)

> **Zadanie pre Arena Agenta:** Tento modul rieši centrálnu komunikáciu veterinárnej kliniky s majiteľmi zvierat cez viacero kanálov na jednom mieste (`/inbox`): prichádzajúce a odchádzajúce e-maily (Resend), WhatsApp (Twilio webhook), SMS správy a webové dopyty. Súčasťou je automatické párovanie klientov a ich zvierat, AI návrhy odpovedí s klinickým kontextom, detekcia dodávateľských PDF faktúr a striktná ochrana súkromia a etiky (Sympathy Gate).

---

## 0. Architektonické a bezpečnostné mantinely (NEPORUŠITEĽNÉ)

1. **Vanilla DB Schema Immutability:** Nikdy nemodifikuj vanilla súbory v `packages/db/schema/*.ts` (iba existujúce tabuľky `communications`, `clients`, `patients` a rozšírenia `ext_whatsapp.ts`, `ext_automation.ts`).
2. **Klinické a etické bezpečnostné brány:**
   - **Sympathy Gate (Kondolenčná závora):** Ak má klient zviera v stave `deceased` (uhynuté/eutanazované), AI návrhy odpovedí a automatické šablóny nesmú generovať veselý tón ani marketingové ponuky. Systém musí komunikáciu označiť pietnym statusom.
   - **Multi-tenant izolácia dát (`practiceId`):** Prichádzajúce webhooks (WhatsApp/Email) musia striktne overovať podpis poskytovateľa (`verifyTwilioRequest`, Resend webhook secret) a priradiť správu správnej klinike.
   - **Obrana proti Prompt Injection:** Text prichádzajúcej správy od klienta nesmie prepísať systémové inštrukcie AI asistenta pri generovaní návrhu odpovede.
3. **i18n Symetria:** Všetky texty musia ísť cez `useI18n()`. 100% symetria kľúčov medzi `apps/web/messages/en.json` a `sk.json` (nested JSON).
4. **Databáza pri testoch:** V lokálnom prostredí výhradne `-d openvpm_ai` (port 5434).

---

## 1. GUI & UX: Omnichannel Inbox (`/inbox`)

### Súčasný stav
- Súbor `apps/web/components/communications/inbox-view.tsx` má viac ako 1 800 riadkov.
- Rieši rozdelenie na zoznam konverzácií (vľavo) a detail vlákna (vpravo).
- Potrebuje doladiť responzivitu, stavové indikátory kanálov a prehľadné prepínanie filtrov.

### Požiadavky na úpravu (UI Craft podľa `ui-craft-dense-dashboard`):
1. **Zoznam konverzácií (Ľavý panel):**
   - Kompaktné riadky s jasnou hierarchiou:
     - Meno klienta (`font-medium`) + priradený pacient (napr. *„Dunčo (Pes)“*).
     - Kanálový badge: WhatsApp (zelený `MessageCircle`), E-mail (modrý `Mail`), SMS (fialový `Phone`), Web dopyt (oranžový `Globe`).
     - Čas poslednej správy (`tabular-nums text-xs text-muted-foreground`).
     - Indikátor neprečítanej správy (`unread badge` / pulzujúci bod).
   - Rýchle filtre: Všetky / Neprečítané / WhatsApp / Email / SMS / Dodávatelia (PDF faktúry).
2. **Detail konverzácie (Pravý panel):**
   - Hlavička: Prepojenie na kartu klienta (`/clients/[id]`) a kartu pacienta (`/patients/[id]`).
   - Bubliny správ: rozlíšenie prichádzajúca (vľavo, muted) vs. odchádzajúca personálom (vpravo, primary tint).
   - Prílohy: náhľad PDF / obrázkov s možnosťou stiahnutia alebo priameho preklopeniu faktúry do skladu.
3. **AI Asistent odpovede (Smart Reply Box):**
   - Tlačidlo *„Navrhnúť odpoveď pomocou AI“* s badgeom modelu.
   - Návrh odpovede sa vloží do textového poľa ako koncept na manuálnu úpravu a schválenie lekárom/recepciou pred odoslaním (Human-in-the-loop).

---

## 2. Integrácia & Webhook Security

1. **Twilio WhatsApp Inbound Webhook (`apps/web/app/api/webhooks/whatsapp/route.ts`):**
   - Overenie HMAC podpisu Twilio požiadavky na produkčnej aj reverznej proxy doméne.
   - Normalizácia telefónneho čísla do formátu E.164 (+421...).
   - Bezpečné vyhľadávanie klienta bez rizika SQL wildcard zraniteľnosti.
   - Idempotencia: zabránenie duplicitnému spracovaniu správy pomocou `dedupeKey`.
2. **Resend Email Inbound Webhook:**
   - Spracovanie prichádzajúcich e-mailov, extrakcia čistého textu tela pomocou `cleanEmailBody` a oddelenie podpisov a histórie citácií.

---

## 3. Preklady & 100% i18n Symetria

1. Skontroluj všetky reťazce v:
   - `apps/web/components/communications/inbox-view.tsx`
   - `apps/web/components/communications/message-logs-view.tsx`
   - `apps/web/app/(dashboard)/inbox/page.tsx`
2. Doplň chýbajúce preklady do `apps/web/messages/sk.json` a `en.json` pod kľúč `inbox`.
3. Overenie:
   ```bash
   pnpm --filter @openpims/web exec vitest run server/__tests__/i18n-structure.test.ts
   ```

---

## 4. Testy, Verifikácia & PR

1. **Unit & Integračné testy:**
   - Vytvor alebo rozšír testy v `apps/web/lib/__tests__/inbox-cleaner.test.ts` a `apps/web/server/__tests__/whatsapp-webhook.test.ts`:
     - Overenie detekcie sympathy gate (potlačenie nevhodných odpovedí pri úmrtí pacienta).
     - Test idempotencie a normalizácie telefónneho čísla.
     - Test AI prompt injection sanitizácie.
2. **Kvalita kódu:**
   ```bash
   pnpm lint
   pnpm --filter @openpims/web type-check
   pnpm --filter @openpims/web test -- run inbox-cleaner.test.ts i18n-structure.test.ts
   ```
3. **Git & PR:**
   - Commit: `feat(inbox): omnichannel UI craft, WhatsApp/Email webhook security, AI reply assistant and sympathy gate`.
   - Otvor Pull Request do `main`.
