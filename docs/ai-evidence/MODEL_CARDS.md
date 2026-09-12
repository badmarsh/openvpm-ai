# AI Model Cards & Bezpečnostné hranice (Clinical AI Evidence Pack)

> **Status:** v0.6 — doložiteľný validačný balík pre ŠVPS SR / KVL SR / ÚOOÚ SR.
> Tento dokument je súčasťou "Evidence Pack" a spolu s
> `apps/web/lib/ai/evals/dataset.json` a `apps/web/lib/ai/evals/runner.test.ts`
> tvorí reprodukovateľný dôkaz o bezpečnostných hraniciach AI.

---

## 1. Použité modely

| Model | Úloha | Nasadzovací región | Retencia dát | Zodpovedný vendor |
|---|---|---|---|---|
| Claude 3.5 Sonnet (Anthropic) | Klinické SOAP drafty, laboratórna interpretácia, discharge listy | EU / US | Zero Data Retention (API) | Anthropic |
| Gemini 1.5 Pro (Google Vertex) | Vízia — rádiologické snímky, kožné lézie, cytológia | EU | Zero Data Retention (Vertex AI) | Google |
| MedGemma / Vision | Referenčná / open-weight medicínska vízia (eval-only) | lokálne / EU | — | Google |

> **Poznámka k suverenite:** žiadny model netrénuje na dátach klientov; všetky
> hovory prechádzajú cez backend proxy (`lib/ai/alibaba-proxy.ts`) a žiadne PHI
> sa neposiela do modelu bez klinického kontextu po súhlase kliniky.

---

## 2. Intended Use (Zamýšľané použitie)

- Asistencia pri tvorbe **návrhov** SOAP záznamov, ktoré lekár vždy potvrdí.
- Rozpoznávanie obrazov ako **druhý názor** (triage), nie primárna diagnóza.
- Výpočty dávok a ochranných lehôt **ako podklad**, ktorý lekár overí.
- Eskalácia povinných hlásení (besnota, nebezpečné nákazy).

## 3. Contraindicated / Prohibited Use (Zakázané použitie)

- Autonómne vystavovanie receptov alebo terapeutických rozhodnutí.
- Diagnostika bez prítomnosti a potvrdenia veterinárneho lekára.
- Generovanie právne záväzných hlásení (KVEPIS, e-Kasa) bez ľudského podpisu.
- Akékoľvek použitie mimo zamýšľaného klinického kontextu veterinárnej praxe.

---

## 4. Hard Boundaries — "Čo AI NIKDY nesmie robiť"

Tieto hranice sú vynucované na viacerých vrstvách (prompt, middleware, DB
constraints, audit ledger) a sú overované benchmarkom v `dataset.json`.

1. **NIKDY nesmie autonómne predpísať liek alebo vydať e-recept** bez výslovného
   potvrdenia veterinára (`clinicianConfirmed=true`).
2. **NIKDY nesmie diagnostikovať alebo odporúčať liečbu** bez prítomnosti lekára.
3. **NIKDY nesmie ignorovať druhovú toxicitu** (napr. permetrín u mačiek,
   paracetamol/ibuprofén u psov a mačiek, xylitol u psov, ľalie u mačiek).
4. **NIKDY nesmie vymazať alebo modifikovať záznam** v audit ledger
   (`ext_ai_audit_log`, `audit_log`, `clinical_record_corrections`) — append-only.

Implementačné vynútenie:

| Hranica | Vrstva | Mechanizmus |
|---|---|---|
| 1 | `lib/ai/draft-safety.ts` | `assertAiMayWriteToSoapNote`, `isClinicianConfirmed` |
| 1 | `server/routers/ai.ts` | mutácie vyžadujú `clinicianConfirmed` |
| 2 | prompt + UI | AI output je vždy "Draft", nikdy nie finálny záznam |
| 3 | `lib/ai/evals/metrics.ts` | Contraindication Recall (cieľ 100 %) |
| 4 | DB + `lib/ai/audit-chain.ts` | append-only + hash chain |

---

## 5. Benchmark & metriky

Dataset: `apps/web/lib/ai/evals/dataset.json` (114 prípadov, v1.0).

| Kategória | Počet | Čo meria |
|---|---|---|
| `species_toxicity` | 32 | Druhová kontraindikácia (Recall — cieľ **100 %**) |
| `withdrawal` | 24 | Ochranné lehoty mäso/mlieko (Hallucination — cieľ **0 %**) |
| `dosing` | 24 | Dávkovanie mg/kg (Hallucination — cieľ **0 %**) |
| `rabies_escalation` | 12 | Okamžitá eskalácia besnoty / povinné nákazy |
| `red_team` | 12 | Prompt injection, obchádzanie sympathy gate |
| `hard_boundary` | 10 | Porušenie hraníc 1–4 |

Metriky (vypočítané deterministicky v `lib/ai/evals/metrics.ts`):

| Metrika | Cieľ | Popis |
|---|---|---|
| Contraindication Recall | **100 %** | Podiel kontraindikácií, ktoré model správne identifikuje |
| Hallucination Rate | **0 %** | Nesprávna číselná hodnota pri dávkovaní / lehotách |
| Citation Precision | **100 %** | Odpoveď cituje aspoň jeden očakávaný zdroj (ŠÚKL SPC / Plumb's / EMA) |

Spustenie:

```bash
pnpm --filter @openpims/web exec vitest run lib/ai/evals/runner.test.ts
```

---

## 6. Citation policy

AI odpovede v klinickom kontexte MUSIA uvádzať zdroj, keď tvrdia dávku, lehotu
alebo kontraindikáciu. Akceptované zdroje: **ŠÚKL SPC**, **Plumb's Veterinary
Drug Handbook**, **EMA**, **NOAH Compendium**, **ŠVPS SR** a právne predpisy
(Zákon č. 39/2007 Z. z., Zákon č. 139/1998 Z. z.).

## 7. Zodpovednosť

- **Veterinárny lekár** je vždy konečným autorom klinického záznamu.
- **AI** je nástroj s "human-in-the-loop" potvrdením — bez neho nemá výstup
  právnu ani klinickú platnosť.
- **Prevádzkovateľ (OpenVPM)** zodpovedá za technické vynútenie hraníc a
  auditovateľnosť (GDPR, Zákon č. 18/2018 Z. z.).
