# TASK: Brána roly pre `aiSettings.getSettings` (F-17-1, alias F-X4-3)
**[STATUS: PROPOSED]** · Priorita **P1** · Kategórie SAFETY, DATA · Úsilie **S** · Vlastník: API
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-17, §5.4, register F-17-1

## 1. Context / Why
Celý router `extensions/ai-settings.ts` vyžaduje `admin` (`:132`, `:254`, `:361`) — **okrem** `getSettings` (`:22`). Každý prihlásený používateľ (vrátane `viewer` a `technician`) tak dostane `maskedKey` (posledné 4 znaky dešifrovaného kľúča pre OpenAI, Gemini aj Alibaba), base URL providera a históriu testov spojenia. `checkAliProxyHealth` (`:488`) nemá kontrolu roly vôbec. Test `ai-settings-router.test.ts:82` overuje len `updateSettings`, takže diera zostala nezachytená.

## 2. Scope
### In Scope
- [x] Doplniť `requireRole("admin")` na `getSettings` a `checkAliProxyHealth`.
- [x] V odpovedi pre ne-adminov vrátiť informáciu „AI je nakonfigurované“ **bez** `maskedKey`/base URL (aby UI mohlo zobraziť stav bez úniku), alebo jednoducho `FORBIDDEN` — rozhodne vlastník podľa UX v `/settings`.
- [x] Doplniť rolový test pre **každú** procedúru routera (nie len mutácie).
- [x] Skontrolovať, či `maskedKey` neuniká cez iné procedúry/endpointy (`grep maskedKey`).

### Out of Scope
- [ ] Zmena šifrovania kľúčov (rieši GT-011).
- [ ] Zmena UI karty AI nastavení nad rámec potrebný pre nové chovanie.

## 3. Acceptance Criteria (Definition of Done)
- [ ] Test: `viewer`/`technician`/`front_desk` dostanú `FORBIDDEN` (alebo odpoveď bez citlivých polí) pri všetkých procedúrach routera.
- [ ] `grep -n "protectedProcedure" apps/web/server/routers/extensions/ai-settings.ts` nevracia žiadnu procedúru bez roly, alebo má komentár s odôvodnením.
- [ ] `pnpm --filter @openpims/web test -- server/__tests__/ai-settings-router` zelené.

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (router + testy).
- **Riziko:** `risk:security`.
