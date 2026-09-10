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

export interface HelpContent {
  title: string;
  intro: string;
  steps: HelpStep[];
  tips?: string[];
  relatedModules?: RelatedModule[];
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
      "Systém automaticky blokuje marketingové kampane pre klientov zosnulých pacientov.",
      "Brand Kit obsahuje vaše logo a farby – použije sa pri všetkých komunikáciách.",
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
    title: "VetIntel – AI analýzy",
    intro:
      "Prehľad AI analýz a odporúčaní vygenerovaných pre pacientov vašej ambulancie.",
    steps: [
      {
        icon: "🧠",
        title: "Zobraziť AI analýzu",
        description:
          "Kliknite na záznam pre detail AI nálezu – diagnóza, diferenciálna diagnóza, odporúčaný postup.",
      },
      {
        icon: "✅",
        title: "Schváliť alebo zamietnuť",
        description:
          "Každý AI návrh musí schváliť veterinár. Kliknite na „Schváliť\" alebo „Zamietnuť a upraviť\".",
      },
      {
        icon: "📊",
        title: "Prehľad presnosti",
        description:
          "Záložka „Štatistiky\" zobrazuje, ako presne AI odhadovala diagnózy v porovnaní s finálnymi lekárskymi závermi.",
      },
    ],
    tips: [
      "AI nikdy nerozhoduje sama – všetky návrhy vyžadujú veterinárne potvrdenie (clinician confirmation).",
      "Auditný denník záznamu uchováva celú históriu AI návrhov a ľudských schválení.",
    ],
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
