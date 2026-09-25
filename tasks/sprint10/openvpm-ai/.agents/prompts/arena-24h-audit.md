# OpenVPM AI - Arena Agent Audit & Test Prompt

## Kontext

OpenVPM AI je veterinarny praxovy system (Next.js 14, tRPC, Drizzle ORM, PostgreSQL) pre slovensky trh. Za poslednych 24 hodin prebehlo ~55 commitov pokryvajucich:

- **Inbox / omnichannel messaging** - novy WhatsApp webhook (Twilio), email inbound (Resend), AI suggestions pre inbox, PDF faktury parsing, wholesaler import
- **PDF invoice parser** - 6 po sebe iducich bugfixov pre pdfjs-dist bundling (worker, DOMMatrix polyfill, fake-worker)
- **AI inference proxy** - presun zo statickych env vars na Cloudflare AT proxy, novy model gemini-3.8-flash
- **Field visits (terenne vyjazdy)** - voice-first STT dictation, KVEPIS draft pipeline, farmove CRUD
- **Patient card refactoring** - 2500+ riadkov rozdelenych do section components
- **Automations tab** - novy AI Agents & Workflow panel
- **i18n** - 130+ novych klucov v en.json/sk.json, synchronizacia

---

## Kriticke oblasti na preverenie

### 1. PDF Parser Stability (HIGH PRIORITY)

**Subor:** apps/web/lib/inventory/pdf-invoice-parser.ts

6 po sebe iducich fixov pre pdfjs-dist v5.x bundling naznacuje nestabilitu:
- DOMMatrix polyfill v instrumentation.ts
- Fake-worker vs real worker resolution
- pdfjs-dist/legacy/build/pdf.mjs dynamic import

**Ulohy:**
1. Otestuj PDF text extraction s realnym slovenskym dodavatelskym listom (PHARMACOPOLA, Vetoquinol, Bioveta)
2. Over, ci DOMMatrix polyfill v apps/web/instrumentation.ts bezi pred prvym extractPdfText() volanim
3. Skontroluj, ci next.config.js serverExternal nastavenie nekoliduje s pdfjs bundlingom
4. Napis unit test pre extractPdfText() s minimalnym PDF bufferom

### 2. WhatsApp Webhook Security (HIGH PRIORITY)

**Subor:** apps/web/app/api/webhooks/whatsapp/route.ts

Novy Twilio WhatsApp inbound webhook - klucove rizika:
1. **Phone matching cez ILIKE** - ilike(clients.phone, ...) s fromWaId.replace je potencialny SQL injection risk ak fromWaId obsahuje wildcard znaky. Twilio to normalizuje, ale overte.
2. **Signature verification** - verifyTwilioRequest porovnava 2 URL varianty (request.url + canonical). Skontrolujte, ci na Dokploy (za reverse proxy) neprechadza nespravny URL.
3. **Multi-tenant routing** - ak klient s rovnakym cislom existuje vo viacerych practice, insert prebehne pre vsetky. Je to zamer alebo bug?
4. **dedupeKey format** - wa:{twilioSid} - skontroluj, ci communications.dedupeKey ma unique constraint.

**Test:** Odosli test webhook payload s Twilio signature a over cely flow od verifikacie po DB insert.

### 3. AI Inference Proxy & Config Resolver (MEDIUM-HIGH)

**Subory:**
- apps/web/lib/agent/inference-proxy.ts
- apps/web/lib/ai/ai-config-resolver.ts

**Rizika:**
1. AT_PROXY_URL / AT_PROXY_KEY - ak nie su nastavene v Dokploy env, cela AI pipeline padne. Health check to nevaliduje.
2. ai-config-resolver.ts ma 4-urovnovy fallback (designated provider, gemini, openai, alibaba, system default). Otestuj edge case: provider je active ale API key decryption failne = silent fallback na iny provider.
3. createGeminiFetch() cache thought_signature - memory leak ak cache presiahne 500 entries (LRU je manualny delete oldest).
4. Model gemini-3.8-flash - over, ci tento model realne existuje v Gemini API.

### 4. Voice Transcription Bug (HIGH)

**Subor:** apps/web/lib/voice/transcription.ts

V transcribeAudioDirect() sa audio base64 posiela ako image_url type namiesto audio type.
Toto funguje pre Gemini (ktory akceptuje multimodal data URL), ale:
1. Ak AT proxy routuje na iny model (OpenAI, Anthropic), image_url s audio mimeType zlyha.
2. Nie je ziadny retry na fallback model pre transcribeAudioDirect mimo proxy path.
3. 26MB limit pre base64 audio je velmi velky - over memory impact.

