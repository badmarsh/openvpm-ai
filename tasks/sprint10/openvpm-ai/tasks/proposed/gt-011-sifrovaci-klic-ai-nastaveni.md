# TASK: Verzovaný a povinný šifrovací kľúč pre AI nastavenia (F-17-2)
**[STATUS: PROPOSED]** · Priorita **P1** · Kategórie DATA, SAFETY · Úsilie **M** · Vlastník: API + DB
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-17, register F-17-2

## 1. Context / Why
`lib/ai/ai-crypto.ts:19-30` odvodzuje šifrovací kľúč takto: `AI_SETTINGS_ENCRYPTION_KEY`, a ak chýba, `sha256(NEXTAUTH_SECRET || "openvpm-dev-ai-settings-default-secret-seed")`. Ak nie je nastavené ani jedno (alebo je použité verejné dev nasadenie), **všetky uložené provider kľúče sú dešifrovateľné kýmkoľvek**, kto pozná repozitár a má prístup k DB. Kľúč navyše nie je verzovaný: rotácia `AI_SETTINGS_ENCRYPTION_KEY` ticho znefunkční všetky uložené kľúče a používateľ to uvidí len ako „AI nefunguje“ (`ai-config-resolver.ts:108-116`).

## 2. Scope
### In Scope
- [x] V produkcii (`NODE_ENV=production` alebo hostovaný režim) **fail-closed**: ak `AI_SETTINGS_ENCRYPTION_KEY` chýba alebo má nedostatočnú entropiu, aplikácia odmietne štart (rovnaký vzor ako `assertHostedRlsRoleOnce`, `lib/rls-assertion.ts`).
- [x] Zaviesť verziu kľúča do formátu šifrovaného záznamu (`v2:<keyId>:<iv>:<tag>:<ct>`) a podporu viacerých kľúčov pri dešifrovaní (starý + nový) tak, aby rotácia bola bezpečná.
- [x] Pri neúspešnom dešifrovaní zobraziť adminovi zrozumiteľnú výzvu „znovu vložte kľúč providera“, nie tichý fallback.
- [x] `.env.example` doplniť `AI_SETTINGS_ENCRYPTION_KEY` s vysvetlením (dnes tam chýba; je tam len `MESSAGING_REGISTRATION_ENCRYPTION_KEY`).
- [x] Testy: chýbajúci kľúč v produkcii = chyba štartu; rotácia kľúča neznefunkční staré záznamy.

### Out of Scope
- [ ] Migrácia na externý KMS/secret manager (možné pokračovanie).
- [ ] Zmena šifrovania iných modulov (messaging) nad rámec zdieľaného helpera.

## 3. Acceptance Criteria (Definition of Done)
- [ ] `pnpm --filter @openpims/web test -- lib/ai/__tests__/ai-crypto` zelené s testami pre 3 scenáre (chýbajúci kľúč, rotácia, poškodený záznam).
- [ ] `.env.example` obsahuje nový kľúč a `docs/production-readiness/OPERATIONS_RUNBOOK.md` popisuje rotáciu.
- [ ] Žiadny kód neodvodzuje šifrovací kľúč z `NEXTAUTH_SECRET` v produkcii.

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (`lib/ai/ai-crypto.ts`, `lib/env*`), dokumentácia, `.env.example`.
- **Riziko:** `risk:security`, `risk:data`.
