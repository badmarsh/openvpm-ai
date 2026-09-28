# Vizuálna jednota a zdravie modulov — merané 2026-09-28

**Prečo tento dokument:** vlastník povedal, že ho viac než „koľko sprintov zostáva"
zaujíma (a) že stránky nie sú vizuálne prehľadné a jednotné a (b) že niektoré moduly
(marketingové) nejdú vôbec. Toto je meraný stav oboch vecí — nie plán, nie odhad.

**Metóda:** mechanické čítanie zdrojov všetkých `page.tsx` v `apps/web/app` (111 stránok)
proti `docs/UIKIT.md`. Heuristika vie dať falošný pozitív (napr. farba, ktorú UIKIT sám
predpisuje pre modalitu či klinický stav), preto je každé číslo označené ako **signál**,
nie ako verdikt. Príkazy na reprodukciu sú v §5.

---

## 1. Vizuálna jednota

### Hlavné číslo

| | Stránok | Podiel |
|---|---|---|
| Prejde mechanickou kontrolou (`PageHeader` + žiadna raw farba/hex + žiadna one-off tabuľka) | **22** | 19,8 % |
| Má aspoň jeden priestupok | **89** | 80,2 % |
| Riadkov v priestupkových stránkach | 66 004 z 82 220 | 80,3 % |

### Podľa veľkosti — toto rozhoduje o tom, koľko práce to je

| Veľkosť | Priestupkov | Poznámka |
|---|---|---|
| ≤ 300 riadkov | **49** | zbaliteľné do sweepov po oblastiach (jeden mechanický typ editácie) |
| 301–1 000 | 17 | po 4–6 na PR |
| > 1 000 riadkov | 23 | klinicky kritické obrazovky, jednotlivo a opatrne |

### Podľa typu priestupku

| Signál | Stránok | UIKIT pravidlo |
|---|---|---|
| Žiadny `PageHeader` | 59 | „Hierarchy (top → bottom): 1. `PageHeader`" |
| Vlastné `<h1>` (hlavička mimo kitu) | 34 | „Page titles with an inline Lucide icon inside the `<h1>` — use `PageHeader icon`" |
| Raw paleta (`bg-gray-100`, `text-amber-700`, …) | 47 | RULES §1.4 „semantic tokens instead of raw palette colours" |
| Pevné hex farby | 12 | to isté |
| One-off tabuľka `px-4 py-3` | 16 | „No per-page one-off table CSS … no `text-sm` + `px-4 py-3` list tables" |
| Pill `TabsList` (namiesto podčiarknutých pre sekcie stránky) | 29 | „Tabs: underline … Pill `TabsList` only for tiny in-card switches" |
| Bez kontraktového pagekit testu | 84 (z 111) | `*-pagekit.test.ts` je jediné, čo jednotu vynucuje |

### Podľa oblastí

| Oblasť | Priestupkov / stránok | Riadkov |
|---|---|---|
| `marketing/*` | **16 / 17** | 6 500 |
| `portal/*` (klientský portál) | **13 / 13** | 1 978 |
| verejné stránky (`/h`, `/web`, `/tv`, `/book`, `/sms`, `/postop`, `/odhlasenie`, `/treatment-plan`) | **11 / 11** | 1 400 |
| `(dashboard)` ostatné | 40 / 62 | 51 000 |
| `agent/*` | 4 / 6 | 6 800 |
| `settings/*` | 2 | 6 970 |
| `auth` | 1 / 6 | 1 119 |

Tri najväčšie priestupky sú zároveň najkritickejšie obrazovky:
`settings` 6 123 · `encounters/[appointmentId]` 5 955 · `records` 4 610 riadkov.

**Zhrnutie §1:** jednota nie je „pár stránok". Je to 89 z 111 stránok, ale **49 z nich má
≤ 300 riadkov** — tie sú mechanická práca, nie redizajn. Skutočných 23 veľkých obrazoviek
je práca po jednej, lebo v nich farba často nesie klinický význam.

---

## 2. Zdravie marketingových modulov

### Čo je v poriadku (overené, nie predpokladané)

- Router **je** namontovaný: `_app.ts` → `extensions` → `extensions.marketing`
  (`server/routers/extensions/index.ts:52`), **63 procedúr**, žiadny `TODO`/stub/placeholder.
- Žiadne volanie z UI nemieri na neexistujúcu procedúru (preveril som všetky `trpc.*` volania
  v `app/`, `components/`, `lib/`; jediná zhoda je v testovacom súbore).
- Marketingové testy: **52 zelených** (`marketing`, `website-builder`, `automation-content`,
  `website-data-integration`, `marketing-reviews-pagekit`, `review-access-safety`,
  `automations-hub-pagekit`).
- 9 podstránok marketingu (`plan`, `content-queue`, `competitors`, `messages`, `suppression`,
  `wellness`, `tv`, `scripts`, `brand-kit`) sú **úmyselné redirecty** na kanonické huby — to
  nie je chyba.
- Marketing nie je za platobným tierom (self-host = `readHostedAiAccess` vracia `allowed: true`).

### Kde to naozaj „nejde"