### 5. Inbox View Monolith (MEDIUM)

**Subor:** apps/web/components/communications/inbox-view.tsx - 1830 riadkov

Jeden komponent s:
- Email/WhatsApp/SMS zobrazenim
- AI suggestion banner
- PDF invoice parsing UI
- Wholesaler import dialog trigger
- Attachment download

**Ulohy:**
1. Over, ci vsetky useEffect hooky maju spravne dependency arrays.
2. Skontroluj, ci AI suggestion fetch nespusta infinite re-render loop.
3. Skontroluj memory leaks pri prepinani medzi konverzaciami.

### 6. i18n Symmetry (MEDIUM)

130+ novych klucov za 24h. Oba subory maju 8357 riadkov.

**Ulohy:**
1. Spusti pnpm --filter @openpims/web i18n:scan a over vystup.
2. Skontroluj, ci nie su hardcoded anglicke stringy v novych komponentoch.
3. Over, ze nested JSON struktura je konzistentna (ziadne root dotted keys).

### 7. Field Visits Clinical Safety (HIGH)

**Subor:** apps/web/server/routers/extensions/field-visits.ts

Farmove vyjazdy s automatickym KVEPIS DRAFT:
1. **Controlled substances gate** - router nema kontrolu, ci podane lieky obsahuju kontrolovane latky (ketamin, butorfanol). Zakon 139/1998 Z. z. vyzaduje manualny zapis.
2. **Withdrawal periods** - meatWithdrawalDays a milkWithdrawalDays prichadzaju z inputu bez validacie proti DB produktovym datam.
3. **Invoice auto-creation** - draft faktura sa vytvara automaticky. Over, ze status draft je vzdy zachovany.

### 8. PDF Invoice AI Prompt Injection (MEDIUM-HIGH)

**Subor:** apps/web/lib/inventory/pdf-invoice-parser.ts

parseWithAi() funkcia posiela raw PDF text priamo do LLM promptu (text.substring(0, 8000)).
Utocnik moze vlozit do PDF instrukcie pre LLM a manipulovat output.

**Ulohy:**
1. Navrhni sanitizaciu vstupneho textu pred poslanim do AI.
2. Pridaj validaciu AI response (item.quantity > 10000 = odmietni).
3. Over, ci existuje human review step pred importom do skladu.

### 9. Dokploy Deploy Env Wipe (CRITICAL - KNOWN)

Kazdy deploy webhook prepise .env na serveri. 109 env premennych sa strati.

**Ulohy:**
1. Over aktualny stav - curl -s https://vet.dev.significa.sk/api/health
2. Skontroluj, ci .agents/skills/deploy/scripts/deploy.ps1 obsahuje env protection.
3. Navrhni workflow s dokploy env push.

### 10. Build & Type Safety (MEDIUM)

Poslednych 24h commity obsahuju build fixy a TypeScript type alignment fixy.

**Ulohy:**
1. Spusti pnpm typecheck a over, ze prebehne bez chyb.
2. Spusti pnpm lint a skontroluj warnings.
3. Spusti pnpm test a over vysledky.
4. Over, ci next.config.js neobsahuje nebezpecne skipky (ignoreBuildErrors, ignoreDuringBuilds).

---

## Prikazy na spustenie

    git clone https://github.com/badmarsh/openvpm-ai.git
    cd openvpm-ai
    pnpm install
    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm --filter @openpims/web i18n:scan
    curl -s https://vet.dev.significa.sk/api/health | jq .

---

## Databazove pravidla

- NIKDY nequeuj -d openpims lokalne - to je nemigrovana sablona. Vzdy -d openvpm_ai.
- Remote DB: docker exec -i openvpm-postgres-cfoqxx psql -U openpims -d openpims

---

## Ocakavany vystup

Pre kazdu z 10 oblasti:
1. **Nalez** - co si objavil (bug, riziko, OK)
2. **Zavaznost** - CRITICAL / HIGH / MEDIUM / LOW / OK
3. **Dokaz** - konkretny subor + riadok + reprodukcia
4. **Oprava** - navrhovany fix (ak treba) s diff alebo kodom
5. **Test** - ako overit, ze oprava funguje

Na konci suhrn: kolko CRITICAL/HIGH/MEDIUM/LOW nalezov + celkove odporucanie deploy/no-deploy.
