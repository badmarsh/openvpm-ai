# Laboratórne výsledky a zobrazovacie metódy

OpenVPM prepája vaše interné analyzátory, spravuje príchodzí front
laboratórnych výsledkov a poskytuje AI-asistovanú interpretáciu
medicínskych snímok.

---

## 1. Laboratórne výsledky

### Zobrazenie výsledkov

Otvorte **Laboratórne výsledky** (`/lab-results`) pre prehľad všetkých
výsledkov v praxi, alebo otvorte pacienta a prejdite na záložku **Lab**
pre jeho individuálnu históriu. Fyziologické referenčné rozsahy pre psov
a mačky sú zabudované — hodnoty mimo rozsahu sú automaticky farebne
označené.

### Automatický import z analyzátorov

Výsledky sa automaticky importujú z nasledovných pripojených analyzátorov:

| Analyzátor | Typ | Parametre |
|---|---|---|
| IDEXX Catalyst One / Dx | Biochémia | ALT, AST, ALP, GGT, UREA, CREA, GLU, TBIL, TP, ALB, Ca, PHOS, Cholesterol, Amyláza, Lipáza |
| IDEXX ProCyte Dx / LaserCyte | Hematológia | WBC, RBC, HGB, HCT, MCV, MCH, MCHC, PLT, Diferenciál |
| Fuji Dri-Chem NX500 / NX700 | Suchá chémia | ALT, ALP, BUN, CRE, GLU, TP, ALB, TBIL, IP, Ca, Mg, CRP |
| Mindray BC-Vet (BC-2800/30) | Hematológia | 3-dielna / 5-dielna hematológia malých zvierat |

**Pripravuje sa (v0.7)**: scil Vet abc Plus (RS-232/CSV hematologický konektor).

Výsledky z externých referenčných laboratórií Laboklin SK a Synlab SK sú
tiež podporované cez HL7/PDF import.

### Doručená pošta laboratória (bezpečnostný front)

**Doručená pošta laboratória** (`/inbox`) je celoprázdnikový bezpečnostný
front. Zobrazuje všetky výsledky čakajúce na kontrolu. Z doručenej pošty
môžete:

- **Skontrolovať výsledok** — označiť ako skontrolovaný a pridať
  interpretačnú poznámku
- **Priradiť sledovanie** — priradiť úlohu členovi tímu (napr.
  „zavolať majiteľovi")
- **Označiť ako zadané omylom** — ak je výsledok duplikát, preklep alebo
  priradiť nesprávnemu pacientovi, označte ho ako „Zadané omylom". Pôvodný
  záznam zostane viditeľný, ale bude odstránený z aktívnych frontov. Použite
  **Vytvoriť náhradu** na vytvorenie opraveného záznamu s väzbou na pôvodný.

Výsledok sa nepovažuje za dokončený, kým nie je skontrolovaný a prípadné
sledovanie priradené.

---

## 2. Zobrazovacie metódy

### Otvorenie modulu zobrazovacích metód

Prejdite do **Agent → Zobrazovanie** (`/agent/imaging`) pre nahrávanie
a analýzu medicínskych snímok.

### Nahrávanie snímok

Pri nahrávaní medicínskej snímky (RTG, ultrazvuk, CT, MRI, fotografia rany):

1. Kliknite na **Nahrať snímku**
2. Vyberte pacienta
3. **Vždy vyberte kategóriu `imaging`** — tým sa súbor pripojí k záznamu
   zobrazovacích metód pacienta

> ⚠️ **Dôležité**: Nahratie medicínskej snímky **nenahradí** profilovú
> fotografiu pacienta. Kategória `imaging` uloží súbor do samostatného
> záznamu zobrazovacích metód. Ak omylom použijete inú kategóriu, snímka
> sa môže uložiť ako všeobecná príloha namiesto klinickej snímky.

### AI-asistovaná interpretácia

Po nahraní kliknite na **Analyzovať** pre spustenie AI interpretácie snímky.
Systém používa multimodálny model na poskytnutie štruktúrovanej interpretácie
s hodnotením spoľahlivosti:

| Odznak | Skóre | Význam |
|---|---|---|
| 🟢 **Vysoká** | ≥ 0,92 | Vysoká spoľahlivosť — vhodné na rýchlu kontrolu |
| 🟡 **Stredná** | 0,75 – 0,91 | Odporúča sa manuálna kontrola |
| 🔴 **Nízka** | < 0,75 | Nízka spoľahlivosť — povinná validácia riadok po riadku |

> ⚠️ **Všetky AI analýzy snímok sú návrhy.** Licencovaný veterinárny lekár
> musí interpretáciu skontrolovať cez potvrdzovaciu obrazovku
> **Klinická kontrola** pred jej uložením do trvalého zdravotného záznamu
> pacienta. AI nemôže priamo písať do záznamu.

### Aktuálne obmedzenia

| Funkcia | Stav |
|---|---|
| Plnohodnotný DICOM PACS (priame prepojenie RTG/CT prístrojov) | Plánovaný v1.0 — nie je ešte k dispozícii |
| AI analýza snímok | K dispozícii — upload súborov + multimodálna AI |
| Konektor scil Vet abc Plus RS-232 | Pripravuje sa v0.7 |
| Živé externé API konektory IDEXX / Zoetis | Parser existuje; živé API odložené na v0.7 |

---

Potrebujete pomoc? Napíšte na [hello@openvpm.com](mailto:hello@openvpm.com).