**AI štúdio beží na lokálnej infraštruktúre, ktorá v hostingu neexistuje.**
Obrázky, video aj copy generuje `apps/web/lib/ai/alibaba-proxy.ts`, ktorý cieli na
**`http://127.0.0.1:8080/v1`** (`ALIPROXY_BASE_URL` / `ALIPROXY_KEY`, predvolená hodnota je
`aliproxy-local-key`). Keď proxy nebeží — čo na Verceli či na stroji bez AliProxy je vždy —
kód to **potichu zamení**:

| Procedúra | Správanie bez proxy | Kód |
|---|---|---|
| `generateImage` | vráti kurátorovanú stock grafiku (`/marketing/*.jpg`, `*.svg`) a zaloguje `Alibaba Proxy unavailable` | `marketing.ts:860–907` |
| generovanie textu | „validated Slovak templates" | `marketing.ts:421` |
| video (Veo/Wan) | chyba „Nepodarilo sa overiť stav videa na Alibaba proxy" | `marketing.ts:965–986` |

To je presne zážitok „modul nejde": tlačidlo Generovať existuje, ale výsledok je vždy tá istá
stock fotka alebo šablóna. Dve možné riešenia a obe sú rozhodnutie vlastníka:

1. **fail-visible** — v UI nezobrazovať „Generovať", keď proxy nie je nakonfigurovaná
   (alebo zobraziť jasný stav „AI generovanie nie je nastavené"), aby užívateľ nečakal stock fotku;
2. **hostovaný endpoint** — prepojiť na reálneho poskytovateľa (`AI_*` kľúč) a AliProxy použiť
   len pre self-host.

### Ešte jedna meraná vec

14 zo 17 marketingových stránok nemá ani test, ani zmienku v specu (§2 reportu
`sprint-coverage-2026-09-28.md`) — takže okrem AI studia je celý marketing v stave
„napísané, otestované len čiastočne, nikdy neprešlo sprintom jednoty".

---

## 3. Čo to znamená pre pravidlá (návrh, na schválenie)

`tasks/RULES.md` je živý dokument vlastníka. Dnešné pravidlá merajú „pokrytie sprintom",
čo je pre tvoje priority nesprávna metrika. Návrh:

| # | Zmena | Prečo |
|---|---|---|
| A | **§3.1 výnimka:** jeden PR môže zmeniť N stránok, ak je to **rovnaká mechanická editácia** (token za token, ten istý kit) a PR má mechanický kontrakt | dôvod pravidla bol PR #67 (šesť **rôznych** ticketov v jednom PR), nie sweepy; bez výnimky 49 malých stránok = 49 PR-ov |
| B | **Nová metrika namiesto „pokrytia":** (1) *uniformita* = podiel stránok bez priestupku, (2) *funkčnosť* = per-modul smoke, ktorý overí **reálny výstup**, nie fallback | „stránka má test" dnes nič nehovorí o tom, či je prehľadná alebo funkčná |
| C | **Fail-visible pre AI funkcie:** ak funkcia závisí od nebežiacej infra, UI to musí povedať; tiché fallbacky sa zakazujú (dnes `generateImage` vracia stock bez zmeny UI) | užívateľ nemá čakať výsledok, ktorý nikdy nepríde |
| D | **Nový kontrakt pre nové stránky:** skript `pnpm ui:check` (po vzore `docs:check`) so baseline; nová stránka nesmie pridať priestupok | RULES §4 už hovorí „no NEW warnings" — to isté pre UI |

---

## 4. Prvé dva PR-y, keď povieš áno

**PR-A — portálový sweep** (najmenší uzavretý celok, klientská tvár): 13/13 stránok portálu,
spolu 1 978 riadkov, všetky malé → jeden mechanický typ editácie (semantické tokeny + kity).
Mechanický kontrakt: skript, ktorý po zmene vráti 0 priestupkov pre `app/portal/**`.

**PR-B — marketing AI: fail-visible** (alebo hostovaný endpoint, podľa rozhodnutia):
`generateImage`/copy/video nech nezamlčujú fallback; UI zobrazí stav „AI nie je nastavené".
Mechanický kontrakt: test, ktorý pre nebežiacu proxy čaká chybový/„not configured" stav,
nie tichý stock obrázok.

---

## 5. Ako to zmerať znova

```bash
# stránky a ich priestupky (raw paleta, hex, one-off tabuľka, chýbajúci PageHeader)
find apps/web/app -name page.tsx | wc -l                     # 111
grep -rlE '(bg|text|border)-(gray|slate|amber|emerald|blue|rose|violet)-[0-9]{2,3}' apps/web/app --include=page.tsx | wc -l
grep -rlE '#[0-9a-fA-F]{3,8}' apps/web/app --include=page.tsx | wc -l
grep -rl 'px-4 py-3' apps/web/app --include=page.tsx | wc -l
grep -rL 'PageHeader' apps/web/app --include=page.tsx | wc -l   # 59

# väzba UI → procedúra (neexistujúce volania)
node ~/.arena/scratch/proc-wiring.mjs                        # 1 zhoda, a to v teste (skript je lokálny)

# marketing AI bez proxy
pnpm --filter @openpims/web exec vitest run server/__tests__/marketing.test.ts   # 6/6 zelených,
#   v stderr vidno: "[generateImage] Alibaba Proxy unavailable … using curated clinical fallback"
```

> Skripty `uikit-audit.mjs` a `proc-wiring.mjs` sú zatiaľ len lokálne (`.arena/scratch`).
> Ak má byť §1 vynútiteľný (návrh D), prvý krok je presunúť ten prvý do `scripts/`.
