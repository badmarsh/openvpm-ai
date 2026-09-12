# Zmluva o spracúvaní osobných údajov (DPA) — Slovenská republika

> **Vzor dokumentu** pre zmluvný vzťah medzi:
> - **Prevádzkovateľ:** veterinárna klinika / ambulancia (zmluvný partner OpenVPM)
> - **Sprostredkovateľ:** prevádzkovateľ systému OpenVPM (VET.IS / OpenVPM AI)
>
> **Právny rámec:** Nariadenie (EÚ) 2016/679 (GDPR), Zákon č. 18/2018 Z. z.
> o ochrane osobných údajov.
>
> ⚠️ Toto je **vzor**, ktorý musí byť pred použitím posúdený právnikom
> prevádzkovateľa. Čísla paragrafov a rozsah spracúvania je potrebné prispôsobiť
> konkrétnemu zmluvnému vzťahu.

---

## 1. Predmet a účel spracúvania

1.1 Sprostredkovateľ spracúva osobné údaje výlučne v rozsahu a na účel
poskytovania veterinárneho informačného systému OpenVPM (vedenie zdravotnej
dokumentácie zvierat, objednávanie, fakturácia, zákonné registre, e-Kasa,
KVEPIS/ÚPVS hlásenia).

1.2 Kategórie dotknutých osôb: klienti kliniky (majitelia zvierat), ich
zamestnanci, ošetrujúci personál kliniky.

1.3 Kategórie osobných údajov: identifikačné a kontaktné údaje klientov, údaje
o zvieratách (vrátane mikročipu/transpondéra), zdravotná dokumentácia,
fakturačné a platobné údaje, údaje o oprávneniach používateľov.

## 2. Povinnosti sprostredkovateľa (čl. 28 GDPR, § 34 zákona č. 18/2018 Z. z.)

2.1 Spracúva údaje len na základe zdokumentovaných pokynov prevádzkovateľa.

2.2 Zaväzuje osoby oprávnené spracúvať údaje k mlčanlivosti.

2.3 Prijíma primerané technické a organizačné opatrenia (čl. 32 GDPR):
- šifrovanie v tranzite (TLS 1.3) a v pokoji (AES-256),
- tenant izolácia (Row-Level Security), riadenie prístupov na základe rolí,
- záznamy o prístupe (audit trail) a monitorovanie incidentov.

2.4 Využíva ďalších sprostredkovateľov (subprocesorov) len so súhlasom
prevádzkovateľa; zoznam je vedený v prílohe a v
`DATA_SOVEREIGNTY_AND_RETENTION.md`.

2.5 Pomáha prevádzkovateľovi plniť povinnosti voči dotknutým osobám (právo na
prístup, opravu, výmaz, prenosnosť) a pri ohlasovaní porušení (§ 38 zákona
č. 18/2018 Z. z.).

2.6 Po ukončení zmluvy vymaže alebo vráti všetky osobné údaje a zmaže existujúce
kópie, pokiaľ právo nevyžaduje ich uchovávanie.

## 3. Práva prevádzkovateľa

3.1 Právo na audit a inšpekciu spracúvania (vrátane doloženia certifikátov
bezpečnosti).

3.2 Právo dávať pokyny k rozsahu, spôsobu a dobe spracúvania.

## 4. Medzinárodné prenosy

4.1 Osobné údaje sa primárne spracúvajú v EÚ (AWS Frankfurt, Supabase EÚ).
Prenos do tretích krajín (napr. AI provideri) prebieha len s primeranými
zárukami podľa kapitoly V GDPR a s Zero Data Retention politikou.

## 5. Doba trvania a zodpovednosť

5.1 Zmluva trvá počas trvania hlavnej zmluvy o poskytovaní služieb.

5.2 Sprostredkovateľ zodpovedá za škodu spôsobenú porušením povinností podľa
čl. 82 GDPR v rozsahu stanovenom zmluvou.

---

## Príloha A — Subprocesori (aktuálny stav)

| Subprocesor | Účel | Lokalita dát | Poznámka |
|---|---|---|---|
| AWS (S3, Frankfurt) | úložisko súborov/záloh | EÚ (eu-central-1) | šifrovanie AES-256 |
| Supabase / PostgreSQL | databáza | EÚ | RLS tenant izolácia |
| Anthropic (Claude) | AI asistencia | API | Zero Data Retention |
| Google Vertex (Gemini) | AI vízia | API (EÚ) | Zero Data Retention |
| Stripe | platby | EÚ/US | PCI-DSS |
| Resend / Twilio | e-mail / SMS | EÚ/US | len nevyhnutné údaje |

Prevádzkovateľ berie na vedomie zoznam subprocesorov a môže namietať zmenu
s 30-dňovou výpovednou lehotou.
