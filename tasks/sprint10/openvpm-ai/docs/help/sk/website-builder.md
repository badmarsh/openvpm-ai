# Editor webstránky kliniky (Drag-and-Drop)

OpenVPM AI obsahuje vstavaný vizuálny editor webstránky kliniky, ktorý vám umožňuje jednoducho zostaviť a spravovať reprezentatívnu verejnú stránku priamo z údajov vášho veterinárneho softvéru.

## Hlavné vlastnosti

1. **Knižnica 17 sekcií:**
   - **Hero Banner:** Úvodný blok s nadpisom, tlačidlami a kontaktnou kartou.
   - **O klinike & Príbeh:** Predstavenie ambulancie s formátovaným textom a číslami.
   - **Štatistiky v číslach:** Prehľadný pás číselných úspechov praxe.
   - **Prehľad služieb:** Karty zákrokov a diagnostiky s cenami a ikonami.
   - **Veterinárny tím:** Lekári a sestry chránení GDPR súhlasom (`photo_web`).
   - **Certifikáty & Garancie:** Odznaky Fear-Free, členstvo v KVL SR a ochrana údajov.
   - **Recenzie klientov:** Overené hodnotenia z Google v mriežke alebo karuseli.
   - **Sociálne siete:** Prepojenie na Instagram, Facebook a TikTok profil.
   - **Edukačné letáky:** Dynamické medicínske rady pre chovateľov.
   - **Online rezervácia CTA:** Výzva na objednanie termínu bez čakania.
   - **Pohotovostný banner:** Núdzové upozornenie s okamžitým volaním pri akútnych stavoch.
   - **Kontaktný formulár:** Formulár na otázky majiteľov zvierat.
   - **Ordinačné hodiny & Mapa:** Tabuľka otváracích hodín a mapa kliniky.
   - **Fotogaléria:** Fotografie ambulancie z integrovanej mediálnej knižnice.
   - **Video prezentácia:** Responzívne video z YouTube alebo Vimeo.
   - **Časté otázky (FAQ):** Rozbaľovacie odpovede na otázky pred návštevou.
   - **Vlastný textový blok:** Bezpečný formátovaný text (Markdown).

2. **Automatické témy z Brand Kitu:**
   - Každá sekcia okamžite preberá primárnu (`brandColor`) a sekundárnu (`secondaryColor`) farbu z vášho nastavenia Brand Kitu.
   - Farba textu na tlačidlách a banneroch sa automaticky počíta pre dosiahnutie vysokého kontrastu a čitateľnosti.

3. **Intuitívny Drag-and-Drop:**
   - Jednoduché presúvanie sekcií pomocou úchytiek "Presunúť".
   - Duplikovanie, dočasné skrytie (oko) alebo zmazanie sekcií bez znovunačítania stránky.
   - Zmeny v koncepte sa automaticky ukladajú (autosave).

4. **Koncept vs. Publikovaná stránka:**
   - Úpravy v editore zostávajú v režime konceptu až do stlačenia tlačidla **Publikovať webstránku**.
   - Verejní návštevníci vidia vždy len schválenú a publikovanú verziu stránky.
