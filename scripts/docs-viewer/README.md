# Docs viewer

Prehliadač technickej dokumentácie. Pre-renderuje každý technický markdown v
repozitári do statickej, samostatnej stránky: strom vľavo, full-text vyhľadávanie,
obsah na tejto stránke vpravo, svetlý/tmavý motív.

```bash
pnpm docs:viewer     # build + serve na :4173
pnpm docs:build      # len build
pnpm docs:check      # kontrola vystupu (code bloky, inline kod)
pnpm docs:links      # audit zlomovych odkazov (0 = v poriadku)
pnpm docs:smoke      # jsdom end-to-end test (bezi proti serveru na :4173)
```

Navštivte **http://localhost:4173**. Port sa zmení cez `--port 5000`.

## Čo prehliada zachytáva

Okrem čítania je to aj nástroj na audit dokumentácie. Rozlišuje tri stavy
odkazu a vizuálne ich odlišuje:

| Stav | Ako vyzerá | Význam |
|---|---|---|
| Odkaz na iný dokument | zelený, kliknuteľný | Prehliadač ho má v indexe |
| Odkaz na súbor, ktorý **nie je** v prehliadači | šedý `code` chip | Súbor na disku existuje, iba nie je indexovaný |
| Odkaz na **neexistujúci** cieľ | červený, prerušovaný | Skutočne chýbajúci — hniloba dokumentácie |
| Odkaz na riadok kódu | šedý `code` chip, nekliknuteľný | `file:line` odkaz, nie navigovateľná cesta |

### Stav hniloby dokumentácie (2026-09-28)

Audit prebehol v troch krokoch:

1. **Najprv 66 jedinečných neexistujúcich cielov.** Väčšina bola falošný
   poplach: prehliadač nedekódoval percent-encoding a `&amp;` entity v href,
   takže korektné odkazy na súbory s diakritikou vypadali ako mŕtve. Po
   oprave `unescapeHref()` v `scripts/docs-viewer.mjs` kleslo na **15**.
2. **Zo zvyšných 15** sa 11 týkalo indexu `docs/product-discovery/README.md`,
   ktorý stále ukazoval na 11 journey súborov presunutých a prečíslovaných do
   `docs/product/journeys/`. Tabuľka bola nahradená mapovaním na nové miesta,
   pričom odkazuje na jediný autoritatívny register.
   Jeden odkaz na `tasks/proposed/gt-001-…` smeroval na ticket archivovaný
   dňa 2026-09-27 — opravený na cestu v `tasks/archive/`.
   Tri odkazy na `docs/product/spec-v07/sekcia-2/3/4-*.md` odkazovali na
   súbory, ktoré **nikdy neboli zapísané**. Pretože ide o plánované, nie
   existujúce dokumenty, označili sme ich ako nezapísané a odpojili odkazy —
   nevytvárali sme fiktívne súbory.
3. **Výsledok: 0.** Žiadny dokument v `docs/` ani `tasks/` neobsahuje odkaz na
   neexistujúci lokálny cieľ.

> **Pozor pri budúcej oprave:** hľadaj najprv súbor, nie odkaz. Ak `README`
> znovu opisuje zoznam súborov, ktorý vlastní iný priečinok, opraví sa
> znova do štipca. Ukazovateľ na jediný register sa nedá zhnit.

## Ovládanie

| Klávesa | Akcia |
|---|---|
| `/` | skok do vyhľadávania |
| `Ctrl/⌘ + K` | vyhľadávanie + označenie |
| `Esc` | zrušiť vyhľadávanie / zavrieť menu |

Vyhľadávanie spája pojmy cez **AND** — „revocable session" nájde stránku, kde
sa „revocable" a „session" vyskytujú na rôznych miestach. Naivné hľadanie
podreťazca by v technickom texte nič nenašlo.

## Štruktúra

```
scripts/docs-viewer/
├── docs-viewer.mjs     build + server
├── index.html          shell
├── app.js              routing, vyhľadávanie, scroll-spy
├── styles.css          tokeny prevzaté z apps/web/styles/globals.css
├── code-check.mjs      poistka proti rozbitým code blokom
└── smoke.mjs           headless test cez jsdom
```

Výstup ide do `artifacts/docs-viewer/` — je to build produkt, nie zdroj.

### Prečo sú assety samostatné súbory

Prvá verzia mala `app.js` a `styles.css` ako template literály v build skripte.
Backslash v template literáli je escape, takže `\s` sa stal `s` a vyhľadávanie
sa rozpadlo na písmená. Druhá chyba: `marked` má pre inline kód `codespan` a pre
bloky `code`; override `code` zachytil fenced bloky a zrušil ich `<pre>` obálku
na 59 stránkach. Oba sa dali prekaziť jediným presunom do reálnych súborov.

## Pridanie dokumentu

Nie je potrebné nič registrovať. Skript prejde `docs/**`, `tasks/*.md` a vybrané
koreňové dokumenty. Po úprave textu stačí `pnpm docs:build` (alebo reload
prehliadača, ak server beží — dáva `no-cache`).
