/**
 * Contextual help content for each dashboard section.
 * Content is in Slovak (primary language for VetSykora pilot).
 * Keyed by route prefix – longest match wins.
 */

export interface HelpStep {
  icon: string;
  title: string;
  description: string;
}

export interface RelatedModule {
  name: string;
  href: string;
}

export interface PracticalExample {
  title: string;
  scenario: string;
  solution: string;
  badge?: string;
}

export interface HelpContent {
  title: string;
  intro: string;
  steps: HelpStep[];
  tips?: string[];
  relatedModules?: RelatedModule[];
  practicalExample?: PracticalExample;
}

export const HELP_CONTENT: Record<string, HelpContent> = {
  "/schedule": {
    title: "Rozvrh a kalendár",
    intro:
      "Tu spravujete všetky termíny ambulancie – vytvárate, upravujete a potvrdzujete návštevy pacientov.",
    steps: [
      {
        icon: "➕",
        title: "Vytvoriť termín",
        description:
          "Kliknite na prázdne miesto v kalendári alebo na tlačidlo „Nový termín\". Vyberte klienta, pacienta, dátum a čas.",
      },
      {
        icon: "✏️",
        title: "Upraviť termín",
        description:
          "Kliknite na existujúci termín a zvoľte „Upraviť\". Môžete zmeniť čas presunutím (drag & drop) alebo manuálne.",
      },
      {
        icon: "✅",
        title: "Potvrdiť príchod",
        description:
          "Po príchode klienta kliknite na termín a zvoľte „Potvrdiť príchod\". Pacient sa presunie do čakárne.",
      },
      {
        icon: "📋",
        title: "Otvoriť vizitu",
        description:
          "Z termínu otvorte vizitu tlačidlom „Otvoriť vyšetrenie\" – dostanete sa do SOAP záznamu.",
      },
    ],
    tips: [
      "Klávesová skratka Ctrl+K otvorí rýchle vyhľadávanie.",
      "Farebné kategórie termínov si nastavíte v Nastavenia → Rozvrh.",
    ],
    practicalExample: {
      title: "Akútny pacient bez predošlej rezervácie",
      badge: "Klinická prax",
      scenario: "Do ambulancie vstúpi majiteľ so psom s podozrením na torziu žalúdka (GDV). Nemá vytvorený termín vopred.",
      solution: "Kliknite na aktuálny časový slot v kalendári, zvoľte typ 'Akútny príjem (Urgent)' a označte 'Potvrdiť príchod'. Pacient sa ihneď zobrazí vo Whiteboarde a Čakárni pre celý personál.",
    },
  },

  "/patients": {
    title: "Pacienti",
    intro:
      "Zoznam všetkých pacientov (zvierat) zaregistrovaných vo vašej ambulancii.",
    steps: [
      {
        icon: "🔍",
        title: "Vyhľadať pacienta",
        description:
          "Použite vyhľadávací panel – hľadajte podľa mena zvieraťa, mena majiteľa alebo čísla záznamu.",
      },
      {
        icon: "➕",
        title: "Pridať nového pacienta",
        description:
          "Kliknite na „Nový pacient\", vyplňte druh, plemeno, dátum narodenia a priraďte klienta (majiteľa).",
      },
      {
        icon: "📁",
        title: "Otvoriť kartu pacienta",
        description:
          "Kliknite na meno pacienta – uvidíte históriu návštev, vakcinácie, lieky a prílohy.",
      },
      {
        icon: "📸",
        title: "Nahrať röntgen / snímku",
        description:
          "V karte pacienta → záložka „Zobrazovanie\" → „Nahrať snímku\". Snímka sa neprepíše ako profilová fotka.",
      },
    ],
    tips: [
      "Duplicitných pacientov nájdete cez Pacienti → Duplikáty.",
      "Zosnulých pacientov systém automaticky blokuje v marketingových kampaniach.",
    ],
    practicalExample: {
      title: "Registrácia šteňaťa a mikročipovanie do CRSZ",
      badge: "Legislatíva",
      scenario: "Majiteľ priniesol 8-týždňové šteňa na prvé očkovanie a čipovanie pred predajom.",
      solution: "Vytvorte kartu pacienta, zadajte číslo mikročipu a vykonajte vakcináciu. Systém vás automaticky upozorní na 24-hodinovú lehotu zápisu do CRSZ podľa § 19 ods. 9 zákona č. 39/2007 Z. z.",
    },
  },

  "/clients": {
    title: "Klienti (majitelia)",
    intro:
      "Správa klientov – fyzických a právnických osôb, ktoré sú majiteľmi pacientov.",
    steps: [
      {
        icon: "➕",
        title: "Pridať klienta",
        description:
          "Kliknite na „Nový klient\" a vyplňte meno, kontakt a adresu. Klient môže mať viacero pacientov.",
      },
      {
        icon: "🔗",
        title: "Prepojiť s pacientom",
        description:
          "V karte klienta v sekcii „Pacienti\" kliknite na „Pridať pacienta\" – buď existujúceho alebo nového.",
      },
      {
        icon: "💬",
        title: "Odoslať správu",
        description:
          "Z karty klienta môžete priamo odoslať SMS alebo e-mail cez tlačidlo „Správa\".",
      },
      {
        icon: "📄",
        title: "Zobraziť faktúry",
        description:
          "Záložka „Faktúry\" zobrazuje všetky vystavené doklady a históriu platieb klienta.",
      },
    ],
    tips: [
      "Klientom môžete prideliť tagy (VIP, Alergia na lieky) pre rýchlu identifikáciu.",
    ],
  },

  "/records": {
    title: "Klinické záznamy (SOAP)",
    intro:
      "Centrálny register všetkých klinických záznamov – SOAP poznámky, diagnózy, liečebné plány.",
    steps: [
      {
        icon: "📝",
        title: "Vytvoriť SOAP záznam",
        description:
          "Kliknite na „Nový záznam\" a vyberte pacienta. Vyplňte sekcie S (subjektívne), O (objektívne), A (hodnotenie), P (plán).",
      },
      {
        icon: "🎙️",
        title: "Hlasové diktovanie",
        description:
          "Kliknite na ikonu mikrofónu – nadiktujte poznámky a AI ich automaticky prepíše do SOAP formátu. Skontrolujte a potvrďte.",
      },
      {
        icon: "🤖",
        title: "AI návrh SOAP",
        description:
          "Po nahratí záznamu kliknite na „Vytvoriť AI návrh\". AI vygeneruje štruktúrovaný SOAP – vy ho skontrolujete a schválite.",
      },
      {
        icon: "✅",
        title: "Schváliť a uzavrieť",
        description:
          "Hotový SOAP schváľte tlačidlom „Finalizovať\" – záznam sa uzamkne a pridá sa do auditného denníka.",
      },
    ],
    tips: [
      "Záznamy sú read-only po finalizácii – chrání integritu klinickej dokumentácie.",
      "Hlasové nahrávky sa automaticky vymažú do 24 hodín (GDPR).",
    ],
  },

  "/encounters": {
    title: "Vizita (vyšetrenie)",
    intro:
      "Aktívna vizita pacienta – priestor pre SOAP záznam, predpisy, zobrazovanie a lekárske úkony.",
    steps: [
      {
        icon: "🩺",
        title: "Vyšetrenie",
        description:
          "Vyplňte nález v SOAP sekcii. Môžete použiť hlasové diktovanie alebo ručné zadanie.",
      },
      {
        icon: "💊",
        title: "Predpísať lieky",
        description:
          "V záložke „Lieky\" vyhľadajte liečivo, nastavte dávkovanie a vytlačte recept.",
      },
      {
        icon: "🔬",
        title: "Objednať laboratórne testy",
        description:
          "Záložka „Laboratórium\" → „Nový test\" – výsledky sa automaticky pripoja k záznamu.",
      },
      {
        icon: "💰",
        title: "Fakturovať úkony",
        description:
          "Po vizite kliknite na „Fakturovať\" – AI navrhne spoplatniteľné položky zo SOAP záznamu.",
      },
    ],
    tips: [
      "Röntgenové snímky nahrané počas vizity sa uložia do karty pacienta v sekcii Zobrazovanie.",
    ],
  },

  "/billing/ekasa": {
    title: "ePOkladňa (e-Kasa)",
    intro:
      "Fiškálna registračná pokladňa podľa Zákona 289/2008 Z. z. – online registrácia dokladov na portáli Finančnej správy SR.",
    steps: [
      {
        icon: "🖨️",
        title: "Vystaviť fiškálny doklad",
        description:
          "Po potvrdení platby kliknite na „Vytlačiť doklad\". Systém automaticky odošle doklad na e-Kasa server a vráti unikátny kód (OKP/PKP).",
      },
      {
        icon: "🔌",
        title: "Offline režim",
        description:
          "Pri výpadku internetu systém doklady uloží do fronty. Po obnovení spojenia sa automaticky synchronizujú – bez duplicít.",
      },
      {
        icon: "📊",
        title: "Denná uzávierka",
        description:
          "Na konci dňa vytvorte Z-správu cez tlačidlo „Uzávierka dňa\". Uloží sa do histórie pre účtovníka.",
      },
    ],
    tips: [
      "DPH sadzby (20 %, 10 %, 5 %) sa nastavujú pre každý tovar/službu v Nastavenia → Cenník.",
      "Každý doklad má unikátny UUID kľúč – systém zabraňuje dvojitému odoslaniu.",
    ],
  },

  "/billing": {
    title: "Fakturácia",
    intro:
      "Vystavovanie faktúr, správa platieb a prehľad tržieb vašej ambulancie.",
    steps: [
      {
        icon: "➕",
        title: "Nová faktúra",
        description:
          "Kliknite na „Nová faktúra\", vyberte klienta a pridajte položky. Systém automaticky vypočíta DPH.",
      },
      {
        icon: "💳",
        title: "Zaregistrovať platbu",
        description:
          "Pri faktúre kliknite na „Zaregistrovať platbu\" – hotovosť, karta alebo prevod. Hotovosť prechádza cez e-Kasa.",
      },
      {
        icon: "📤",
        title: "Odoslať faktúru",
        description:
          "Faktúru odošlite e-mailom priamo z aplikácie tlačidlom „Odoslať e-mailom\".",
      },
      {
        icon: "📊",
        title: "Prehľad tržieb",
        description:
          "Záložka „Reporty\" → „Tržby\" zobrazí mesačný a ročný prehľad príjmov podľa kategorií.",
      },
    ],
    tips: [
      "Pokladňa (POS) je optimalizovaná pre rýchlu obsluhu pri recepcii – klávesnicové skratky.",
    ],
    practicalExample: {
      title: "Rozdelenie platby (časť v hotovosti, časť platobnou kartou)",
      badge: "e-Kasa",
      scenario: "Klient platí vyšetrenie a operáciu v hodnote 180 € – 80 € chce zaplatiť v hotovosti a zvyšných 100 € platobnou kartou.",
      solution: "Pri uzatváraní dokladu v e-Kase zvoľte 'Kombinovaná platba', zadajte sumu pre Hotovosť a Karta a vytlačte fiškálny bloček v súlade so zákonom č. 289/2008 Z. z.",
    },
  },

  "/care-reminders": {
    title: "Pripomienky starostlivosti",
    intro:
      "Automatické pripomienky pre klientov – vakcinácie, prehliadky, antiparazitárna liečba.",
    steps: [
      {
        icon: "➕",
        title: "Vytvoriť pripomienku",
        description:
          "Kliknite na „Nová pripomienka\", vyberte pacienta, typ pripomienky a dátum odoslania.",
      },
      {
        icon: "📱",
        title: "Kanál odoslania",
        description:
          "Zvoľte SMS alebo e-mail. SMS sa odošlú cez Telnyx/Twilio, e-maily cez Resend.",
      },
      {
        icon: "✅",
        title: "Označiť ako vybavené",
        description:
          "Po návšteve klienta označte pripomienku ako „Vybavené\" – zmizne z aktívneho frontu.",
      },
      {
        icon: "🚫",
        title: "Automatické blokovanie",
        description:
          "Systém automaticky blokuje pripomienky pre zosnulých pacientov – nie je potrebný manuálny zásah.",
      },
    ],
    tips: [
      "Hromadné pripomienky (napr. pre všetkých neočkovaných psov) vytvoríte cez Marketingové kampane.",
    ],
  },

  "/inventory": {
    title: "Sklad a zásoby",
    intro:
      "Správa liečiv, spotrebného materiálu a zdravotníckych pomôcok na sklade.",
    steps: [
      {
        icon: "➕",
        title: "Pridať položku",
        description:
          "Kliknite na „Nová položka skladu\" a zadajte názov, kód, množstvo a minimálnu zásobu pre upozornenie.",
      },
      {
        icon: "📦",
        title: "Príjem tovaru",
        description:
          "Záložka „Príjem\" → naskenujte alebo zadajte kódy prijímaného tovaru. Stav skladu sa automaticky aktualizuje.",
      },
      {
        icon: "⚠️",
        title: "Upozornenia na nízky stav",
        description:
          "Položky pod minimálnou zásobou sú zvýraznené červenou farbou. Systém môže odoslať notifikáciu.",
      },
      {
        icon: "📋",
        title: "Inventúra",
        description:
          "Funkcia „Inventúra\" porovná fyzický stav so systémovým a vygeneruje rozdielový report.",
      },
    ],
    tips: [
      "Kontrolované látky (opiáty) sa spravujú v samostatnej sekcii Kontrolované látky – audit denník.",
    ],
  },

  "/lab-results": {
    title: "Laboratórne výsledky",
    intro:
      "Prehľad a správa výsledkov laboratórnych testov pre všetkých pacientov.",
    steps: [
      {
        icon: "📥",
        title: "Import výsledkov",
        description:
          "Výsledky z externého laboratória nahrajte vo formáte CSV alebo PDF. Systém ich automaticky priradí k pacientovi.",
      },
      {
        icon: "🔬",
        title: "Zobraziť výsledky",
        description:
          "Kliknite na riadok výsledku pre detail. Hodnoty mimo referenčného rozmedzia sú zvýraznené.",
      },
      {
        icon: "📎",
        title: "Pripojiť k záznamu",
        description:
          "Výsledok môžete pripojiť k SOAP záznamu pacienta tlačidlom „Pripojiť k vizite\".",
      },
    ],
    tips: [
      "AI môže extrahovať klinicky relevantné nálezy z PDF výsledkov a navrhnúť diagnózu.",
    ],
  },

  "/statutory": {
    title: "Zákonné registre (ŠVPS SR)",
    intro:
      "Povinná dokumentácia podľa Zákona 39/2007 Z. z. – registre pre Štátnu veterinárnu a potravinovú správu.",
    steps: [
      {
        icon: "🐕",
        title: "Kniha besnoty",
        description:
          "Po každom očkovaní proti besnote zadajte záznam. Systém vygeneruje 3-dňové upozornenie na notifikáciu RVPS.",
      },
      {
        icon: "💉",
        title: "Kniha ošetrení",
        description:
          "Záznamy o liečbe s liečivami – automaticky sledujte ochrannú lehotu (withdrawal period).",
      },
      {
        icon: "☠️",
        title: "Register eutanázií",
        description:
          "Zaznamenajte presnú dávku, spôsob likvidácie a asanačný podnik. Záznam je nemenný (audit trail).",
      },
      {
        icon: "📤",
        title: "Export pre úrad",
        description:
          "Tlačidlo „Exportovať\" vygeneruje PDF alebo XLSX správu vo formáte požadovanom RVPS / ŠVPS SR.",
      },
    ],
    tips: [
      "Informované súhlasy (anestézia, chirurgia, eutanázia) sú k dispozícii na digitálny podpis klientom.",
      "Záznamy v zákonných registroch sú read-only po uzavretí – chránené auditným reťazcom.",
    ],
  },

  "/controlled-substances": {
    title: "Kontrolované látky",
    intro:
      "Register omamných a psychotropných látok (opiáty) podľa Zákona 139/1998 Z. z. – imutabilný auditný denník.",
    steps: [
      {
        icon: "💊",
        title: "Zaznamenať výdaj",
        description:
          "Pri každom použití kontrolovanej látky zadajte množstvo, pacienta, dávkovanie a podpisujúceho veterinára.",
      },
      {
        icon: "📦",
        title: "Príjem zásob",
        description:
          "Príjem novej zásoby zaznamenajte s číslom dodacieho listu a šarže. Stav skladu sa automaticky aktualizuje.",
      },
      {
        icon: "📋",
        title: "Mesačný výkaz",
        description:
          "Systém automaticky generuje mesačný výkaz spotreby pre regionálnu veterinárnu správu.",
      },
    ],
    tips: [
      "Každý záznam je podpísaný digitálnym podpisom veterinára a je nemenný – chránený pred úpravou.",
      "Akýkoľvek pokus o úpravu záznamu sa zaznamená v auditnom denníku.",
    ],
  },

  "/marketing": {
    title: "Marketing a komunikácia",
    intro:
      "Nástroje na budovanie vzťahu s klientmi – kampane, automatizácia, recenzie a web.",
    steps: [
      {
        icon: "📧",
        title: "Nová kampaň",
        description:
          "Záložka „Správy\" → „Nová kampaň\". Vyberte cieľovú skupinu (druh zvieraťa, vek, posledná návšteva) a napíšte správu.",
      },
      {
        icon: "🤖",
        title: "Automatizácie",
        description:
          "Nastavte automatické správy – napr. „Ďakujeme za návštevu\" 2 hodiny po vizite alebo pripomienka po 6 mesiacoch.",
      },
      {
        icon: "⭐",
        title: "Google recenzie",
        description:
          "Záložka „Recenzie\" → systém automaticky osloví spokojných klientov so žiadosťou o recenziu na Google.",
      },
      {
        icon: "🌐",
        title: "Web ambulancie",
        description:
          "Záložka „Web\" → upravte informácie o ambulancii, otváracie hodiny a cenník – zmeny sa prejavia na vašom webe.",
      },
    ],
    tips: [
      "Systém automaticky blokuje marketingové kampane pre klientov zosnulých pacientov – Sympathy Gate je vždy aktívny.",
      "Brand Kit obsahuje vaše logo a farby – aplikuje sa automaticky na všetky komunikácie, letáky a web ambulancie.",
      "Začnite s tromi kľúčovými automatizáciami – potvrdenie termínu, poďakovanie po vizite a upomienka vakcinácie.",
      "Wellness plány sú najúčinnejším nástrojom pre zvýšenie celoročnej hodnoty klienta a retencie.",
      "Recenzie oslovujte do 3 hodín po vizite – konverzný kurz je v ten moment najvyšší.",
    ],
  },

  "/reports": {
    title: "Reporty a analytika",
    intro:
      "Prehľad výkonnosti ambulancie – tržby, pacienti, vizity, vakcinácie a ďalšie metriky.",
    steps: [
      {
        icon: "📊",
        title: "Finančný report",
        description:
          "Zobrazte tržby podľa mesiaca, roku alebo kategórie služby. Export do XLSX pre účtovníka.",
      },
      {
        icon: "🐾",
        title: "Pacientska štatistika",
        description:
          "Koľko nových pacientov, aké druhy zvierat, aký je retention rate klientov.",
      },
      {
        icon: "💉",
        title: "Vakcinačný prehľad",
        description:
          "Zoznam pacientov s expirujúcimi vakcináciami – podklad pre aktívne oslovenie klientov.",
      },
      {
        icon: "📅",
        title: "Výber obdobia",
        description:
          "Pomocou filtrov nastavte ľubovoľné obdobie – denné, týždenné, mesačné alebo vlastný rozsah.",
      },
    ],
    tips: ["Všetky reporty môžete exportovať ako PDF alebo XLSX."],
  },

  "/settings": {
    title: "Nastavenia",
    intro:
      "Konfigurácia ambulancie – profil, zamestnanci, cenník, integrácie a notifikácie.",
    steps: [
      {
        icon: "🏥",
        title: "Profil ambulancie",
        description:
          "Záložka „Všeobecné\" – upravte názov, adresu, IČO, DIČ a logo ambulancie.",
      },
      {
        icon: "👥",
        title: "Zamestnanci a roly",
        description:
          "Záložka „Zamestnanci\" – pozvite nových členov tímu a priraďte im roly (veterinár, technik, recepcia, admin).",
      },
      {
        icon: "💰",
        title: "Cenník",
        description:
          "Záložka „Cenník\" – definujte ceny výkonov a tovarov vrátane DPH sadzby pre správnu fakturáciu.",
      },
      {
        icon: "🔌",
        title: "Integrácie",
        description:
          "Prepojte SMS bránu (Telnyx/Twilio), e-mail (Resend), platby (Stripe) a e-Kasa fiškálnu tlačiareň.",
      },
    ],
    tips: [
      "Zmena roly zamestnanca sa prejaví okamžite – bez nutnosti odhlásenia.",
      "API kľúče pre integrácie nikdy nezdieľajte – sú šifrované v databáze.",
    ],
  },

  "/inbox": {
    title: "Správy (Inbox)",
    intro:
      "Centrálna schránka pre všetku komunikáciu s klientmi – SMS, e-maily a systémové správy.",
    steps: [
      {
        icon: "📨",
        title: "Nová správa",
        description:
          "Kliknite na „Napísať správu\", vyberte klienta a zvoľte kanál (SMS alebo e-mail).",
      },
      {
        icon: "💬",
        title: "Odpovedať",
        description:
          "Kliknite na správu v zozname a napíšte odpoveď priamo v konverzačnom vlákne.",
      },
      {
        icon: "✅",
        title: "Označiť ako vybavené",
        description:
          "Po vyriešení požiadavky klienta označte konverzáciu ako „Vybavené\" – zmizne z aktívneho frontu.",
      },
    ],
    tips: [
      "Neprečítané správy sú zvýraznené – počet zobrazuje badge v navigácii.",
    ],
  },

  "/vet-intel": {
    title: "Veterinárny trhový radar & legislatívny vestník",
    intro:
      "Strategický prehľad regionálneho trhu, konkurencie, úradných vestníkov (ŠVPS SR, KVL SR, ŠÚKL) a globálnych manažérskych trendov.",
    steps: [
      {
        icon: "🏢",
        title: "Trh & Konkurencia",
        description:
          "Zadajte PSČ alebo mesto – získate analýzu cien, vybavenia a hodnotení kliník v regióne.",
      },
      {
        icon: "⚖️",
        title: "Úradné vestníky & Právo",
        description:
          "Prehľad platných nariadení, núdzových opatrení (AMO, HPAI), stavovských predpisov a monitorovania liečiv.",
      },
      {
        icon: "💡",
        title: "AI Stratégia & Trendy",
        description:
          "Overené manažérske skúsenosti zo svetových kliník, cenotvorba a retencia pacientov.",
      },
    ],
    tips: [
      "Všetky trhové porovnania sú v súlade s Etickým kódexom KVL SR – slúžia výhradne pre interné rozhodovanie.",
      "Upozornenia ŠVPS SR sa aktualizujú podľa najnovších výnosov a vestníkov.",
    ],
    practicalExample: {
      title: "Preverenie cenotvorby a nových nariadení ŠVPS SR",
      badge: "Strategické riadenie",
      scenario: "Chcete nastaviť férovú cenu za vakcináciu a dentálnu hygienu v regióne a overiť povinnosti pri výskyte nákazy v okrese.",
      solution: "V záložke 'Trh & Konkurencia' zadajte vaše PSČ pre lokálny cenový benchmark. V záložke 'Úradné vestníky & Právo' okamžite vidíte platné mimoriadne núdzové opatrenia ŠVPS SR.",
    },
  },

  "/waiting-room": {
    title: "Čakáreň",
    intro:
      "Real-time zobrazenie pacientov čakajúcich na vyšetrenie – pre recepciu aj veterinárov.",
    steps: [
      {
        icon: "👋",
        title: "Check-in pacienta",
        description:
          "Keď klient príde, kliknite na termín v Rozvrhu → „Potvrdiť príchod\". Pacient sa automaticky objaví v čakárni.",
      },
      {
        icon: "🩺",
        title: "Zavolať na vyšetrenie",
        description:
          "Kliknite na pacienta v čakárni a zvoľte „Zavolať\" – pacient sa presuniedie do stavu „V ordinácii\".",
      },
      {
        icon: "⏱️",
        title: "Čas čakania",
        description:
          "Systém automaticky zobrazuje, ako dlho každý pacient čaká – pomáha prioritizovať.",
      },
    ],
    tips: [
      "Čakáreň sa automaticky obnovuje každých 30 sekúnd – nie je potrebné manuálne obnovovať stránku.",
    ],
  },

  "/whiteboard": {
    title: "Tabuľa (Whiteboard)",
    intro:
      "Denný prehľad pre celý tím – hospitalizovaní pacienti, úlohy a dôležité poznámky.",
    steps: [
      {
        icon: "🏥",
        title: "Hospitalizovaní pacienti",
        description:
          "Každý hospitalizovaný pacient má kartičku s aktuálnym stavom, liekmi a ďalším plánovaným úkonom.",
      },
      {
        icon: "📝",
        title: "Pridať poznámku",
        description:
          "Kliknite na „+ Poznámka\" a zadajte správu pre celý tím – upozornenia, pripomienky, špeciálne pokyny.",
      },
      {
        icon: "✅",
        title: "Označiť úlohu",
        description:
          "Každú úlohu (napr. kontrola drenu o 14:00) môžete označiť ako splnenú zaškrtnutím.",
      },
    ],
    tips: [
      "Tabuľa je zdieľaná v reálnom čase – zmeny sa zobrazia všetkým prihláseným okamžite.",
    ],
  },

  "/agent/voice": {
    title: "Hlasové diktovanie vyšetrenia",
    intro:
      "Vysoko presný klinický prepis hovoreného slova so slovenskou veterinárnou terminológiou a automatickým štruktúrovaním do SOAP.",
    steps: [
      {
        icon: "🐕",
        title: "Vybrať pacienta",
        description:
          "Zvoľte pacienta, ku ktorému bude diktát priradený, alebo kliknite na „Načítať demo nahrávku\" pre okamžité otestovanie.",
      },
      {
        icon: "🎙️",
        title: "Nahrať diktát alebo načítať vzor",
        description:
          "Stlačte mikrofón a hovorte, alebo načítajte ukážkovú nahrávku psa Bona s kontrolou artrózy.",
      },
      {
        icon: "✨",
        title: "Spracovať cez Gemini AI",
        description:
          "AI prevedie reč na text, zatriedi fakty do S-O-A-P a pripraví položky na vyúčtovanie.",
      },
      {
        icon: "📋",
        title: "Potvrdiť a uložiť do karty",
        description:
          "Veterinár skontroluje nález, potvrdí klinickú správnosť a uloží záznam priamo do kartotéky pacienta.",
      },
    ],
    tips: [
      "Hovorte prirodzeným tempom; AI rozumie skratkám (s.c., i.v., CRT, DKK, Meloxoral, Synulox).",
      "Využite tlačidlo „Načítať demo nahrávku\" na okamžité zoznámenie sa so systémom bez nutnosti nahrávať vlastné audio.",
    ],
    practicalExample: {
      title: "Rýchly záznam kontrolnej vizity psa",
      badge: "Klinická prax",
      scenario: "Máte 2 minúty medzi pacientmi a potrebujete zapísať výsledok kontroly lakťového kĺbu u labradora.",
      solution: "Otvorte /agent/voice, stlačte mikrofón a za 30 sekúnd nadiktujte nález. AI rozdelí text do SOAP, navrhne dávkovanie liečiv a jedným klikom vytvorí koncept účtu.",
    },
  },

  "/agent/imaging": {
    title: "AI analýza rádiologických snímkov",
    intro:
      "Multimodálna analýza röntgenových snímkov (RTG), DICOM dát, CT, MRI, USG a klinických fotografií s výpočtom VHS indexu.",
    steps: [
      {
        icon: "🐾",
        title: "Vybrať pacienta a snímku",
        description:
          "Vyberte pacienta, pretiahnite súbor (JPG, PNG, DICOM .dcm) alebo zvoľte ukážkovú RTG snímku.",
      },
      {
        icon: "🎯",
        title: "Rýchle diagnostické zameranie",
        description:
          "Kliknite na prednastavenú šablónu (Thorax/Srdce, Abdomen/Cudzie teleso, Končatiny/Fraktúra, Dentálny RTG).",
      },
      {
        icon: "⚡",
        title: "Spustiť AI analýzu snímku",
        description:
          "Jedným kliknutím sa snímok bezpečne nahrá a AI vygeneruje objektívny rádiologický popis nálezov.",
      },
      {
        icon: "❤️",
        title: "VHS kalkulačka a tlač správy",
        description:
          "Využite integrovanú kalkulačku kardiovertebrálneho indexu (VHS) a vytlačte oficiálnu lekársku správu pre majiteľa.",
      },
    ],
    tips: [
      "Systém podporuje medicínske DICOM súbory (.dcm) priamo v prehliadači bez nutnosti externej PACS stanice.",
      "Tlačidlo „Spustiť AI analýzu snímku\" automaticky spracuje a analyzuje vybranú snímku bez zbytočných medzikrokov.",
    ],
    practicalExample: {
      title: "Posúdenie kardiomegálie u kašľajúceho psa",
      badge: "Diagnostika",
      scenario: "10-ročný pes s kašľom a podozrením na kongestívne zlyhanie srdca. Máte laterálny RTG hrudníka.",
      solution: "Nahrajte RTG snímku do /agent/imaging, zvoľte šablónu 'Thorax / Srdce & Pľúca' a po analýze otvorte VHS kalkulačku pre presné vertebrálne skóre.",
    },
  },

  "/agent": {
    title: "AI Agent",
    intro:
      "Autonómny AI asistent pre klinické úlohy – zobrazovanie, hlasové SOAP záznamy a chirurgické plány.",
    steps: [
      {
        icon: "🗣️",
        title: "Zadať príkaz",
        description:
          "Napíšte príkaz v prirodzenom jazyku, napr. „Analyzuj röntgen pacienta Rex a navrhni diagnózu\".",
      },
      {
        icon: "🔬",
        title: "Analýza snímkov",
        description:
          "Agent automaticky načíta snímku z úložiska, spustí AI analýzu a vráti štruktúrovaný nález.",
      },
      {
        icon: "✅",
        title: "Schválenie výstupu",
        description:
          "Každý výstup agenta musíte potvrdiť pred uložením do klinického záznamu – bezpečnostná kontrola.",
      },
    ],
    tips: [
      "Agent vždy overí vaše oprávnenie pred vykonaním akéhokoľvek úkonu.",
      "Všetky akcie agenta sú zaznamenané v auditnom denníku s časovou pečiatkou.",
    ],
  },

  "/support": {
    title: "Podpora",
    intro:
      "Technická podpora a pomoc pri používaní OpenVPM AI – kontakt na tím, FAQ a reportovanie chýb.",
    steps: [
      {
        icon: "💬",
        title: "Kontaktovať podporu",
        description:
          "Kliknite na „Nový ticket\" a opíšte problém. Tím vám odpovie do 24 hodín.",
      },
      {
        icon: "🐛",
        title: "Nahlásiť chybu",
        description:
          "Ak narazíte na technickú chybu, použite „Nahlásiť chybu\" – systém automaticky priloží diagnostické informácie.",
      },
      {
        icon: "📚",
        title: "Dokumentácia",
        description:
          "Kliknite na „Dokumentácia\" pre prístup k úplnému manuálu a videám.",
      },
    ],
    tips: ["Pre urgentné problémy použite priamy chat v pravom dolnom rohu."],
  },

  "/": {
    title: "Dashboard – prehľad",
    intro:
      "Hlavná stránka poskytuje rýchly prehľad o dianí v ambulancii – dnešný rozvrh, čakajúci pacienti a dôležité upozornenia.",
    steps: [
      {
        icon: "📅",
        title: "Dnešný rozvrh",
        description:
          "Panel zobrazuje najbližšie termíny. Kliknite na termín pre rýchly prístup k vizite.",
      },
      {
        icon: "⚠️",
        title: "Upozornenia",
        description:
          "Červené a žlté upozornenia signalizujú urgentné veci – nízky sklad, nepotvrdené záznamy, expirujúce vakcinácie.",
      },
      {
        icon: "📊",
        title: "Dnešné tržby",
        description:
          "Widget tržieb zobrazuje aktuálny denný obrat vs. priemer za posledné 30 dní.",
      },
    ],
    tips: [
      "Ctrl+K otvorí globálne vyhľadávanie – rýchly prístup k pacientovi, klientovi alebo záznamu.",
    ],
  },

  "/marketing/handouts": {
    title: "Letáky a edukačné materiály",
    intro:
      "Modul Letáky umožňuje vytvárať profesionálne edukačné materiály a marketingové letáky pomocou AI generátora prispôsobeného veterinárnej praxi. Každý leták je možné personalizovať podľa druhu zvierat, témy kampane a vizuálnej identity ambulancie definovanej v Brand Kite. Hotové materiály možno vytlačiť, stiahnuť ako PDF alebo zdieľať cez automaticky generovaný QR kód priamo z aplikácie. Efektívne edukačné letáky zvyšujú záujem klientov o preventívnu starostlivosť a posilňujú lojalitu.",
    steps: [
      {
        icon: "➕",
        title: "Vytvoriť nový leták",
        description:
          "Kliknite na tlačidlo Nový leták a zadajte názov, tému a cieľovú skupinu – napr. psy, mačky alebo hospodárske zvieratá. Vyberte šablónu alebo nechajte AI vybrať najvhodnejšiu pre danú tému.",
      },
      {
        icon: "🤖",
        title: "AI generátor obsahu",
        description:
          "Kliknite na Generovať obsah – AI vytvorí profesionálny text letáku vrátane nadpisu, hlavného textu a výzvy k akcii. Text môžete ľubovoľne upraviť, doplniť o špecifické informácie ambulancie alebo lokálne kontaktné údaje.",
      },
      {
        icon: "🖼️",
        title: "Upraviť vizuálny dizajn",
        description:
          "V editore zmeňte farby, písma a obrázky podľa Brand Kitu vašej ambulancie. Leták automaticky prevezme logo a korporátne farby nastavené v sekcii Brand Kit pre jednotný profesionálny vzhľad.",
      },
      {
        icon: "🔒",
        title: "Nastaviť viditeľnosť",
        description:
          "Prepínač Verejný alebo Súkromný určuje, či bude leták dostupný na verejnom webe ambulancie alebo len interne pre personál. Verejné letáky sa automaticky zobrazia na webe ambulancie.",
      },
      {
        icon: "📱",
        title: "QR kód a zdieľanie",
        description:
          "Každý leták automaticky generuje unikátny QR kód, ktorý možno vytlačiť na papierový plagát, zobraziť na TV displeji v čakárni alebo vložiť do e-mailových kampaní. QR kód otvorí online verziu materiálu.",
      },
      {
        icon: "🖨️",
        title: "Tlač a export",
        description:
          "Tlačidlo Vytlačiť otvorí optimalizovaný PDF náhľad pre tlač na formáte A4 s farebnými profilmi pre profesionálnu tlačiareň. Môžete tiež exportovať do PDF alebo PNG pre digitálne použitie na sociálnych sieťach.",
      },
    ],
    tips: [
      "Letáky vytvorené s filtrom druhu zvieraťa sa zobrazujú len relevantným klientom pri personalizovanej komunikácii.",
      "Brand Kit zabezpečuje jednotný vizuál – logo a farby sa aplikujú automaticky na všetky nové letáky bez manuálneho nastavenia.",
      "Archív letákov uchováva všetky verzie – môžete sa vrátiť k staršiemu dizajnu alebo ho reaktivovať kedykoľvek.",
      "QR kódy letákov možno použiť priamo na tlačovinách, plagátoch v čakárni aj v e-mailových kampaniach.",
      "AI generátor podporuje slovenský aj anglický jazyk – obsah môžete vygenerovať pre medzinárodných klientov.",
    ],
  },

  "/marketing/brand-kit": {
    title: "Brand Kit – identita ambulancie",
    intro:
      "Brand Kit je centrálne úložisko vizuálnej identity vašej veterinárnej ambulancie – logo, farby, písma a kontaktné údaje. Všetky marketingové materiály, letáky, e-maily a web automaticky čerpajú z Brand Kitu, čo zaistuje jednotný a profesionálny vzhľad bez manuálneho nastavovania. Správne nastavený Brand Kit zvyšuje dôveru klientov a posilňuje rozpoznateľnosť ambulancie v lokálnom prostredí. Nastavenie je jednorazové a automaticky sa aplikuje na celý systém.",
    steps: [
      {
        icon: "🖼️",
        title: "Nahrať logo",
        description:
          "Kliknite na Zmeniť logo a nahrajte SVG alebo PNG súbor s transparentným pozadím. Odporúčané minimálne rozlíšenie je 512x512 px pre ostré zobrazenie na všetkých zariadeniach vrátane Retina displejov.",
      },
      {
        icon: "🎨",
        title: "Nastaviť firemné farby",
        description:
          "Zadajte primárnu a sekundárnu farbu ambulancie ako HEX kód alebo vyberte z farebného kolieska. Farby sa použijú na letákoch, e-mailoch, webe ambulancie a na TV displeji v čakárni.",
      },
      {
        icon: "✏️",
        title: "Vybrať písma",
        description:
          "Vyberte písmové rodiny pre nadpisy a telo textu zo zoznamu dostupných Google Fonts. Konzistentné písma pôsobia profesionálnejšie a zlepšujú čitateľnosť na rôznych zariadeniach a veľkostiach obrazoviek.",
      },
      {
        icon: "📋",
        title: "Vyplniť kontaktné údaje",
        description:
          "Zadajte názov ambulancie, adresu, telefón, e-mail a webovú stránku. Tieto údaje sa automaticky vkladajú do päty letákov, e-mailov a kontaktnej stránky webu bez nutnosti opakovaného zadávania.",
      },
      {
        icon: "👁️",
        title: "Zobraziť náhľad",
        description:
          "Tlačidlo Zobraziť náhľad ukazuje, ako bude Brand Kit vyzerať na letáku, e-maile a webe ambulancie. Skontrolujte kontrast farieb pre čitateľnosť textu – odporúčame minimálne WCAG AA štandard.",
      },
    ],
    tips: [
      "SVG formát loga zaistuje ostré zobrazenie pri akomkoľvek rozlíšení a zoomu – preferujte ho pred PNG.",
      "Použite farby s dostatočným kontrastom pre čitateľnosť textu – vstavaný test kontrastu vám pomôže.",
      "Zmena Brand Kitu sa prejaví v nových materiáloch – existujúce publikované letáky si zachovajú starý dizajn.",
      "Firemná paleta môže obsahovať až 5 doplnkových farieb pre rôzne typy komunikácie a kanálov.",
    ],
  },

  "/marketing/reviews": {
    title: "Recenzie – správa hodnotení",
    intro:
      "Modul Recenzie automatizuje zber spätnej väzby od spokojných klientov a generuje žiadosti o hodnotenie na Google alebo iných platformách v správnom čase po vizite. Pozitívne recenzie sú kľúčové pre potenciálnych klientov, ktorí vyberajú veterinára online – väčšina z nich číta recenzie pred prvou návštevou. Systém inteligentne oslovuje len klientov po úspešnej vizite a automaticky blokuje oslovovanie pri zosnulých pacientoch alebo klientoch, ktorí odvolali súhlas. Pravidelný monitoring hodnotení pomáha včas identifikovať problémy v kvalite služieb.",
    steps: [
      {
        icon: "⚙️",
        title: "Nakonfigurovať kampaň",
        description:
          "V nastaveniach recenzií zadajte odkaz na váš Google Business profil alebo Facebook stránku. Nastavte časový odstup po vizite, po ktorom sa odošle žiadosť – odporúčame 2 až 4 hodiny po ukončení vizity.",
      },
      {
        icon: "📝",
        title: "Upraviť šablónu správy",
        description:
          "Personalizujte text SMS alebo e-mailu so žiadosťou o recenziu. Použite premenné ako meno klienta a meno pacienta pre osobnejší dojem – personalizácia výrazne zvyšuje klikanosť a mieru odpovede.",
      },
      {
        icon: "🚀",
        title: "Aktivovať automatizáciu",
        description:
          "Prepnite prepínač Automatická kampaň do polohy Zapnuté. Systém bude od tej chvíle automaticky oslovovať klientov po každej ukončenej vizite bez nutnosti manuálneho zásahu personálu.",
      },
      {
        icon: "📊",
        title: "Sledovať štatistiky",
        description:
          "Záložka Štatistiky zobrazuje počet odoslaných žiadostí, mieru otvorenia, kliknutí a nových recenzií v časovom rozlíšení. Tieto dáta pomáhajú optimalizovať načasovanie a znenie správy pre vyšší dosah.",
      },
      {
        icon: "🔕",
        title: "Spravovať výnimky",
        description:
          "Klientom, ktorí nechcú dostávať žiadosti, nastavte príznak Nepožadovať o recenziu v ich karte. Systém ich automaticky vylúči zo všetkých budúcich kampaní so žiadosťami o hodnotenie.",
      },
    ],
    tips: [
      "Najvyššia miera odpovede je pri oslovení do 3 hodín po vizite – klient má ešte živé dojmy zo skúsenosti.",
      "Personalizované správy s menom klienta a pacienta dosahujú výrazne vyššiu mieru kliknutí.",
      "Systém automaticky blokuje žiadosti pre klientov so zosnulým pacientom – empatická ochrana je vždy aktívna.",
      "Negatívne hodnotenia monitorujte v reálnom čase a rýchlo reagujte verejnou odpoveďou cez sekciu Inbox.",
      "Prepojte viaceré platformy – Google aj Facebook – pre širší záber spätnej väzby od klientov.",
    ],
  },

  "/marketing/messages": {
    title: "Správy – SMS a e-mailová fronta",
    intro:
      "Modul Správy poskytuje centrálny prehľad a správu všetkých odoslaných aj čakajúcich SMS a e-mailových správ smerujúcich ku klientom vašej ambulancie. Fronta zobrazuje stav doručenia v reálnom čase – odoslané, doručené, neúspešné a čakajúce správy s plnou históriou pokusov. Manuálne správy z tohto modulu dopĺňajú automatické kampane z modulu Automatizácie pre úplný obraz komunikácie. Kompletná história komunikácie je pre každého klienta dostupná priamo v jeho karte.",
    steps: [
      {
        icon: "📨",
        title: "Zobraziť frontu",
        description:
          "Hlavná tabuľka zobrazuje všetky správy s ich aktuálnym stavom – zelená pre doručené, červená pre chybu, oranžová pre čakajúce. Filtrujte podľa dátumu, kanálu alebo konkrétneho klienta.",
      },
      {
        icon: "✉️",
        title: "Manuálna správa",
        description:
          "Kliknite na Nová správa, vyberte klienta a zadajte text. Vyberte kanál – SMS cez Telnyx alebo e-mail cez Resend – a potvrďte odoslanie. Správa sa zaradí do fronty a okamžite odošle.",
      },
      {
        icon: "🔁",
        title: "Znovu odoslať",
        description:
          "Pri správach so stavom Neúspešné kliknite na ikonu obnovenia – systém znovu odošle správu a zaznamená pokus do auditného denníka s presnou časovou pečiatkou.",
      },
      {
        icon: "📊",
        title: "Štatistiky doručiteľnosti",
        description:
          "Záložka Štatistiky ukazuje celkovú mieru doručiteľnosti SMS a e-mailov zvlásť a trend v čase. Pomáha identifikovať problémy s SMS bránami alebo neplatnými e-mailovými adresami v databáze.",
      },
      {
        icon: "📋",
        title: "Export komunikácie",
        description:
          "Celú komunikáciu s klientom môžete exportovať do PDF alebo CSV – užitočné pre auditné účely, právne spory alebo odovzdanie spisu pri zmene veterinára.",
      },
    ],
    tips: [
      "SMS sa doručia spoľahlivejšie ako e-mail – použite SMS pre urgentné oznámenia a blízkodobé pripomienky.",
      "E-mail odporúčame pre dlhšie edukačné správy, faktúry a letáky s prílohami.",
      "Nastavte fallback – ak SMS zlyhá, systém automaticky prepne na e-mail pre maximálnu doručiteľnosť.",
      "Zlyhané správy staršie ako 48 hodín sú automaticky označené na preskúmanie personálom.",
      "Pravidelne filtrujte Neúspešné správy a aktualizujte telefónne čísla klientov.",
    ],
  },

  "/marketing/automations": {
    title: "Automatizácie – triggery a workflow",
    intro:
      "Modul Automatizácie umožňuje nastaviť pravidlá, ktoré automaticky odosielajú správy klientom na základe udalostí v systéme – potvrdenie termínu, ukončenie vizity, blížiaca sa expirácia vakcíny alebo narodeniny pacienta. Automatizácie šetria čas personálu a zaistujú konzistentnú komunikáciu bez potreby manuálneho sledovania stoviek klientov. Každé pravidlo možno plne personalizovať a obmedziť na špecifické druhy zvierat, vek pacienta alebo typ vizity. Auditný záznam zaznamenáva každé spustenie automatizácie pre úplnú sledovateľnosť.",
    steps: [
      {
        icon: "➕",
        title: "Vytvoriť novú automatizáciu",
        description:
          "Kliknite na Nová automatizácia a vyberte spúšťač – napr. Po ukončení vizity, Pred termínom, Expirácia vakcinácie alebo Narodeniny pacienta. Každý spúšťač má vlastné parametre nastavenia a podmienky.",
      },
      {
        icon: "🎯",
        title: "Nastaviť podmienky",
        description:
          "Pridajte podmienky pre spustenie – napr. len pre psov, len pre klientov bez návštevy za posledných 6 mesiacov alebo len pri určitej diagnóze. Podmienky možno kombinovať logickými operátormi AND a OR.",
      },
      {
        icon: "✉️",
        title: "Definovať správu",
        description:
          "Napíšte text SMS alebo e-mailu a použite premenné pre automatickú personalizáciu. Nastavte časový offset – napr. 2 hodiny po vizite alebo 7 dní pred expiráciou vakcíny.",
      },
      {
        icon: "🔀",
        title: "Multi-kanálový workflow",
        description:
          "Automatizáciu nastavte tak, aby skúsila SMS a pri nedoručení automaticky prešla na e-mail. Týmto sa maximalizuje miera doručenia bez nutnosti manuálneho zásahu personálu.",
      },
      {
        icon: "▶️",
        title: "Aktivovať a monitorovať",
        description:
          "Prepnite automatizáciu do stavu Aktívna. V záložke História vidíte všetky spustenia, stav doručenia a prípadné chyby. Automatizáciu môžete kedykoľvek pozastaviť alebo deaktivovať.",
      },
      {
        icon: "📊",
        title: "Analýza výkonnosti",
        description:
          "Záložka Výkonnosť zobrazuje počet spustení, mieru kliknutí na správy a konverzných klientov, ktorí si následne rezervovali termín. Tieto dáta pomáhajú optimalizovať obsah a načasovanie.",
      },
    ],
    tips: [
      "Začnite s tromi základnými automatizáciami – potvrdenie termínu, poďakovanie po vizite a expirácia vakcíny.",
      "Nastavte časový rozostup – neposielajte správy v noci medzi 22:00 a 8:00 pre lepšiu recepciu klientmi.",
      "Testujte automatizácie na testovacích klientoch pred aktiváciou pre celú databázu.",
      "Sympathy Gate automaticky blokuje všetky automatizácie pri zosnulom pacientovi – nie je potrebná ručná intervencia.",
      "Kombinujte automatizácie s osobným follow-up telefonátom pre VIP klientov.",
      "Pravidelne kontrolujte históriu spustení – pomáha odhaliť chýbajúce telefónne čísla alebo e-maily.",
    ],
  },

  "/marketing/consents": {
    title: "GDPR súhlasy – správa súhlasov",
    intro:
      "Modul GDPR Súhlasy centralizuje zber, evidenciu a audit súhlasov klientov so spracúvaním osobných údajov v súlade s nariadením EÚ 2016/679 (GDPR) a zákonom č. 18/2018 Z. z. Každý súhlas je timestampovaný, verzionovaný a neimutabilne uložený v auditnom reťazci pre úplnú právnu ochranu ambulancie. Revokácia súhlasu okamžite blokuje všetky marketingové komunikácie pre daného klienta bez nutnosti manuálneho zásahu. Systém generuje certifikované výpisy súhlasov pre kontrolu Úradom na ochranu osobných údajov SR.",
    steps: [
      {
        icon: "📋",
        title: "Prehľad súhlasov",
        description:
          "Hlavná tabuľka zobrazuje všetkých klientov s ich aktuálnym stavom súhlasov – marketingové oslovovanie, zdieľanie údajov a newslettery. Filtrácia podľa stavu umožňuje rýchlu identifikáciu klientov bez platného súhlasu.",
      },
      {
        icon: "✍️",
        title: "Zaznamenať nový súhlas",
        description:
          "Kliknite na klienta a vyberte Zaznamenať súhlas. Vyberte typ súhlasu a kanál zberu – osobne, e-mail alebo web – a potvrďte. Systém automaticky zaznamená časovú pečiatku a IP adresu pri online zbere.",
      },
      {
        icon: "🚫",
        title: "Spravovať odvolanie",
        description:
          "Klientom, ktorí odvolali súhlas, kliknite na Odvolať súhlas. Všetky aktívne marketingové automatizácie pre tohto klienta sú okamžite pozastavené a odvolanie zaznamenané v auditnom denníku.",
      },
      {
        icon: "📤",
        title: "Export pre audit",
        description:
          "Tlačidlo Exportovať vygeneruje podpísaný PDF alebo CSV výpis všetkých súhlasov klienta. Dokument je použiteľný ako právny doklad pri kontrole ÚOOÚ SR alebo v prípadných právnych sporoch.",
      },
      {
        icon: "🔔",
        title: "Upozornenie na expiráciu",
        description:
          "Súhlasy s obmedzenou platnosťou sú automaticky sledované. Systém upozorní 30 dní pred expiráciou a umožňuje odoslať žiadosť o obnovenie súhlasu automatizovane cez SMS alebo e-mail.",
      },
    ],
    tips: [
      "Použite QR kód na recepcii pre rýchly digitálny zber súhlasov od klientov počas registrácie.",
      "Nastavte automatické obnovenie súhlasov e-mailom pred expiráciou – minimalizuje manuálnu prácu.",
      "Všetky odvolania súhlasov sú neimutabilne zaznamenané – dokladá súlad pri GDPR auditoch.",
      "Linkujte konkrétnu verziu Zásad ochrany osobných údajov k zaznamenanému súhlasu pre úplný audit trail.",
      "Pri akomkoľvek spore o súhlas exportujte certifikovaný PDF doklad z tohto modulu ako právny dôkaz.",
    ],
  },

  "/marketing/media": {
    title: "Knižnica médií – AI canvas",
    intro:
      "Modul Médiá slúži ako centrálne úložisko pre všetky obrázky, videá, PDF dokumenty a iné mediálne súbory používané vo vašich marketingových materiáloch. AI canvas umožňuje upravovať a generovať obrázky priamo v prehliadači bez nutnosti externých nástrojov ako Photoshop alebo Canva. Súbory sú organizované do priečinkov a tagov pre rýchle dohľadanie aj v rozsiahlej knižnici. Všetky mediálne súbory sú bezpečne uložené v cloudovom úložisku s automatickým zálohovaním.",
    steps: [
      {
        icon: "📁",
        title: "Organizovať mediálne súbory",
        description:
          "Vytvárajte priečinky pre rôzne typy obsahu – logo, fotky tímu, edukačné materiály a kampane. Súbory označte tagmi pre rýchle filtrovanie a vyhľadávanie v rozsiahlej knižnici.",
      },
      {
        icon: "⬆️",
        title: "Nahrať súbory",
        description:
          "Pretiahnutím alebo kliknutím na Nahrať pridajte obrázky vo formátoch JPG, PNG, SVG alebo WebP, PDF dokumenty alebo videoklip. Maximálna veľkosť súboru je 50 MB na jeden súbor.",
      },
      {
        icon: "🎨",
        title: "AI canvas editor",
        description:
          "Kliknite na Upraviť v AI Canvas pre otvorenie vstavaného editora. Môžete odstrániť pozadie, zmeniť farby, pridať text alebo nechať AI vygenerovať varianty obrázka pre rôzne formáty a kanály.",
      },
      {
        icon: "🔗",
        title: "Použiť v materiáloch",
        description:
          "Každý súbor má tlačidlo Kopírovať odkaz alebo Vložiť do letáku. Priame prepojenie s modulom Letáky umožňuje rýchle použitie mediálnych súborov bez opakovaného nahrávania obsahu.",
      },
      {
        icon: "🗑️",
        title: "Archivovanie a mazanie",
        description:
          "Nepoužívané súbory archivujte pre prehľadnosť bez trvalého mazania. Trvalé zmazanie je nevratné – systém vyžaduje potvrdenie a zaznamená akciu v auditnom denníku.",
      },
    ],
    tips: [
      "SVG a WebP formáty sú optimálne pre web – menšia veľkosť súboru a lepšia kvalita pri všetkých rozlíšeniach.",
      "AI canvas dokáže automaticky zmeniť rozmer obrázka pre rôzne kanály – Instagram, web, leták.",
      "Mediálna knižnica je zdieľaná pre celý tím – vytvorte jasné konvencie pomenovania súborov.",
      "Videá do 2 minút majú najvyššiu mieru doskovedenia v e-mailových kampaniach.",
      "Pravidelne archivujte zastaralé kampane pre zachovanie prehľadnosti knižnice.",
    ],
  },

  "/marketing/plan": {
    title: "Obsahový plán – editoriálny kalendár",
    intro:
      "Modul Obsahový plán poskytuje vizuálny kalendár pre plánovanie a koordináciu všetkých marketingových aktivít vašej ambulancie v predstihu. Tu plánujete kampane, letáky, príspevky na sociálne siete, e-mailové newslettery a iné komunikácie s klientmi. AI asistent môže navrhnúť optimálny harmonogram na základe sezónnych trendov vo veterinárnej starostlivosti – kliešte, vakcinácie, preventívne prehliadky. Tímová spolupráca na pláne je podporovaná v reálnom čase so synchronizáciou zmien.",
    steps: [
      {
        icon: "📅",
        title: "Zobraziť kalendár",
        description:
          "Prepínajte medzi mesačným, týždenným a denným pohľadom. Každá naplánovaná aktivita je farebne odlíšená podľa kanálu – SMS, e-mail, sociálne siete alebo tlačený leták.",
      },
      {
        icon: "➕",
        title: "Pridať novú aktivitu",
        description:
          "Kliknite na dátum v kalendári alebo na Pridať aktivitu. Zadajte typ obsahu, cieľovú skupinu, kanál a deadline pre prípravu obsahu. Aktivitu môžete priamo prepojiť s existujúcim letákom alebo kampaňou.",
      },
      {
        icon: "🤖",
        title: "AI návrh plánu",
        description:
          "Tlačidlo AI navrhnúť plán analyzuje vašich pacientov, sezónu a históriu kampaní a navrhne optimálny mesačný plán. Môžete akceptovať celý návrh alebo upraviť jednotlivé položky podľa vlastných potrieb.",
      },
      {
        icon: "👥",
        title: "Priradiť zodpovedné osoby",
        description:
          "Každú aktivitu môžete priradiť konkrétnemu členovi tímu. Zodpovedná osoba dostane notifikáciu a môže označiť aktivitu ako hotovú priamo z vlastného pohľadu.",
      },
      {
        icon: "📊",
        title: "Sledovať plnenie",
        description:
          "Farebné indikátory ukazujú stav každej aktivity – plánovaná, v príprave, hotová, odoslaná. Progress bar zobrazuje celkové plnenie mesačného plánu pre rýchly prehľad o stave kampane.",
      },
    ],
    tips: [
      "Plánujte obsah aspoň 2 týždne vopred pre dostatočný čas na prípravu a schválenie materiálov.",
      "Sezónne kampane – letné výlety, zimná antiparazitika – naplánujte mesiac vopred pre optimálny dosah.",
      "AI odporúčania zohľadňujú veterinárne sezóny – kliešte, vakcinácie a preventívne prehliadky.",
      "Exportujte mesačný plán do PDF pre prezentáciu celému tímu na porade.",
      "Prepojte aktivity v pláne priamo na letáky a kampane – šetrí čas pri realizácii.",
    ],
  },

  "/marketing/website": {
    title: "Web ambulancie – editor stránky",
    intro:
      "Modul Web umožňuje priamu editáciu obsahu vašej veterinárnej webovej stránky bez nutnosti programovania alebo kontaktovania webmastera. Zmeny sa prejavujú v reálnom čase na vašej verejnej webovej stránke hneď po uložení bez technickej závisosti. Editor obsahuje správu otváracích hodín, cenníka, tímu veterinárov, aktualít a kontaktných údajov s plnou kontrolou obsahu. SEO nastavenia zabezpečujú, aby noví klienti našli vašu ambulanciu pri hľadaní veterinára v okolí cez Google.",
    steps: [
      {
        icon: "🏠",
        title: "Upraviť domovskú stránku",
        description:
          "Záložka Domov – upravte uvítací text, obrázok hero bannera, kľúčové informácie a tlačidlá výzvy k akcii. Zmeny sa prejavia okamžite po uložení bez technickej závisosti.",
      },
      {
        icon: "⏰",
        title: "Aktualizovať otváracie hodiny",
        description:
          "Záložka Kontakt – Otváracie hodiny. Nastavte pravidelné hodiny pre každý deň týždňa a špeciálne hodiny pre sviatky alebo dovolenku ambulancie. Klienti uvidia vždy aktuálne informácie.",
      },
      {
        icon: "💰",
        title: "Spravovať cenník",
        description:
          "Záložka Cenník zobrazuje verejné ceny výkonov synchronizované s interným cenníkom. Môžete vybrať, ktoré položky sa zobrazia verejne a ktoré zostanú len interné pre personál.",
      },
      {
        icon: "📰",
        title: "Pridať aktualitu",
        description:
          "Záložka Aktuality – Nový príspevok. Napíšte nadpis, text a pridajte obrázok. Aktuality informujú klientov o novinkách, preventívnych kampaniach, zmenách v tíme alebo nových službách.",
      },
      {
        icon: "🔍",
        title: "SEO nastavenia",
        description:
          "Záložka SEO – nastavte meta titulok, meta popis a kľúčové slová pre každú stránku. Správne SEO zabezpečuje, že noví klienti nájdu vašu ambulanciu na prvej strane Google výsledkov.",
      },
    ],
    tips: [
      "Aktualizujte web pri každej zmene otváracích hodín – neaktuálne informácie frustrujú prichádzajúcich klientov.",
      "Pridávajte aktuality aspoň raz mesačne – Google uprednostňuje často aktualizované weby vo výsledkoch.",
      "Použite fotky reálnych zamestnancov a priestorov ambulancie – zvyšujú dôveru potenciálnych klientov.",
      "SEO meta popis by mal mať 150 až 160 znakov a obsahovať hlavné kľúčové slovo a lokalitu ambulancie.",
      "Skontrolujte web na mobilnom zariadení pred každou veľkou zmenou – väčšina klientov hľadá na telefóne.",
    ],
  },

  "/marketing/tv": {
    title: "TV displej – čakáreň",
    intro:
      "Modul TV Displej umožňuje zobrazovať edukačný a marketingový obsah na TV obrazovke v čakárni ambulancie bez nutnosti inštalácie akéhokoľvek softvéru na TV. Obsah sa riadi priamo z aplikácie a na TV sa zobrazuje cez webovú adresu v prehliadači – žiadna špeciálna krabička ani licencia nie je potrebná. Môžete zobrazovať letáky, aktuality, edukačné videá, otváracie hodiny alebo live čakaciu frontu pacientov. Rotácia obsahu je plne automatizovaná podľa nastaveného harmonogramu pre minimálnu manuálnu obsluhu.",
    steps: [
      {
        icon: "📺",
        title: "Nastaviť TV displej",
        description:
          "Na TV v čakárni otvorte prehliadač a zadajte URL zobrazenú v module TV Displej. Obrazovka sa automaticky spáruje s vaším účtom bez potreby prihlásenia alebo inštalácie aplikácie.",
      },
      {
        icon: "➕",
        title: "Pridať obsah na rotáciu",
        description:
          "Kliknite na Pridať obrazovku a vyberte obsah z knižnice – leták, video, obrázok alebo live widget ako čakacia fronta. Nastavte dobu zobrazenia v sekundách pre každý obsah zvlásť.",
      },
      {
        icon: "⏱️",
        title: "Nastaviť harmonogram",
        description:
          "Definujte časový harmonogram rotácie – iný obsah ráno, poobede a večer. Napríklad preventívne informácie počas rušných hodín a upokojujúci vizuálny obsah pri tichých hodinách čakárne.",
      },
      {
        icon: "📡",
        title: "Live widgety",
        description:
          "Widget Čakacia fronta zobrazuje čakajúcich pacientov v reálnom čase s odhadovaným časom čakania. Widget Aktuality zobrazuje najnovšie príspevky z webu ambulancie automaticky bez manuálnej aktualizácie.",
      },
      {
        icon: "🔄",
        title: "Vzdialené ovládanie",
        description:
          "Obsah na TV môžete meniť vzdialene z počítača alebo telefónu – napríklad pri kampani alebo pri aktualizácii informácií bez nutnosti ísť k TV fyzicky na recepciu.",
      },
    ],
    tips: [
      "Použite TV Displej na zobrazovanie QR kódov letákov – klienti ich môžu naskenovať priamo v čakárni.",
      "Rotácia obsahu 15 až 30 sekúnd na slajd je optimálna pre udržanie pozornosti čakajúcich klientov.",
      "Edukačné videá o preventívnej starostlivosti zvyšujú povedomie a znižujú počet opakujúcich sa otázok personálu.",
      "Počas sezóny kliešťov alebo iných rizík zobrazujte preventívne informácie pre zvýšenie záujmu o ochranu.",
      "Widget čakacej fronty znižuje neistotu klientov o čase čakania a zlepšuje zážitok z návštevy.",
    ],
  },

  "/marketing/wellness": {
    title: "Wellness plány – preventívna starostlivosť",
    intro:
      "Modul Wellness plány umožňuje vytvárať a spravovať individuálne preventívne plány starostlivosti pre každého pacienta so sledovaním plnenia a automatickými pripomienkami. Plány zahŕňajú vakcinačný harmonogram, antiparazitárnu liečbu, dentálne prehliadky a iné pravidelné úkony prispôsobené druhu a veku zvieraťa. Systém automaticky generuje pripomienky pre klientov pri blížiacich sa termínoch, čím zvyšuje compliance bez ďalšej práce personálu. Wellness plány sú jedným z najúčinnejších nástrojov pre zvýšenie retencie klientov a priemernej hodnoty ročnej návštevy.",
    steps: [
      {
        icon: "📋",
        title: "Vytvoriť wellness plán",
        description:
          "V karte pacienta záložka Wellness plán – Nový plán. Vyberte šablónu podľa druhu a veku zvieraťa alebo vytvorte vlastný plán na mieru. AI navrhne odporúčané úkony na základe profilu a histórie pacienta.",
      },
      {
        icon: "📅",
        title: "Nastaviť harmonogram",
        description:
          "Pre každý úkon v pláne nastavte frekvenciu – ročne, polročne, kvartálne alebo individuálne. Systém automaticky vypočíta najbližšie termíny a zaradí ich do kalendára ambulancie.",
      },
      {
        icon: "🔔",
        title: "Aktivovať pripomienky",
        description:
          "Zapnite automatické pripomienky pre klientov. Systém odošle SMS alebo e-mail 30, 14 a 3 dni pred plánovaným termínom – miera splnenia plánu sa tak výrazne zvyšuje bez manuálneho sledovania.",
      },
      {
        icon: "📊",
        title: "Sledovať plnenie",
        description:
          "Dashboard wellness plánov zobrazuje plnenie pre všetkých pacientov – zelená pre splnené, žltá pre blízky termín, červená pre po termíne. Filtrujte podľa druhu zvieraťa, veku alebo veterinára.",
      },
      {
        icon: "💰",
        title: "Wellness balíky",
        description:
          "Vytvorte predplatné wellness balíky, ktoré si klienti môžu zakúpiť mesačne alebo ročne. Balíky zahŕňajú určité počty návštev a výkonov za výhodné ceny a výrazne zvyšujú lojalitu klientov.",
      },
    ],
    tips: [
      "Wellness plány sú najúčinnejším nástrojom zvýšenia celoročnej hodnoty klienta a retencie.",
      "Odporúčajte wellness plán aktívne po každej preventívnej prehliadke – konverzný kurz je v tom momente najvyšší.",
      "Prispôsobte šablóny plánov pre seniorských pacientov nad 7 rokov s frekventnejším monitoringom zdravia.",
      "Klienti s wellness plánom navštevujú ambulanciu výrazne častejšie – kľúčový retencný nástroj.",
      "Exportujte zoznam pacientov so zaostávajúcimi plánmi na aktívnu outreach kampaň cez modul Správy.",
    ],
  },

  "/marketing/competitors": {
    title: "Analýza konkurencie",
    intro:
      "Modul Analýza konkurencie poskytuje prehľad o veterinárnych ambulanciách a klinikách v okolí – ich online prítomnosti, hodnoteniach na Google a marketingových aktivitách. Pravidelná analýza pomáha identifikovať príležitosti na diferenciáciu a oblasti, kde môžete zlepšiť svoje služby oproti konkurencii. AI pravidelne aktualizuje dáta z verejných zdrojov – Google Maps, sociálne siete a verejné cenníky – bez manuálneho vyhľadávania. Výstupy analýzy pomáhajú formulovať marketingovú stratégiu ambulancie na základe reálnych trhových dát.",
    steps: [
      {
        icon: "🗺️",
        title: "Prehľad okolia",
        description:
          "Mapa zobrazuje veterinárne ambulancie v nastaviteľnom okruhu – 5, 10 alebo 20 km. Každá ambulancia je zobrazená s hodnotením, počtom recenzií a odhadom veľkosti a špecializácie.",
      },
      {
        icon: "⭐",
        title: "Porovnanie hodnotení",
        description:
          "Tabuľka porovnáva vaše Google hodnotenie s konkurenciou v čase. Vidíte, či sa vaše hodnotenie zlepšuje rýchlejšie alebo pomalšie ako ostatní veterinári v regióne.",
      },
      {
        icon: "📊",
        title: "Analýza silných a slabých stránok",
        description:
          "AI analyzuje recenzie konkurencie a identifikuje časté sťažnosti klientov – dlhé čakanie, ceny, komunikácia. Tieto informácie sú príležitosťou – vyniknite tam, kde konkurencia zaostáva.",
      },
      {
        icon: "📰",
        title: "Marketing konkurencie",
        description:
          "Prehľad verejných kampaní, príspevkov na sociálnych sieťach a akcií konkurencie. Inšpirujte svoju stratégiu a načasujte vlastné kampane najefektívnejšie voči konkurenčným aktivitám.",
      },
      {
        icon: "🔔",
        title: "Automatické upozornenia",
        description:
          "Nastavte upozornenia pri zmene hodnotenia konkurenta alebo novej kampani. Systém vás proaktívne informuje o dôležitých zmenách v konkurenčnom prostredí v reálnom čase.",
      },
    ],
    tips: [
      "Analyzujte 1-hviezdičkové recenzie konkurentov – odhaľujú opakujúce sa problémy, ktoré môžete riešiť lepšie.",
      "Sledujte cenník konkurencie pre informované rozhodovanie o vlastných cenách a akciovej politike.",
      "Diferenciácia na základe špecialistov alebo vybavenia je dlhodobejšia konkurenčná výhoda ako cena.",
      "Reagujte na recenzie rýchlejšie ako konkurencia – klienti si to všímajú a oceňujú záujem ambulancie.",
      "Exportujte mesačný report konkurencie pre strategickú poradu vedenia ambulancie.",
    ],
  },
};

