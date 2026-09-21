# TASK: Skryť/zablokovať hlasový AI vstup pre roly bez oprávnenia (F-18-2, aliasy F-X4-1, F-X4-2)
**[STATUS: PROPOSED]** · Priorita **P1** · Kategórie UX, SAFETY · Úsilie **S** · Vlastník: UI
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-18, §5.4, register F-18-2

## 1. Context / Why
`/agent/voice` je v navigácii pre všetky roly (`config/custom-nav.ts:111-118`) a plávajúce `ScribeWidget` tlačidlo (`components/layout/scribe-widget.tsx:38-40`) je v dashboard layoute pre všetkých, hoci `voiceProcedure` vyžaduje `admin`/`veterinarian` (`voice.ts:45-47`). Technik teda stlačí mikrofón, **audio sa nahrá do S3** (`voice.ts:112-118`) a až potom dostane `FORBIDDEN` s anglickým textom v toaste.

## 2. Scope
### In Scope
- [x] Zobraziť navigačný odkaz, tlačidlo a obrazovku len rolám, ktoré majú serverové oprávnenie (zdroj pravdy = server; klient sa nesmie spoliehať iba na seba).
- [x] Ak sa použije priamy odkaz z URL, stránka musí pred akýmkoľvek nahrávaním ukázať zrozumiteľný stav „na tento krok nemáte oprávnenie“, nie zapnúť mikrofón.
- [x] Nikdy neukladať audio, ktoré nemôže byť spracované — kontrola oprávnenia **pred** uploadom.
- [x] Preložené hlásenia (SK/EN) namiesto `err.message` zo servera.
- [x] Test: rola bez oprávnenia neodošle žiadny request na upload.

### Out of Scope
- [ ] Rozšírenie hlasu na ďalšie roly (produktové rozhodnutie).
- [ ] Zmena `voiceProcedure` na serveri (brána zostáva).

## 3. Acceptance Criteria (Definition of Done)
- [ ] `config/custom-nav.ts` a `scribe-widget.tsx` zobrazujú hlas len pre `admin`/`veterinarian` (alebo na základe serverom poskytnutého zoznamu oprávnení).
- [ ] Manuálne overené: technik na `/agent/voice` priamym odkazom nezapne nahrávanie.
- [ ] Nové texty v EN + SK.
- [ ] `pnpm --filter @openpims/web test -- server/__tests__` zelené.

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (navigácia, obrazovka, widget, i18n).
- **Riziko:** `risk:security`.
