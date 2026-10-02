# Sprint coverage — koľko sprintov ešte treba na celý systém

**Dátum:** 2026-09-28 · **HEAD:** `31a564c` (PR #78) · **Otázka:** koľko sprintov treba, aby každá časť systému prešla aspoň jedným sprintom

> **Pravidlo:** nič v tomto dokumente nie je odhad, pokiaľ to nie je výslovne označené ako
> **výpočet** (a aj ten má uvedený vzorec a vstupy). Povrch, pokrytie a priepustnosť sú merané
> príkazmi v §6. Kde sa meranie nedá spraviť (história je squashnutá), je to napísané.

---

## 1. Meraný povrch systému

| Vrstva | Počet | Ako merané |
|---|---|---|
| `page.tsx` (obrazovky) | **111** (82 220 riadkov) | `find apps/web/app -name page.tsx` |
| API route handlers (`route.ts`) | **57** | `find apps/web/app -name route.ts` |
| tRPC procedúry | **665** | `grep -rhoE '^\s+[a-zA-Z]+: [a-zA-Z]*[Pp]rocedure' apps/web/server/routers \| wc -l` |
| DB tabuľky | **190** | `grep -rhoE 'pgTable\(' packages/db/schema \| wc -l` |
| Testovacie súbory v `apps/web` | **598** | `find apps/web -name '*.test.ts*'` |
| e2e specifikácie | **22** | `ls e2e/*.spec.ts` |

## 2. Merané pokrytie

Dve nezávislé stopy, ktoré repo samo vytvára: **kontraktové testy** (každý sprint čítа
zdroj stránky cez `readFileSync`, `WORKFLOW.md` §„Done means an executable contract“)
a **zmienky v specoch** (`tasks/sprints/*.md`).

| Stopa | Stránok | Podiel |
|---|---|---|
| Stránka je referencovaná kontraktovým testom | **73** | 65,8 % |
| Stránka je menovaná v niektorom sprint specu | **35** | 31,5 % |
| **Union (aspoň jedna stopa)** | **75** | **67,6 %** |
| Bez akejkoľvek stopy | **36** | 32,4 % |

V kóde je pokrytie vyššie než v počte stránok: **77 723 z 82 220 riadkov = 94,5 %** — pretože
nepokryté sú najmä malé stránky.

| Veľkosť stránky | Stránok | Pokrytých | Nepokrytých | Riadkov | Nepokrytých riadkov |
|---|---|---|---|---|---|
| ≤ 100 riadkov | 37 | 11 | 26 | 1 168 | 755 |
| 101–300 | 16 | 11 | 5 | 3 012 | 900 |
| 301–1 000 | 30 | 25 | 5 | 19 638 | 2 842 |
| > 1 000 | 28 | **28** | 0 | 58 402 | 0 |

Podľa oblastí:

| Oblasť | Stránok | Pokrytých | Nepokrytých | Riadkov | Nepokrytých riadkov |
|---|---|---|---|---|---|
| `(dashboard)` jadro (mimo marketing) | 72 | 49 | 23 | 73 561 | 5 027 |
| z toho `marketing/*` | 14 | 0 | 14 | 2 634 | 2 634 |
| `portal` | 13 | 7 | 6 | 1 978 | 84 |
| `sms`, `web`, `tv`, `h`, `book` (verejné) | 8 | 2 | 6 | 1 419 | 764 |
| `auth`, `legal`, `api-docs`, `sign`, `capture`, `clinic-fit`, `email-preferences` | 14 | 14 | 0 | 5 028 | 0 |

Nepokrytých 36 stránok je vymenovaných v §6 (posledný príkaz), najväčšie z nich:
`marketing/media` 717, `vet-intel` 590, `settings/schema-validation` 558,
`marketing/handouts` 556, `marketing/consents` 421, `h/[slug]` 268, `postop/[id]` 228.

## 3. Meraná priepustnosť

| Ukazovateľ | Hodnota | Zdroj |
|---|---|---|
| Sprintov v sérii | 34 čísel (33 specov; 31 je neformálne rezervované) | `tasks/sprints/` |
| `state: done` | **29** | frontmatter |
| `state: open` / `partial` | 3 (#15, #18, #34) / 1 (#29) | frontmatter |
| Otvorené tikety GT-* | 9 + 1 partial | `tasks/proposed/` |
| **Stránok s dôkazom na 1 done sprint** | **2,59** | 75 / 29 |
| **Riadkov stránok na 1 done sprint** | **2 680** | 77 723 / 29 |
| Merged PR za 24 dní (5.–28. 9. 2026) | 74 (≈ 21,6 / týždeň) | GitHub API |
| Najnovšie sprinty (#32, #33, #34) | 27.–28. 9. → ≈ **1 sprint / deň** | merge dátumy PR #74, #75 (+PR #78) |

> **Obmedzenie merania:** časovú os sprintov z PR dátumov merať **nemožno** — PR-y 29 done
> sprintov ležia v okne 24.–27. 9. (3 dni), lebo specs sa dopĺňali spätne. Preto je časový
> údaj „1 sprint / deň" meraný len na posledných troch sprintoch a je to **rýchlosť súčasnej
> session**, nie historický priemer.

## 4. Projekcia

Tri scenáre, každý s uvedeným vzorcom. Vstupy sú z §2 a §3.

**A. Podľa počtu stránok** (pesimistický — 2-riadkový stub počíta ako stránku)

```
36 nepokrytých stránok / 2,59 stránky na sprint = 13,9  →  14 sprintov
rozpätie pri ±20 % priepustnosti: 12 – 18 sprintov
```

**B. Podľa kódu** (optimistický — meria hmotu, nie počet súborov)

```
4 497 riadkov nepokrytých / 2 680 riadkov na sprint = 1,7  →  2 – 3 sprinty
```

**C. Batchovanie malých stránok** (kompromis, ktorý zodpovedá tomu, ako sprinty reálne vyzerali:
sprint 2 = 3 stránky, sprint 13 = 3 stránky, sprint 5 = 3 stránky)

```
5 stránok > 300 riadkov (2 842 riadkov)      → 2 – 3 sprinty
31 stránok ≤ 300 riadkov (1 655 riadkov)     → 3 – 5 sprintov po oblastiach
   (marketing 14, verejné SMS/web/tv 6, portal 6, admin/support 2, zvyšok 3)
---------------------------------------------------------------
pokrytie stránok spolu                        → 5 – 8 sprintov
```

**Plus známy otvorený backlog** (nie je v číslach §2, lebo to nie sú stránky):

```
#15 Clinical AI imaging+DICOM, #18 Client 360, #34 AI team   → 3 sprinty
#29 dokončenie (chýba kontraktový test)                      → 1 sprint
9 tiketov GT-006…GT-017 (väčšina P1, úsilie S/M)             → 2 – 3 sprinty
---------------------------------------------------------------
backlog spolu                                                → 4 – 6 sprintov
```

### Odpoveď

| Otázka | Odpoveď |
|---|---|
| Každá **stránka** aspoň raz sprintom | **5 – 8 sprintov** (realisticky), 14 (pesimisticky), 2–3 (ak sa meria len hmota kódu) |
| **Celý systém** = stránky + známy backlog (#15, #18, #29, #34, GT tikety) | **9 – 14 sprintov** |
| Pri súčasnom tempe ~1 sprint/deň (posledné 3 sprinty) | ≈ 2 – 3 týždne práce, ak tempo vydrží |

**Prečo je rozpätie 5–14 a nie jedno číslo:** počet stránok a hmota kódu sa rozchádzajú 6×.
Rozdiel je celý v malých stránkach — 26 nepokrytých stránok má ≤ 100 riadkov (napr. `portal`
a `marketing/*` sú 2–23-riadkové stuby). Kto ich bude riešiť po jednom, minie 14 sprintov;
kto ich zbalí po oblastiach (marketing, verejné SMS/privacy/terms, portal stuby), minie 5–8.
`RULES.md` §3.1 pritom zakazuje baliť sprinty — takže batchovanie znamená **jeden sprint
= jedna oblasť**, nie jeden PR na všetko.

## 5. Čo v týchto číslach NIE JE

- **Kvalita.** „Pokryté" znamená „existuje kontraktový test / zmienka v specu", nie „je hotové
  a správne". Napr. #29 je `partial` a napriek tomu má pokrytie.
- **Druhé kolo.** Projekcia počíta *jedno* prejdenie systému. Revízie už pokrytých stránok
  (nové požiadavky, refaktor) nie sú zahrnuté — historicky ich bolo 5 (PR #68, #70, `fcfc18e`, #71, #77).
- **API-only povrch.** 665 tRPC procedúr a 190 tabuliek nie je v projekcii zvlášť; pokrývajú sa
  spolu s obrazovkami, výnimkou je backlog GT-006…GT-017 (role gates, šifrovací kľúč, residency),
  ktorý je zahrnutý ako 2–3 sprinty.
- **Otázka z PR #78** (zlomkové množstvá v sklade) — ak sa rozhodne ako „dorobiť", je to +1 sprint.
- **e2e a docs.** 22 e2e specov a 191 dokumentov prehliadača nie sú v projekcii.

## 6. Ako to zmerať znova

```bash
# povrch
find apps/web/app -name page.tsx | wc -l                                # 111
find apps/web/app -name route.ts | wc -l                                # 57
grep -rhoE '^\s+[a-zA-Z]+: [a-zA-Z]*[Pp]rocedure' apps/web/server/routers | wc -l   # 665
grep -rhoE 'pgTable\(' packages/db/schema | wc -l                       # 190

# pokrytie: stránky, ktoré čítajú kontraktové testy
grep -rhoE '"[^"]*page\.tsx"' apps/web --include='*.test.ts*' | sort -u | wc -l

# nepokryté stránky: priechod stromom + test na obe stopy
#   pre každý page.tsx sa hľadá jeho cesta v textoch všetkých *.test.ts* a tasks/sprints/*.md
#   (v §2 je použitý presne tento test; zoznam nepokrytých je v tabuľkách vyššie)
```

> Poznámka: samotný skript, ktorý tieto čísla spočítal, **nie je commitnutý** (je to jednorazová
> analýza). Ak má byť report reprodukovateľný z repa, treba ho doplniť po vzore
> `scripts/upstream-backport-audit.mjs`.