/** Related modules for each section. */
const RELATED_MODULES: Record<string, RelatedModule[]> = {
  "/": [
    { name: "Rozvrh", href: "/schedule" },
    { name: "Pacienti", href: "/patients" },
    { name: "Čakáreň", href: "/waiting-room" },
    { name: "Fakturácia", href: "/billing" },
  ],
  "/schedule": [
    { name: "Pacienti", href: "/patients" },
    { name: "Čakáreň", href: "/waiting-room" },
    { name: "Záznamy", href: "/records" },
    { name: "Fakturácia", href: "/billing" },
  ],
  "/patients": [
    { name: "Záznamy", href: "/records" },
    { name: "Rozvrh", href: "/schedule" },
    { name: "Fakturácia", href: "/billing" },
    { name: "Lab výsledky", href: "/lab-results" },
  ],
  "/clients": [
    { name: "Pacienti", href: "/patients" },
    { name: "Fakturácia", href: "/billing" },
    { name: "Inbox", href: "/inbox" },
    { name: "Marketing", href: "/marketing" },
  ],
  "/records": [
    { name: "Pacienti", href: "/patients" },
    { name: "AI Agent", href: "/agent" },
    { name: "VetIntel", href: "/vet-intel" },
    { name: "Fakturácia", href: "/billing" },
  ],
  "/encounters": [
    { name: "Záznamy", href: "/records" },
    { name: "Fakturácia", href: "/billing" },
    { name: "Lab výsledky", href: "/lab-results" },
    { name: "AI Agent", href: "/agent" },
  ],
  "/billing": [
    { name: "e-Kasa", href: "/billing/ekasa" },
    { name: "Reporty", href: "/reports" },
    { name: "Nastavenia", href: "/settings" },
    { name: "Klienti", href: "/clients" },
  ],
  "/billing/ekasa": [
    { name: "Fakturácia", href: "/billing" },
    { name: "Nastavenia", href: "/settings" },
    { name: "Reporty", href: "/reports" },
  ],
  "/care-reminders": [
    { name: "Pacienti", href: "/patients" },
    { name: "Marketing", href: "/marketing" },
    { name: "Rozvrh", href: "/schedule" },
    { name: "Inbox", href: "/inbox" },
  ],
  "/inventory": [
    { name: "Fakturácia", href: "/billing" },
    { name: "Kontrolované látky", href: "/controlled-substances" },
    { name: "Záznamy", href: "/records" },
  ],
  "/lab-results": [
    { name: "Záznamy", href: "/records" },
    { name: "Pacienti", href: "/patients" },
    { name: "VetIntel", href: "/vet-intel" },
  ],
  "/statutory": [
    { name: "Záznamy", href: "/records" },
    { name: "Kontrolované látky", href: "/controlled-substances" },
    { name: "Pacienti", href: "/patients" },
  ],
  "/controlled-substances": [
    { name: "Zákonné registre", href: "/statutory" },
    { name: "Sklad", href: "/inventory" },
    { name: "Záznamy", href: "/records" },
  ],
  "/marketing": [
    { name: "Klienti", href: "/clients" },
    { name: "Inbox", href: "/inbox" },
    { name: "Pripomienky", href: "/care-reminders" },
    { name: "Fakturácia", href: "/billing" },
  ],
  "/reports": [
    { name: "Fakturácia", href: "/billing" },
    { name: "Záznamy", href: "/records" },
    { name: "Rozvrh", href: "/schedule" },
  ],
  "/settings": [
    { name: "Fakturácia", href: "/billing" },
    { name: "e-Kasa", href: "/billing/ekasa" },
    { name: "Marketing", href: "/marketing" },
  ],
  "/inbox": [
    { name: "Klienti", href: "/clients" },
    { name: "Marketing", href: "/marketing" },
    { name: "Pripomienky", href: "/care-reminders" },
  ],
  "/vet-intel": [
    { name: "Záznamy", href: "/records" },
    { name: "Lab výsledky", href: "/lab-results" },
    { name: "AI Agent", href: "/agent" },
  ],
  "/waiting-room": [
    { name: "Rozvrh", href: "/schedule" },
    { name: "Pacienti", href: "/patients" },
    { name: "Tabuľa", href: "/whiteboard" },
  ],
  "/whiteboard": [
    { name: "Čakáreň", href: "/waiting-room" },
    { name: "Pacienti", href: "/patients" },
    { name: "Rozvrh", href: "/schedule" },
  ],
  "/agent": [
    { name: "Záznamy", href: "/records" },
    { name: "VetIntel", href: "/vet-intel" },
    { name: "Lab výsledky", href: "/lab-results" },
  ],
  "/support": [
    { name: "Nastavenia", href: "/settings" },
    { name: "Dashboard", href: "/" },
  ],
  "/marketing/handouts": [
    { name: "Marketing", href: "/marketing" },
    { name: "Brand Kit", href: "/marketing/brand-kit" },
    { name: "Médiá", href: "/marketing/media" },
    { name: "Pacienti", href: "/patients" },
  ],
  "/marketing/brand-kit": [
    { name: "Marketing", href: "/marketing" },
    { name: "Letáky", href: "/marketing/handouts" },
    { name: "Web", href: "/marketing/website" },
    { name: "TV Displej", href: "/marketing/tv" },
  ],
  "/marketing/reviews": [
    { name: "Marketing", href: "/marketing" },
    { name: "Automatizácie", href: "/marketing/automations" },
    { name: "Správy", href: "/marketing/messages" },
    { name: "Klienti", href: "/clients" },
  ],
  "/marketing/messages": [
    { name: "Marketing", href: "/marketing" },
    { name: "Automatizácie", href: "/marketing/automations" },
    { name: "Inbox", href: "/inbox" },
    { name: "Klienti", href: "/clients" },
  ],
  "/marketing/automations": [
    { name: "Marketing", href: "/marketing" },
    { name: "Správy", href: "/marketing/messages" },
    { name: "Recenzie", href: "/marketing/reviews" },
    { name: "Pripomienky", href: "/care-reminders" },
  ],
  "/marketing/consents": [
    { name: "Marketing", href: "/marketing" },
    { name: "Klienti", href: "/clients" },
    { name: "Nastavenia", href: "/settings" },
  ],
  "/marketing/media": [
    { name: "Marketing", href: "/marketing" },
    { name: "Letáky", href: "/marketing/handouts" },
    { name: "Brand Kit", href: "/marketing/brand-kit" },
    { name: "Obsahový plán", href: "/marketing/plan" },
  ],
  "/marketing/plan": [
    { name: "Marketing", href: "/marketing" },
    { name: "Letáky", href: "/marketing/handouts" },
    { name: "Automatizácie", href: "/marketing/automations" },
    { name: "Správy", href: "/marketing/messages" },
  ],
  "/marketing/website": [
    { name: "Marketing", href: "/marketing" },
    { name: "Brand Kit", href: "/marketing/brand-kit" },
    { name: "Obsahový plán", href: "/marketing/plan" },
    { name: "Médiá", href: "/marketing/media" },
  ],
  "/marketing/tv": [
    { name: "Marketing", href: "/marketing" },
    { name: "Letáky", href: "/marketing/handouts" },
    { name: "Médiá", href: "/marketing/media" },
    { name: "Čakáreň", href: "/waiting-room" },
  ],
  "/marketing/wellness": [
    { name: "Marketing", href: "/marketing" },
    { name: "Pacienti", href: "/patients" },
    { name: "Pripomienky", href: "/care-reminders" },
    { name: "Rozvrh", href: "/schedule" },
  ],
  "/marketing/competitors": [
    { name: "Marketing", href: "/marketing" },
    { name: "Recenzie", href: "/marketing/reviews" },
    { name: "Reporty", href: "/reports" },
  ],
};

/**
 * Find help content for a given pathname.
 * Uses longest-prefix matching so /billing/ekasa wins over /billing.
 * Merges relatedModules from RELATED_MODULES map.
 */
export function getHelpContent(pathname: string): HelpContent | null {
  const candidates = Object.keys(HELP_CONTENT)
    .filter((key) => pathname === key || pathname.startsWith(key + "/") || (key !== "/" && pathname.startsWith(key)))
    .sort((a, b) => b.length - a.length);

  // Special-case root
  const key = candidates[0] ?? (pathname === "/" ? "/" : null);
  if (!key) return null;

  const base = HELP_CONTENT[key];
  if (!base) return null;

  return {
    ...base,
    relatedModules: RELATED_MODULES[key] ?? [],
  };
}
