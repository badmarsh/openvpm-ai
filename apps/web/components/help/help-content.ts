/**
 * Contextual help content for each dashboard section in OpenVPM AI.
 * Content is in Slovak (primary language for Slovak veterinary clinical pilot).
 * Keyed by route prefix – longest match wins in getHelpContent().
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
  "/": {
    title: "Hlavný prehľad & ranný brífing",
    intro:
      "Centrálny operačný pult vašej ambulancie poskytujúci okamžitý prehľad o denných vizitách, stave čakárne, hospitalizovaných pacientoch v boxoch, denných tržbách e-Kasy a bezpečnostných výstrahách (neuzavreté SOAP správy, expirujúce vakcíny, nízke zásoby liečiv). Každé ráno generuje automatický brífing pre personál s prioritizáciou akútnych úloh.",
    steps: [
      {
        icon: "🌅",
        title: "Skontrolovať ranný brífing",
        description:
          "Prezrite si zoznam hospitalizovaných pacientov na rannú medikáciu, plánované operačné zákroky a zoznam neuzatvorených klinických záznamov z predchádzajúceho dňa.",
      },
      {
        icon: "📅",
        title: "Prehľad denného rozvrhu",
        description:
          "Sledujte najbližšie termíny jednotlivých lekárov. Kliknutím na termín otvoríte priamy prechod do vyšetrenia alebo potvrdíte príchod klienta do čakárne.",
      },
      {
        icon: "⚡",
        title: "Globálne vyhľadávanie (Ctrl+K)",
        description:
          "Stlačením Ctrl+K alebo kliknutím na vyhľadávací panel okamžite nájdete akéhokoľvek pacienta, majiteľa, čip, vystavenú faktúru alebo liek na sklade.",
      },
      {
        icon: "⚠️",
        title: "Riešenie klinických výstrah",
        description:
          "Červené a oranžové odznaky upozorňujú na kritické udalosti – blížiaca sa 3-dňová lehota hlásenia besnoty na RVPS, kritický stav lieku v trezore alebo výpadok e-Kasa spojenia.",
      },
      {
        icon: "📊",
        title: "Monitoring denných tržieb",
        description:
          "Widget tržieb zobrazuje aktuálny denný obrat, pomer platieb v hotovosti a kartou a porovnanie s priemerom za posledných 30 dní pre finančnú kontrolu.",
      },
    ],
    tips: [
      "Klávesová skratka Ctrl+K (Cmd+K na Macu) funguje z ktorejkoľvek podstránky systému na bleskový prechod kamkoľvek.",
      "Kliknutím na widget 'Hospitalizácie' prejdete priamo do zobrazenia Whiteboardu pre odovzdanie zmeny.",
      "Farebná bodka pri stave e-Kasy signalizuje online spojenie s portálom Finančnej správy SR (zelená = OK, žltá = offline fronta).",
      "Ranný brífing automaticky zvýrazňuje pacientov s rizikovými diagnózami alebo vyžadujúcich kontrolu po anestézii.",
    ],
    practicalExample: {
      title: "Ranný štart ordinácie a príprava personálu",
      badge: "Denná rutina",
      scenario:
        "Veterinárny lekár a sestra prichádzajú do práce o 7:45. O 8:00 začínajú plánované operácie a o 8:30 bežné ambulantné vyšetrenia. Potrebujú rýchlo vedieť, kto je hospitalizovaný a aké lieky podať.",
      solution:
        "Na Dashboarde skontrolujú ranný brífing: vidia 2 hospitalizovaných psov po nočnej operácii s časom rannej dávky antibiotík a prvého objednaného pacienta na 8:00 s podozrením na cudzie teleso. Kliknutím na hospitalizáciu otvoria Whiteboard a rovno zaevidujú podanie ranných liekov.",
    },
  },

  "/schedule": {
    title: "Rozvrh a plánovanie termínov",
    intro:
      "Viacstĺpcový kalendár ambulancie pre plánovanie návštev, chirurgických sál a ordinačných hodín personálu. Podporuje drag & drop presúvanie, farebné kódovanie typov úkonov, automatické overenie prekrývania lekárov a priame prepojenie na check-in v čakárni a klientsky portál.",
    steps: [
      {
        icon: "➕",
        title: "Vytvorenie nového termínu",
        description:
          "Kliknite na voľný časový slot alebo tlačidlo „Nový termín\". Vyberte klienta, pacienta, priraďte lekára a zvoľte typ výkonu (prevencia, chirurgia, akútne, kontrola).",
      },
      {
        icon: "✋",
        title: "Presun a zmena času (Drag & Drop)",
        description:
          "Termín jednoducho potiahnite myšou na iný čas alebo k inému lekárovi. Systém automaticky skontroluje kolízie v rozvrhu.",
      },
      {
        icon: "🚪",
        title: "Potvrdenie príchodu (Check-in)",
        description:
          "Keď klient dorazí do ambulancie, kliknite na termín a zvoľte „Potvrdiť príchod\". Pacient sa okamžite objaví v Čakárni s časom príchodu.",
      },
      {
        icon: "📋",
        title: "Prechod do vizity (SOAP)",
        description:
          "Priamo z detailu termínu kliknite na „Začať vyšetrenie\" – otvorí sa aktívna vizita s predvyplnenými údajmi pacienta a dôvodom návštevy.",
      },
      {
        icon: "🔔",
        title: "Odoslanie SMS notifikácie",
        description:
          "Pri vytvorení alebo zmene termínu systém ponúka možnosť okamžitého odoslania potvrdzujúcej SMS s presným dátumom a adresou kliniky.",
      },
    ],
    tips: [
      "Využite funkciu „Odoberať kalendár\" v pravom hornom rohu na synchronizáciu s Google Calendar, iPhone alebo Outlookom.",
      "Farebné kategórie termínov (zelená = prevencia, červená = akútne, modrá = chirurgia) si môžete prispôsobiť v Nastavenia → Rozvrh.",
      "Medzerník na označenom termíne otvorí rýchly náhľad anamnézy pacienta bez opustenia kalendára.",
      "Pre objednávanie cez telefón majte zapnutý filter podľa dostupných lekárov v hornej lište.",
    ],
    practicalExample: {
      title: "Akútny pacient bez rezervácie počas plného kalendára",
      badge: "Klinická prax",
      scenario:
        "V čakárni sa objaví majiteľ so psom v šoku po autonehode. Kalendár na nasledujúce 2 hodiny je kompletne obsadený plánovanými vakcináciami.",
      solution:
        "Kliknite na aktuálny čas v rozvrhu, zvoľte typ 'Akútny príjem (Urgent)', zaškrtnite 'Potvrdiť príchod'. Pacient sa ihneď zobrazí s červeným prioritným blikaním vo Whiteboarde a Čakárni pre celý personál.",
    },
  },

  "/patients": {
    title: "Kartotéka pacientov (zvierat)",
    intro:
      "Kompletná elektronická zdravotná karta zvieraťa v súlade s legislatívnymi požiadavkami KVL SR a ŠVPS SR. Uchováva chronologickú históriu vyšetrení SOAP, vakcinačnú knižku, evidenciu mikročipov, PetPassov, RTG/USG snímok, laboratórnych protokolov, vydaných liečiv a ochranných lehôt.",
    steps: [
      {
        icon: "🔍",
        title: "Vyhľadanie a filtre",
        description:
          "Hľadajte podľa mena zvieraťa, priezviska majiteľa, čísla ISO mikročipu (15 číslic), čísla pasu alebo tetovania.",
      },
      {
        icon: "➕",
        title: "Registrácia nového pacienta",
        description:
          "Zvoľte „Nový pacient\", vyplňte druh, plemeno, pohlavie, kastráciu, dátum narodenia a priraďte existujúceho alebo nového majiteľa.",
      },
      {
        icon: "💉",
        title: "Vakcinačná karta a pas",
        description:
          "V záložke „Vakcinácie\" evidujte aplikované očkovacie látky vrátane čísla šarže (Lot), exspirácie a termínu revakcinácie.",
      },
      {
        icon: "📸",
        title: "Zobrazovacie vyšetrenia (RTG/USG)",
        description:
          "Záložka „Zobrazovanie\" umožňuje nahrávať RTG a DICOM snímky. Nahraná snímka sa bezpečne uloží v karte bez prepísania profilovej fotky.",
      },
      {
        icon: "📄",
        title: "Export zdravotnej karty do PDF",
        description:
          "Tlačidlo „Export karty\" vygeneruje kompletný chronologický výpis vyšetrení a liečby pre poisťovňu alebo preberajúceho veterinára.",
      },
    ],
    tips: [
      "Číslo čipu môžete zadať priložením USB čítačky k počítaču – kód sa automaticky vpíše do poľa transpondéra.",
      "Pri mačkách systém striktne blokuje kalkuláciu a predpis liekov s obsahom permetrínu a paracetamolu pre ich smrteľnú toxicitu.",
      "Zosnulí pacienti (stav: Deceased) sú automaticky zaradení pod 'Sympathy Gate' – systém zablokuje všetky marketingové a upomienkové správy majiteľovi.",
      "Duplicitné karty vzniknuté paralelnou registráciou môžete bezpečne spojiť cez Pacienti → Duplikáty.",
    ],
    practicalExample: {
      title: "Registrácia šteňaťa, čipovanie a zápis do CRSZ",
      badge: "Legislatíva",
      scenario:
        "Majiteľ priniesol 8-týždňové šteňa border kólie na prvé očkovanie, aplikáciu mikročipu a vystavenie pasu spoločenských zvierat.",
      solution:
        "Založte kartu šteňaťa, oskenujte mikročip USB čítačkou, zaevidujte podanie vakcíny Nobivac Puppy DP. Systém automaticky aktivuje 24-hodinový odpočet na zákonný zápis údajov do Centrálneho registra spoločenských zvierat (CRSZ) podľa § 19 ods. 9 zákona č. 39/2007 Z. z.",
    },
  },

  "/patients/duplicates": {
    title: "Manažment duplicít v kartotéke",
    intro:
      "Nástroj pre identifikáciu a bezpečné zlúčenie duplicitných kariet pacientov vzniknutých paralelnou registráciou na recepcii alebo importom zo starších veterinárnych softvérov (WinVet, Vetis). Umožňuje porovnať karty vedľa seba a spojiť celú históriu vizít, faktúr a príloh do jedného profilu bez straty údajov.",
    steps: [
      {
        icon: "🔍",
        title: "Automatická detekcia duplicít",
        description:
          "Systém skenuje kartotéku a hľadá zhody podľa mena zvieraťa, telefónu majiteľa, čísla čipu alebo adresy.",
      },
      {
        icon: "⚖️",
        title: "Porovnanie kariet vedľa seba",
        description:
          "Prezrite si zoznam vizít, vakcinácií a dátumov narodenia na oboch kartách a skontrolujte, či ide skutočne o to isté zviera.",
      },
      {
        icon: "🎯",
        title: "Voľba primárnej karty",
        description:
          "Vyberte kartu, ktorá si zachová svoje ID a základné údaje (napr. kartu s riadne zadaným čipom a pasom).",
      },
      {
        icon: "🔗",
        title: "Zlúčenie histórie (Merge)",
        description:
          "Potvrďte zlúčenie. Všetky SOAP záznamy, vystavené faktúry, nahrané RTG snímky a laboratórne výsledky sa presunú pod primárnu kartu.",
      },
      {
        icon: "🔒",
        title: "Archivácia duplikátu",
        description:
          "Sekundárna karta je označená ako zlúčená a archivovaná v auditnom denníku s odkazom na primárny profil.",
      },
    ],
    tips: [
      "Zlúčenie kariet je trvalé a nezvratné; pred potvrdením si vždy overte číslo čipu a plemeno.",
      "Nikdy nezlučujte pacientov s rozdielnymi platnými ISO mikročipmi.",
      "Klientsky portál majiteľa sa po zlúčení automaticky previaže na zjednotený profil.",
    ],
    practicalExample: {
      title: "Zlúčenie karty z WinVet importu s novou vizitou z pohotovosti",
      badge: "Dátová hygiena",
      scenario:
        "Pes 'Bono' majiteľa Kováča existuje v systéme dvakrát – raz z historického importu z WinVetu (bez telefónneho čísla) a raz založený na nočnej pohotovosti (s telefónom).",
      solution:
        "V /patients/duplicates zvoľte obe karty, označte novšiu kartu s telefónom ako primárnu a kliknite 'Zlúčiť záznamy'. Historické záznamy spred 5 rokov sa spoja s nočnou vizitou do jednej ucelenej karty.",
    },
  },

  "/clients": {
    title: "Klienti a majitelia zvierat",
    intro:
      "Evidencia majiteľov zvierat (fyzické osoby, chovatelia, farmy s IČO). Poskytuje prehľad o všetkých zvieratách majiteľa, histórii platieb, faktúr, stave GDPR súhlasov a vygenerovanom zabezpečenom prístupe do Klientskeho portálu.",
    steps: [
      {
        icon: "➕",
        title: "Pridanie nového klienta",
        description:
          "Zadajte meno, priezvisko, telefón, e-mail a fakturačnú adresu. Pri firmách a farmách vyplňte IČO a DIČ.",
      },
      {
        icon: "🐾",
        title: "Priradenie zvierat",
        description:
          "V detaile klienta vidíte všetky registrované zvieratá. Kliknutím môžete pridať ďalšieho pacienta alebo previesť zviera na nového majiteľa.",
      },
      {
        icon: "🔑",
        title: "Klientsky portál (Magic Link)",
        description:
          "Skopírujte privátny odkaz na Klientsky portál a pošlite ho majiteľovi SMS-kou alebo e-mailom. Klient si bez hesla prezrie očkovania a faktúry.",
      },
      {
        icon: "💬",
        title: "Priama komunikácia",
        description:
          "Z karty klienta môžete odoslať rýchlu SMS alebo e-mailovú správu cez integrovanú bránu.",
      },
      {
        icon: "🏷️",
        title: "Štítky a segmentácia",
        description:
          "Pridajte klientovi štítok (napr. 'VIP', 'Chovateľ', 'Zlá platobná disciplína') pre rýchlu orientáciu personálu recepcie.",
      },
    ],
    tips: [
      "Klienti nemusia vypĺňať heslá – Klientsky portál využíva bezpečný jednorazový prístupový odkaz (Magic Link).",
      "V karte klienta vidíte celoživotnú finančnú hodnotu klienta (LTV) a sumu neuhradených záväzkov.",
      "Ak klient zmení telefónne číslo, aktualizujte ho priamo v karte – číslo sa automaticky premietne do všetkých pripomienok.",
      "Zosnulé zvieratá klienta sú v zozname zreteľne označené šedým odznakom.",
    ],
    practicalExample: {
      title: "Zdieľanie očkovacieho preukazu a výsledkov krvi majiteľovi na cesty",
      badge: "Klientsky servis",
      scenario:
        "Majiteľ cestuje so psom do Chorvátska a zabudol si papierový očkovací preukaz. Volá na recepciu z čerpacej stanice, že potrebuje doklad o besnote.",
      solution:
        "V detaile klienta kliknite na 'Odoslať odkaz na portál SMS-kou'. Majiteľovi okamžite pípne SMS, klikne na link a na displeji mobilu ukáže colníkovi digitálny výpis vakcinácie s číslom čipu a šaržou.",
    },
  },

  "/records": {
    title: "Klinické záznamy (SOAP)",
    intro:
      "Elektronická zdravotná dokumentácia v štruktúrovanom medicínskom formáte SOAP (Subjektívne, Objektívne, Hodnotenie/Assessment, Terapeutický plán). Zabezpečuje forenznú integritu, verzionovanie, zaznamenávanie diagnóz a nemennosť záznamov po podpise lekárom v zmysle veterinárnych predpisov SR.",
    steps: [
      {
        icon: "📝",
        title: "Založenie vyšetrenia",
        description:
          "Vyberte pacienta a kliknite na „Nový záznam\". Zvoľte kategóriu (ambulantné vyšetrenie, kontrola, chirurgia, stomatológia).",
      },
      {
        icon: "🎙️",
        title: "Hlasové diktovanie cez AI",
        description:
          "Stlačte ikonu mikrofónu a plynule diktujte nález. AI model automaticky roztriedi informácie do sekcií S, O, A a P.",
      },
      {
        icon: "🩺",
        title: "Objektívny klinický status",
        description:
          "Vyplňte vitálne funkcie: hmotnosť, telesná teplota (°C), srdcová frekvencia, dych, CRT, stav slizníc a hydratácia.",
      },
      {
        icon: "💊",
        title: "Diagnóza a plán liečby",
        description:
          "Zadajte pracovnú alebo finálnu diagnózu a rozvrh medikácie. Plán liečby slúži ako podklad pre generovanie prepúšťacej správy.",
      },
      {
        icon: "🔒",
        title: "Finalizácia a digitálny podpis",
        description:
          "Tlačidlom „Finalizovať záznam\" uzamknete vyšetrenie. Záznam získa kryptografický SHA-256 odtlačok a podpis ošetrujúceho lekára.",
      },
    ],
    tips: [
      "Po finalizácii je záznam read-only – akákoľvek dodatočná zmena sa zapíše do forenzného auditného denníka s presným časom a autorom.",
      "Z plánu liečby (P) systém automaticky predpripraví položky na vyúčtovanie do e-Kasy.",
      "Podané injekčné lieky a anestetiká automaticky znižujú zásoby v module Sklad.",
      "Hlasové nahrávky sa po úspešnej transkripcii do 24 hodín automaticky mažú v súlade s GDPR.",
    ],
    practicalExample: {
      title: "Zápis kontrolného vyšetrenia akútnej pankreatitídy",
      badge: "Klinický protokol",
      scenario:
        "Pes prichádza na kontrolu po 48 hodinách infúznej liečby pre akútnu pankreatitídu. Je potrebné porovnať parametre a upraviť diétny režim.",
      solution:
        "V module Záznamy otvorte novú vizitu, kliknite 'Kopírovať anamnézu z minula', zapíšte novú teplotu 38.6 °C a negatívnu palpačnú bolestivosť. Do plánu zapíšte prechod na nízkotukovú diétu Royal Canin Gastrointestinal Low Fat a jedným klikom vytlačte inštrukcie pre majiteľa.",
    },
  },

  "/encounters": {
    title: "Aktívna vizita & Charge Capture",
    intro:
      "Pracovná plocha ošetrujúceho lekára počas vyšetrenia na vyšetrovacom stole. Integruje zápis SOAP nálezu, predpis liekov, objednávanie laboratórnych testov a automatické zachytávanie výkonov pre fakturáciu (Charge Capture), ktoré bráni zabudnutiu položiek na účte.",
    steps: [
      {
        icon: "🩺",
        title: "Zahájenie vizity z čakárne",
        description:
          "Kliknite na pacienta v čakárni a zvoľte „Zavolať\". Pacient sa presunie do stavu 'V ordinácii' a otvorí sa aktívna vizita.",
      },
      {
        icon: "💊",
        title: "Aplikácia liekov a materiálu",
        description:
          "V záložke „Liečivá\" vyhľadajte podané lieky. Systém overí dávkovanie podľa hmotnosti zvieraťa a odpočíta šaržu zo skladu.",
      },
      {
        icon: "💰",
        title: "Automatický Charge Capture",
        description:
          "Systém počas zápisu vyšetrenia automaticky navrhuje spoplatniteľné úkony (napr. klinické vyšetrenie, zavedenie kanyly, injekčná aplikácia).",
      },
      {
        icon: "📄",
        title: "Prepúšťacia správa",
        description:
          "Kliknutím na „Generovať prepúšťaciu správu\" AI pripraví pre majiteľa prehľadný rozpis domáceho dávkovania liekov v zrozumiteľnej reči.",
      },
      {
        icon: "💳",
        title: "Odovzdanie na recepciu / pokladňu",
        description:
          "Ukončením vizity sa zaevidované položky automaticky odošlú na recepciu do pokladne e-Kasa pre rýchle zaplatenie.",
      },
    ],
    tips: [
      "Funkcia Charge Capture zabraňuje únikom tržieb – personál nezabudne zaúčtovať spotrebný materiál (rukavice, striekačky, ihly).",
      "Ak počas vizity nahráte RTG snímku cez záložku Zobrazovanie, okamžite môžete spustiť AI analýzu a VHS kalkulačku.",
      "V prípade eutanázie systém automaticky aktivuje kondolenčný režim a zablokuje akékoľvek marketingové správy.",
    ],
    practicalExample: {
      title: "Chirurgické ošetrenie abscesu po mačacom pohryznutí",
      badge: "Charge Capture",
      scenario:
        "Kocúr s bolestivým abscesom na chrbte. Zákrok: sedácia, incízia, laváž, drenáž, podanie antibiotík a vystavenie goliera.",
      solution:
        "Počas zápisu zákroku systém v bočnom paneli automaticky ponúkne: 'Sedácia mačky', 'Chirurgická incízia abscesu', 'Laváž rany', 'Penose drenáž', 'Synulox inj' a 'Ochranný golier 7.5cm'. Lekár len potvrdí zoznam a položky sú pripravené v pokladni bez manuálneho prepisovania.",
    },
  },

  "/billing": {
    title: "Fakturácia a financie",
    intro:
      "Finančný manažment ambulancie. Zahŕňa vystavovanie faktúr, sledovanie pohľadávok, evidenciu úhrad (hotovosť, platobná karta, bankový prevod), správu cenníka výkonov a exporty účtovných podkladov pre externého účtovníka vo formátoch CSV, XLSX a PDF.",
    steps: [
      {
        icon: "➕",
        title: "Vystavenie novej faktúry",
        description:
          "Kliknite na „Nová faktúra\" alebo prevezmite položky z ukončenej vizity tlačidlom „Importovať z vyšetrenia\".",
      },
      {
        icon: "🏷️",
        title: "Kontrola položiek a sadzieb DPH",
        description:
          "Skontrolujte rozpis služieb a tovarov so správnymi sadzbami DPH (20 %, 10 %, 5 %) a prípadné chovateľské zľavy.",
      },
      {
        icon: "💳",
        title: "Zaevidovanie úhrady",
        description:
          "Vyberte spôsob platby. Pri platbe v hotovosti alebo platobnou kartou systém automaticky vyvolá tlač e-Kasa dokladu.",
      },
      {
        icon: "✉️",
        title: "Odoslanie faktúry e-mailom",
        description:
          "Jedným kliknutím odošlite faktúru vo formáte PDF na e-mailovú adresu klienta s QR kódom pre rýchlu platbu cez Pay by square.",
      },
      {
        icon: "📊",
        title: "Export pre účtovníctvo",
        description:
          "V záložke „Exporty\" stiahnite mesačný balíček vystavených a prijatých faktúr pre programy Pohoda, KROS (Omega) či Money S3.",
      },
    ],
    tips: [
      "Faktúry s QR kódom 'Pay by square' klienti uhradzujú cez mobilné bankovníctvo priemerne o 60 % rýchlejšie.",
      "Nezaplatené faktúry po lehote splatnosti sú zvýraznené červenou farbou na Dashboarde a v profile klienta.",
      "Zoznam položiek cenníka umožňuje definovať minimálne marže pre veterinárne lieky a špeciálne krmivá.",
    ],
    practicalExample: {
      title: "Fakturácia mesačného balíka starostlivosti pre chovnú stanicu koní",
      badge: "Financie",
      scenario:
        "Chovateľ koní odoberá veterinárne služby na faktúru so 14-dňovou splatnosťou. Na konci mesiaca je potrebné vyfakturovať 6 návštev a vakcinácie.",
      solution:
        "Vytvorte súhrnnú faktúru, zvoľte 'Pridať položky z neuzavretých vizít klienta', systém načíta všetky ošetrenia koní z daného mesiaca, nastaví platbu prevodom na účet so 14-dňovou lehotou a odošle PDF faktúru s rozpisom zvierat majiteľovi.",
    },
  },

  "/billing/ekasa": {
    title: "ePOkladňa (e-Kasa podľa Zákona 289/2008 Z. z.)",
    intro:
      "Certifikovaný fiškálny subsystém integrujúci hardvérové e-Kasa tlačiarne (FiskalPRO LAN/USB na portoch 8080/8443) a Virtuálnu registračnú pokladnicu Finančnej správy SR (VRP2). Zabezpečuje online evidenciu tržieb s unikátnym kódom OKP/PKP, 48-hodinový offline núdzový režim a prísne stornovanie dokladov.",
    steps: [
      {
        icon: "🖨️",
        title: "Tlač fiškálneho dokladu",
        description:
          "Po prijatí platby kliknite na „Vytlačiť e-Kasa doklad\". Systém odošle dáta na server Finančnej správy a vytlačí bloček s OKP kódom a QR kódom.",
      },
      {
        icon: "💳",
        title: "Kombinovaná platba",
        description:
          "Zvoľte možnosť rozdelenia úhrady (časť v hotovosti, časť platobnou kartou alebo darčekovou poukážkou) s presným zaúčtovaním.",
      },
      {
        icon: "🔌",
        title: "Offline núdzový režim",
        description:
          "Pri výpadku internetu systém automaticky ukladá doklady do zabezpečenej offline fronty. Po obnovení spojenia sa doklady bezpečne odošlú bez duplicít.",
      },
      {
        icon: "↩️",
        title: "Zákonné storno dokladu",
        description:
          "Funkcia Storno vyžaduje zadanie pôvodného UID dokladu a dôvodového kódu. Prístup k stornovaniu majú výhradne administrátori a veterinárni lekári.",
      },
      {
        icon: "📊",
        title: "Denná uzávierka (Z-správa)",
        description:
          "Na konci dňa vykonajte dennú fiškálnu uzávierku tlačidlom „Uzávierka dňa\". Záznam sa uloží do histórie pre daňovú kontrolu.",
      },
    ],
    tips: [
      "Každý doklad má unikátny kryptografický idempotency kľúč, ktorý zabraňuje nechcenému dvojitému zaúčtovaniu pri zlyhaní siete.",
      "Zákonný limit pre odoslanie offline dokladov je 48 hodín od ich vystavenia.",
      "Pri inšpekcii daňovým úradom máte k dispozícii kompletný auditný export všetkých tržieb a stornovaných položiek.",
    ],
    practicalExample: {
      title: "Výpadok internetu počas víkendovej pohotovosti",
      badge: "e-Kasa offline",
      scenario:
        "Počas búrky v nedeľu vypadne v klinike internetové pripojenie. Prichádza klient zaplatiť ošetrenie psa v hotovosti.",
      solution:
        "Pokladňa automaticky prepne do offline režimu, vytlačí náhradný doklad s podpisovým kódom PKP. Po pondelkovom obnovení internetu systém sám ticho odošle všetky čakajúce bločky na portál Finančnej správy SR a spáruje ich s OKP kódom.",
    },
  },

  "/billing/pos": {
    title: "Rýchla pokladňa recepcia (POS)",
    intro:
      "Zrýchlené dotykové rozhranie pokladnice optimalizované pre pultový predaj na recepcii. Umožňuje okamžitý predaj krmív, antiparazitík a voľnopredajného tovaru s čítačkou čiarových kódov (EAN), klávesovými skratkami a tlačou bločku na 2 kliknutia.",
    steps: [
      {
        icon: "📷",
        title: "Skenovanie čiarového kódu",
        description:
          "Priložte tovar k USB/Bluetooth čítačke čiarových kódov (EAN). Položka sa okamžite pridá do aktuálneho nákupného košíka.",
      },
      {
        icon: "⭐",
        title: "Dlaždice obľúbených položiek",
        description:
          "Pre tovar bez čiarového kódu (odčervovacie tablety, striekačky, diéty) kliknite na prednastavené rýchle dlaždice.",
      },
      {
        icon: "👤",
        title: "Výber klienta alebo anonymný predaj",
        description:
          "Priraďte nákup existujúcemu majiteľovi alebo zvoľte 'Anonymný zákazník' pre neregistrovaných kupujúcich z ulice.",
      },
      {
        icon: "⚡",
        title: "Blesková platba klávesom (F9)",
        description:
          "Stlačte kláves F9 pre okamžitú platbu kartou cez platobný terminál alebo F8 pre hotovosť a automatické otvorenie peňažnej zásuvky.",
      },
    ],
    tips: [
      "Kláves F2 prepne kurzor do vyhľadávania položiek, F8 zvolí hotovosť, F9 platobnú kartu a Esc vyčistí košík.",
      "Predaj veterinárnych liečiv viazaných na lekársky predpis nie je možný na anonymného zákazníka – systém vyžaduje priradenie k pacientovi.",
      "Pre rýchlu kontrolu zostatku v pokladni stlačte tlačidlo 'Stav hotovosti'.",
    ],
    practicalExample: {
      title: "Ranná špička na recepcii a rýchly predaj antiparazitík",
      badge: "POS",
      scenario:
        "Pred ambulanciou čakajú 3 klienti na vyšetrenie a jeden zákazník chce len rýchlo kúpiť tabletu NexGard Spectra proti kliešťom.",
      solution:
        "Recepčná naskenuje krabičku čítačkou, stlačí F9, zákazník priloží hodinky k terminálu a tlačiareň vydá bloček. Celý nákup trvá 8 sekúnd bez zdržania ordinujúcich lekárov.",
    },
  },

  "/care-reminders": {
    title: "Pripomienky starostlivosti & očkovania",
    intro:
      "Automatizovaný dispečing preventívnej starostlivosti. Monitoruje blížiace sa termíny vakcinácií, odčervení, geriatrických prehliadok, kontrol krvi a dentálnej hygieny. Automaticky odosiela personalizované SMS a e-maily s integrovanou etickou ochranou 'Sympathy Gate' pri zosnulých pacientoch.",
    steps: [
      {
        icon: "📋",
        title: "Prehľad expiračného frontu",
        description:
          "Tabuľka zobrazuje pacientov, ktorým v najbližších 30 dňoch končí platnosť vakcinácie alebo plánovaného vyšetrenia.",
      },
      {
        icon: "⚙️",
        title: "Automatické odosielanie notifikácií",
        description:
          "Systém odosiela upozornenia v dvoch vlnách: 14 dní pred expiráciou a 3 dni pred termínom cez SMS bránu alebo e-mail.",
      },
      {
        icon: "➕",
        title: "Vytvorenie vlastnej pripomienky",
        description:
          "Pri špecifickom pacientovi kliknite na „Nová pripomienka\" (napr. kontrola stehov o 10 dní, kontrola hladiny fenobarbitalu o mesiac).",
      },
      {
        icon: "✅",
        title: "Vybavenie po návšteve",
        description:
          "Po absolvovaní očkovania sa pripomienka automaticky označí ako vybavená a nastaví sa nový revakcinačný cyklus na ďalší rok.",
      },
    ],
    tips: [
      "Sympathy Gate: V momente zaznamenania úhynu alebo eutanázie zvieraťa systém automaticky zruší všetky otvorené pripomienky bez rizika traumatizovania majiteľa.",
      "V odosielanej SMS správe je vložený priamy odkaz na online rezerváciu termínu v rozvrhu ambulancie.",
      "Filtrujte pripomienky podľa druhu zvieraťa pre sezónne kampane (napr. jarná vakcinácia králikov proti moru).",
    ],
    practicalExample: {
      title: "Automatická pripomienka revakcinácie infekčných chorôb u psov",
      badge: "Prevencia",
      scenario:
        "150 psom z kartotéky končí v apríli platnosť trojročnej vakcinácie Nobivac DHPPi. Personál nemá kapacitu na telefonovanie.",
      solution:
        "Systém automaticky vygeneruje personalizovanú SMS: 'Dobry den, o 14 dni konci platnost ockovania vasho psa Rex. Rezervujte si termin online na vet.sk/rezervacia'. 80 % klientov sa objedná samo cez mobil.",
    },
  },

  "/inventory": {
    title: "Sklad a zásoby liečiv",
    intro:
      "Skladové hospodárstvo ambulancie prispôsobené veterinárnej legislatíve. Eviduje čísla šarží (Lot), expiračné dátumy, nákupné ceny distribútorov, minimálne limitné stavy zásob a automatický odpis podaných liekov priamo zo SOAP vizity.",
    steps: [
      {
        icon: "📦",
        title: "Príjem tovaru z dodacieho listu",
        description:
          "Zvoľte „Príjem tovaru\", zadajte dodávateľa (Pharmos, Cymedica, Samohýl, Henry Schein), počet kusov, šaržu a dátum exspirácie.",
      },
      {
        icon: "📉",
        title: "Automatický odpis zo záznamov",
        description:
          "V momente finalizácie vizity systém automaticky zníži skladové zásoby aplikovaných injekcií, tabliet a materiálu.",
      },
      {
        icon: "⚠️",
        title: "Upozornenia na nízky stav a exspiráciu",
        description:
          "Červené zvýraznenie označuje položky pod minimálnym stavom alebo lieky s exspiráciou do 30 dní pre včasné doobjednanie.",
      },
      {
        icon: "📋",
        title: "Periodická inventúra skladu",
        description:
          "Funkcia „Inventúra\" umožní zadať fyzicky spočítaný stav a vygeneruje oficiálny rozdielový inventúrny protokol pre účtovníctvo.",
      },
    ],
    tips: [
      "Systém uplatňuje pravidlo FEFO (First Expired, First Out) – pri predpise prioritne ponúka liek s najkratšou exspiráciou.",
      "Čiarový kód z krabičky lieku môžete načítať čítačkou pri príjme tovaru pre okamžité vyhľadanie v katalógu.",
      "Omamné a psychotropné látky (opiáty) sa evidujú paralelne v špeciálnom module 'Kontrolované látky'.",
    ],
    practicalExample: {
      title: "Naskladnenie anestetík a kontrola expirácie",
      badge: "Sklad",
      scenario:
        "Do ambulancie dorazila zásielka 10 balení prípravku Alfaxan 10ml s exspiráciou 2027 a novou šaržou.",
      solution:
        "V module Sklad otvorte Príjem, naskenujte EAN kód, zadajte šaržu a počet kusov. Pri každej anestézii systém automaticky odpíše presné podané mililitre a priradí číslo šarže do karty pacienta pre spätnú dohľadateľnosť.",
    },
  },

  "/lab-results": {
    title: "Laboratórne výsledky & analyzátory",
    intro:
      "Centrálne laboratórne rozhranie kliniky. Umožňuje automatický príjem výsledkov z ambulantných analyzátorov (IDEXX VetLab Station, Fuji Dri-Chem, Horiba, Scil) a zmluvných externých laboratórií (Laboklin, Synlab, ŠVÚ) s AI interpretáciou patologických nálezov.",
    steps: [
      {
        icon: "📥",
        title: "Príjem a import výsledkov",
        description:
          "Výsledky sa načítavajú automaticky cez sieťové rozhranie analyzátora alebo manuálnym nahraním protokolu v PDF / CSV.",
      },
      {
        icon: "🐾",
        title: "Automatické párovanie s pacientom",
        description:
          "Systém podľa ID vzorky a mena priradí výsledky priamo do zdravotnej karty príslušného pacienta.",
      },
      {
        icon: "🔴",
        title: "Zvýraznenie patologických hodnôt",
        description:
          "Hodnoty mimo fyziologického referenčného rozpätia sú farebne zvýraznené (červená = nad normou, modrá = pod normou).",
      },
      {
        icon: "🤖",
        title: "AI interpretácia a diferenciálna diagnostika",
        description:
          "Kliknutím na „AI interpretácia\" získate okamžitý súhrn syndrómov (napr. prerenálna azotémia, cholestáza, regeneratívna anémia).",
      },
      {
        icon: "🔗",
        title: "Vloženie do SOAP vizity",
        description:
          "Tlačidlo „Vložiť do vyšetrenia\" prenesie štruktúrované hodnoty priamo do sekcie O (Objektívne) v klinickom zázname.",
      },
    ],
    tips: [
      "Referenčné hodnoty analyzátorov sa automaticky prispôsobujú druhu zvieraťa a vekovej kategórii (pes adult vs šteňa vs mačka).",
      "V grafe trendov môžete sledovať vývoj kľúčových markerov v čase (napr. SDMA a kreatinín pri chronickom zlyhaní obličiek).",
      "Protokol výsledkov môžete jedným klikom zazdieľať majiteľovi do Klientskeho portálu.",
    ],
    practicalExample: {
      title: "Posúdenie akútneho renálneho zlyhania u mačky",
      badge: "Laboratórium",
      scenario:
        "4-ročná mačka prijatá v apatii so zvracaním a anúriou. Analyzátor dokončil hematológiu a biochémiu.",
      solution:
        "Výsledky sa objavia v /lab-results. Systém červene zvýrazní Kreatinín 680 umol/l a Ureu 38 mmol/l. AI interpretácia okamžite vygeneruje varovanie pred akútnym poškodením obličiek (AKI) a navrhne skontrolovať hladinu draslíka a vykonať USG obličiek.",
    },
  },

  "/statutory": {
    title: "Zákonné knihy a registre (ŠVPS SR)",
    intro:
      "Povinná úradná veterinárna dokumentácia podľa zákona č. 39/2007 Z. z. o veterinárnej starostlivosti. Zahŕňa Úradnú knihu očkovania proti besnote (§ 19 ods. 1), 14-dňové pozorovacie protokoly po pohryznutí človeka (§ 19 ods. 2), Knihu ošetrení hospodárskych zvierat, evidenciu ochranných lehôt na mäso a mlieko, Register eutanázií a asanácie a informované súhlasy klientov.",
    steps: [
      {
        icon: "🐕",
        title: "Kniha očkovania proti besnote",
        description:
          "Eviduje každú aplikáciu vakcíny proti besnote. Systém stráži zákonnú 3-dňovú lehotu nahlásenia na príslušnú RVPS a do CRSZ.",
      },
      {
        icon: "⚠️",
        title: "14-dňové pozorovanie po pohryznutí",
        description:
          "Generuje úradné protokoly o klinickom vyšetrení zvieraťa, ktoré poranilo človeka (vyšetrenie v 1., 5. a 14. deň pozorovania).",
      },
      {
        icon: "🐄",
        title: "Kniha ošetrení & Ochranné lehoty",
        description:
          "Záznamy o podaní liekov hospodárskym zvieratám. Automaticky počíta presný dátum konca ochrannej lehoty na mäso a mlieko.",
      },
      {
        icon: "☠️",
        title: "Register eutanázií a asanácie",
        description:
          "Zápis dôvodu eutanázie, použitého letálneho prípravku (T61, pentobarbital), presnej dávky a potvrdenia o odovzdaní do asanačného podniku.",
      },
      {
        icon: "🖨️",
        title: "Tlač úradných inšpekčných kníh",
        description:
          "Tlačidlo „Inšpekčná tlač\" vygeneruje knihu vo formáte A4 na šírku s poradovými číslami, čipmi a podpisovými blokmi pre inšpektorov ŠVPS SR.",
      },
    ],
    tips: [
      "Inšpekčné knihy spĺňajú všetky náležitosti pre štátne kontroly Regionálnej veterinárnej a potravinovej správy (RVPS).",
      "Filtre v záhlaví umožňujú jedným klikom zobraziť záznamy v stave 'Dodržaná lehota' alebo 'Po lehote'.",
      "Informované súhlasy (anestézia, chirurgický zákrok, eutanázia) je možné vytlačiť alebo nechať podpísať klientom priamo na dotykovom displeji.",
    ],
    practicalExample: {
      title: "Inšpekčná kontrola RVPS na evidenciu očkovania proti besnote",
      badge: "Inšpekcia ŠVPS",
      scenario:
        "Inšpektor štátnej veterinárnej správy prišiel na plánovanú kontrolu a požaduje predložiť evidenciu očkovania proti besnote za uplynulý rok.",
      solution:
        "V záložke Kniha besnoty nastavte filter na celý predchádzajúci rok a kliknite 'Inšpekčná tlač'. Systém za 3 sekundy otvorí úradný výkaz s hlavičkou pracoviska, číslami čipov, šaržami a podpisovými riadkami pripravený na tlač.",
    },
  },

  "/statutory/kvepis": {
    title: "KVEPIS & ÚPVS Submission Hub (ŠVPS SR)",
    intro:
      "Elektronické podania na Štátnu veterinárnu a potravinovú správu SR cez Ústredný portál verejnej správy (slovensko.sk). Modul zabezpečuje riadenú validáciu dát, generovanie kánonického XML balíčka, autorizáciu kvalifikovaným elektronickým podpisom (KEP) v aplikácii D.Signer a evidenciu štátnej doručenky.",
    steps: [
      {
        icon: "🏛️",
        title: "Nastavenie prístupu kliniky",
        description:
          "Zadajte IČO ambulancie, registračné číslo KVL SR lekára a adresu elektronickej schránky na ÚPVS.",
      },
      {
        icon: "➕",
        title: "Vytvorenie nového podania",
        description:
          "Zvoľte typ podania: Hlásenie besnoty (rabies_notification), Kniha ošetrení hospodárskych zvierat (treatment_diary_batch) alebo Premiestnenie zvierat.",
      },
      {
        icon: "🛡️",
        title: "Validácia schémy ŠVPS SR",
        description:
          "Kliknite na „Validovať\". Validačný motor overí formát IČO farmy, CEHZ kód, 15-miestny čip a vylúči premiestnenie zvieraťa v ochrannej lehote.",
      },
      {
        icon: "💾",
        title: "Stiahnutie XML pre D.Signer",
        description:
          "Po úspešnej validácii stiahnite vygenerovaný XML formulár pripravený na podpísanie KEP-om cez občiansky preukaz (eID čítačka).",
      },
      {
        icon: "📨",
        title: "Odoslanie a zaevidovanie doručenky",
        description:
          "Po odoslaní cez slovensko.sk vložte do systému evidenčné číslo úradnej doručenky. Podanie prejde do stavu Potvrdené (ACKNOWLEDGED).",
      },
    ],
    tips: [
      "Validačný motor striktne blokuje odoslanie dokladu na premiestnenie, ak je zviera v aktívnej ochrannej lehote na mäso alebo mlieko.",
      "V testovacom režime (Sandbox) môžete simulovať celé podanie bez odoslania reálnych dát na štátny server.",
      "Všetky vygenerované XML súbory obsahujú kryptografický SHA-256 hash pre overenie integrity obsahu.",
    ],
    practicalExample: {
      title: "Hromadné hlásenie vakcinácie dobytka a zápis doručenky",
      badge: "KVEPIS B2G",
      scenario:
        "Veterinár vakcinoval 30 kusov hovädzieho dobytka na farme a potrebuje odoslať dávkové hlásenie na RVPS v elektronickej forme.",
      solution:
        "Vytvorte podanie typu 'Kniha ošetrení', zadajte CEHZ kód farmy a šaržu vakcíny. Kliknite 'Validovať', stiahnite XML, podpíšte v aplikácii D.Signer a po odoslaní nahrajte doručenku z ÚPVS schránky. Záznam je zákonne uzavretý.",
    },
  },

  "/controlled-substances": {
    title: "Kontrolované látky (Opiátová kniha)",
    intro:
      "Zákonný register omamných a psychotropných látok II. a III. skupiny podľa zákona č. 139/1998 Z. z. Vedie prísne imutabilný auditný denník spotreby anestetík a analgetík (ketamín, butorfanol, diazepam, fentanyl, metadón). Každý záznam vyžaduje podpis veterinárneho lekára a číslo KVL SR.",
    steps: [
      {
        icon: "📦",
        title: "Príjem omamnej látky do trezoru",
        description:
          "Zaznamenajte príjem z dodacieho listu distribútora s číslom šarže, exspiráciou, presným počtom ampuliek a koncentráciou v mg/ml.",
      },
      {
        icon: "💉",
        title: "Zápis spotreby pri operácii",
        description:
          "Zadajte pacienta, diagnózu, aplikované množstvo v mililitroch (systém automaticky prepočíta miligramy účinnej látky) a podpisujúceho lekára.",
      },
      {
        icon: "🗑️",
        title: "Znehodnotenie zostatku",
        description:
          "Zostatok v otvorenej ampulke, ktorý nie je možné uchovať, zaznamenajte ako znehodnotený s podpisom dvoch prítomných osôb.",
      },
      {
        icon: "📊",
        title: "Generovanie mesačného výkazu spotreby",
        description:
          "Na konci každého kalendárneho mesiaca vygenerujte oficiálny výkaz spotreby pre Regionálnu veterinárnu a potravinovú správu.",
      },
    ],
    tips: [
      "Záznamy v knihe omamných látok sú kryptograficky zreťazené a nevratné – dodatočné prepisovanie histórie nie je možné.",
      "Fyzický stav v trezore musí presne sedieť so zostatkom v systéme; odporúčame týždennú fyzickú inventúru.",
      "Záznamy o kontrolovaných látkach sa povinne archivujú po dobu 10 rokov od uzavretia knihy.",
    ],
    practicalExample: {
      title: "Podanie Butorfanolu na premedikáciu a zápis do opiátovej knihy",
      badge: "Zákon 139/1998",
      scenario:
        "Pred osteosyntézou psa lekár aplikoval 0.4 ml Torbugesicu 10 mg/ml (4 mg butorfanolu).",
      solution:
        "V module Kontrolované látky kliknite 'Zaznamenať výdaj', vyberte Butorfanol, zadajte 0.4 ml, vyberte pacienta a potvrďte heslom lekára. Skladový zostatok v trezore sa okamžite zníži a záznam je nezmazateľne zaevidovaný.",
    },
  },

  "/waiting-room": {
    title: "Čakáreň a triáž pacientov",
    intro:
      "Real-time dispečing príchodov pacientov. Zobrazuje čakajúcich pacientov zoradených podľa dĺžky čakania a naliehavosti (triáž), umožňuje volanie pacientov do ordinácie na jeden klik a anonymné zobrazenie poradia na TV obrazovke v čakárni bez porušenia GDPR.",
    steps: [
      {
        icon: "👋",
        title: "Potvrdenie príchodu (Check-in)",
        description:
          "Pri príchode klienta k recepcii kliknite na „Check-in\". Pacient sa zaradí do čakacieho radu s presným časom príchodu.",
      },
      {
        icon: "🚨",
        title: "Nastavenie triáže (Závažnosť)",
        description:
          "Priraďte pacientovi prioritu: Zelená (bežná kontrola), Žltá (bolesť/zvracanie), Červená (akútne ohrozenie života, dyspnoe, šok).",
      },
      {
        icon: "⏱️",
        title: "Sledovanie času čakania",
        description:
          "Časovač automaticky meria minúty od príchodu. Pri prekročení 20 minút sa rozsvieti oranžové upozornenie na meškanie.",
      },
      {
        icon: "🩺",
        title: "Zavolať do vyšetrovne",
        description:
          "Ordinujúci veterinár klikne na „Zavolať\". Pacient sa na TV obrazovke v čakárni zobrazí ako vyzvaný do konkrétnej ordinácie.",
      },
    ],
    tips: [
      "Čakáreň sa aktualizuje automaticky každých 15 sekúnd bez potreby obnovovania stránky v prehliadači.",
      "Pri akútnych infekčných pacientoch (kašeľ psov, mačací týfus) zaškrtnite štítok 'Izolácia' pre okamžité presunutie mimo čakárne.",
      "Prepojte čakáreň s modulom TV Displej pre zobrazenie poradových čísel pacientov bez uvádzania celých mien (ochrana osobných údajov).",
    ],
    practicalExample: {
      title: "Triáž akútneho dýchavičného psa v plnej čakárni",
      badge: "Triáž",
      scenario:
        "V čakárni čakajú 4 objednaní klienti na bežné vakcinácie. Do dverí vstúpi majiteľ s francúzskym buldočkom v ťažkom prehriatí (úpal, cyanóza jazyka).",
      solution:
        "Recepcia okamžite klikne 'Rýchly príjem' s prioritou Červená (Urgent). Pacient predbehne všetkých čakajúcich a na monitoroch všetkých ordinácií sa rozbliká zvuková a vizuálna výstraha. Lekár psa ihneď berie do kyslíkového boxu.",
    },
  },

  "/whiteboard": {
    title: "Klinická tabuľa (Whiteboard)",
    intro:
      "Veľkoplošná tímová tabuľa pre prehľad o chode celej kliniky. Zobrazuje pacientov v hospitalizačných boxoch (JIP, infúzie, pooperačné sledovanie), harmonogram plánovaných operácií dňa, tímové úlohy a dôležité interné odkazy pre dennú a nočnú zmenu.",
    steps: [
      {
        icon: "🏥",
        title: "Stav hospitalizačných boxov",
        description:
          "Každý box (Box 1 - 8, Kyslíková klietka, Infekčný box) zobrazuje kartu pacienta, diagnózu, infúzny plán a teplotu.",
      },
      {
        icon: "⏰",
        title: "Harmonogram medikácie a úloh",
        description:
          "Časová os plánovaných úkonov (napr. 10:00 infúzia Ringer, 12:00 meranie glykémie, 14:00 vyvenčenie, 16:00 antibiotiká i.v.).",
      },
      {
        icon: "✅",
        title: "Odškrtnutie splnenej úlohy",
        description:
          "Po vykonaní zákroku technik zaškrtne úlohu – systém automaticky zaznamená čas a meno vykonávateľa.",
      },
      {
        icon: "📝",
        title: "Tímové poznámky a odkazy",
        description:
          "Pridajte žltú lepiacu poznámku pre kolegov (napr. 'Pozor, pes v Boxe 2 je agresívny pri manipulácii s labkou').",
      },
    ],
    tips: [
      "Whiteboard je optimalizovaný pre dotykové monitory a tablety umiestnené priamo na hospitalizačnom oddelení a na operačke.",
      "Zmeny sa synchronizujú okamžite v reálnom čase medzi všetkými zariadeniami v klinike.",
      "Pred odovzdaním nočnej služby využite filter 'Iba nesplnené úlohy' pre rýchlu kontrolu stavu.",
    ],
    practicalExample: {
      title: "Riadenie pooperačného infúzneho protokolu u fenky po pyometre",
      badge: "Hospitalizácia",
      scenario:
        "Fena po nočnej operácii pyometry je v Boxe 3. Potrebuje pokračovať v infúzii 60 ml/h, merať teplotu každé 4 hodiny a podať analgetiká o 14:00.",
      solution:
        "Na Whiteboarde má pacientka v Boxe 3 nastavené úlohy. O 12:00 technik odmeria teplotu 38.8 °C, zapíše ju priamo do políčka boxu a odškrtne úlohu. O 14:00 sestra aplikuje predpísaný Meloxoral a úloha sa zmení na zelenú.",
    },
  },

  "/recalls": {
    title: "Klinické kontroly & follow-up fronta",
    intro:
      "Dispečing následnej klinickej starostlivosti. Automaticky sleduje pacientov po chirurgických zákrokoch, začatí novej chronickej liečby (kardiológia, endokrinológia, dermatológia) a hospitalizácii, u ktorých je potrebný telefonický alebo osobný kontrolný kontakt personálom.",
    steps: [
      {
        icon: "📞",
        title: "Prehľad naplánovaných kontaktov",
        description:
          "Zoznam pacientov, ktorým je potrebné zavolať v dnešný deň (napr. 24h po anestézii, 3 dni po začatí liečby antibiotikami).",
      },
      {
        icon: "📝",
        title: "Záznam telefonického rozhovoru",
        description:
          "Zadajte odpovede majiteľa: príjem vody a krmiva, aktivita zvieraťa, stav operačnej rany, zvracanie, defekácia.",
      },
      {
        icon: "📅",
        title: "Preobjednanie na osobnú kontrolu",
        description:
          "Ak majiteľ hlási pretrvávajúce ťažkosti, jedným kliknutím vytvoríte kontrolný termín v rozvrhu ambulancie.",
      },
      {
        icon: "✅",
        title: "Uzavretie recallu",
        description:
          "Ak je stav pacienta výborný, recall označte ako vybavený. Záznam z rozhovoru sa automaticky pripojí do zdravotnej karty.",
      },
    ],
    tips: [
      "Pacienti po celkovej anestézii sú systémom automaticky zaradení na telefonickú kontrolu 24 hodín po prepustení.",
      "Sympathy Gate: Systém striktne vylučuje zosnulých pacientov, aby personál omylom nevolal smútiacemu majiteľovi.",
      "Proaktívny follow-up telefonát po operácii zvyšuje lojalitu klientov ku klinike až o 45 %.",
    ],
    practicalExample: {
      title: "Telefonická kontrola fenky 24 hodín po kastrácii",
      badge: "Follow-up",
      scenario:
        "Sestra ráno otvára modul Recalls a vidí naplánovaný hovor pre majiteľku fenky po včerajšej laparoskopickej kastrácii.",
      solution:
        "Klikne na telefónne číslo, zavolá majiteľke a opýta sa na zotavovanie. Majiteľka hlási, že sučka už žerie, ranka je suchá a nepije nadmerne. Sestra zaznamená poznámku 'Zotavenie bez komplikácií' a recall uzavrie.",
    },
  },

  "/agent": {
    title: "Klinický AI asistent (Kopilot)",
    intro:
      "Autonómny veterinárny asistent integrovaný priamo s klinickou databázou. Odpovedá na medicínske otázky, preveruje liekové interakcie, navrhuje diferenciálne diagnózy, pomáha pri zložitej interpretácii nálezov a generuje zrozumiteľné edukačné texty pre majiteľov zvierat.",
    steps: [
      {
        icon: "💬",
        title: "Zadanie klinickej otázky v slovenčine",
        description:
          "Pýtajte sa prirodzeným jazykom: napr. „Aké sú odporúčané dávky Pimobendanu pri DCM u dobermana?\" alebo „Zhrň históriu pacienta Rex za posledné 3 mesiace\".",
      },
      {
        icon: "🔍",
        title: "Prehľadávanie celej kartotéky",
        description:
          "AI asistent okamžite vyhľadá informácie v anamnézach, laboratórnych testoch, RTG popisoch a predpisoch liekov.",
      },
      {
        icon: "🛡️",
        title: "Kontrola liekových interakcií",
        description:
          "Zadajte plánovanú kombináciu liekov a AI preverí kompatibilitu a upozorní na riziká (napr. zákaz kombinácie NSAID a kortikoidov).",
      },
      {
        icon: "👨‍⚕️",
        title: "Schválenie lekárom (Human-in-the-loop)",
        description:
          "Všetky výstupy a odporúčania AI asistenta vyžadujú pred uložením do záznamu autorizáciu veterinárnym lekárom.",
      },
    ],
    tips: [
      "AI asistent podlieha prísnym etickým hraniciam: nikdy sám nevydáva lieky a nemení dáta bez potvrdenia personálom.",
      "Využite navrhované otázky (prompt buttons) na rýchly štart klinickej analýzy.",
      "Všetky akcie a odporúčania asistenta sú auditované s časovou pečiatkou pre forenznú bezpečnosť.",
    ],
    practicalExample: {
      title: "Kontrola kontraindikácie pri liečbe artrózy u mačky",
      badge: "AI Bezpečnosť",
      scenario:
        "Majiteľ žiada predpísať liek proti bolesti pre 14-ročnú mačku s ťažkou spondylózou, ktorá má zároveň zvýšený kreatinín v krvi.",
      solution:
        "Lekár sa opýta AI asistenta: 'Aké analgetiká sú bezpečné pri renálnom zlyhaní u geriatrickej mačky?'. AI odporučí monoklonálnu protilátku Solensia (bedinvetmab) ako bezpečnú voľbu, ktorá nezaťažuje obličky na rozdiel od klasických NSAID.",
    },
  },

  "/agent/voice": {
    title: "Hlasové diktovanie SOAP vyšetrenia",
    intro:
      "Pokročilý systém klinického prepisu reči so slovenskou veterinárnou terminológiou. Umožňuje lekárovi plynule nadiktovať priebeh vyšetrenia pri vyšetrovacom stole bez dotyku klávesnice. AI model prevedie hlas na text, roztriedi informácie do sekcií S-O-A-P a automaticky navrhne vyúčtovanie.",
    steps: [
      {
        icon: "🐕",
        title: "Výber pacienta alebo demo nahrávka",
        description:
          "Zvoľte pacienta, ku ktorému diktát patrí, alebo kliknite na „Načítať demo nahrávku\" pre okamžité vyskúšanie systému.",
      },
      {
        icon: "🎙️",
        title: "Spustenie nahrávania hlasu",
        description:
          "Stlačte tlačidlo mikrofónu a plynule diktujte nález (anamnéza, teplota, posluch srdca, palpácia, diagnóza, lieky).",
      },
      {
        icon: "✨",
        title: "Automatické spracovanie AI",
        description:
          "Model prepíše hovorené slovo, zatriedi fakty do S-O-A-P a extrahuje použité liečivá a spotrebný materiál.",
      },
      {
        icon: "📋",
        title: "Kontrola a uloženie do karty",
        description:
          "Skontrolujte vygenerovaný text na obrazovke, prípadne doplňte detaily a kliknite „Uložiť do karty pacienta\".",
      },
    ],
    tips: [
      "Hovorte prirodzeným tempom; systém perfektne rozumie skratkám: s.c., i.v., p.o., CRT, DKK, Meloxoral, Synulox, Bravecto.",
      "V súlade s GDPR sa audio nahrávka do 24 hodín automaticky vymaže z úložiska po vytvorení textového záznamu.",
      "Diktovanie môžete spustiť aj z mobilného telefónu pripojeného na rovnakú sieť ambulancie.",
    ],
    practicalExample: {
      title: "Rýchly zápis kontrolnej vizity psa s otitídou",
      badge: "Úspora času",
      scenario:
        "Veterinár má 2 minúty medzi pacientmi a potrebuje zaevidovať kontrolu zápalu vonkajšieho zvukovodu u kokršpaniela.",
      solution:
        "Stlačí mikrofón a nadiktuje: 'Subjektívne svrbenie ustúpilo. Objektívne pravé ucho bez erytému a exudátu, cytológia negatívna. Hodnotenie: Otitis externa vyliečená. Plán: Ukončiť kvapky Surolan, kontrolné čistenie uší 1x týždenne'. Za 5 sekúnd má kompletný SOAP v karte pacienta bez písania na klávesnici.",
    },
  },

  "/agent/imaging": {
    title: "AI analýza RTG snímkov, DICOM & VHS",
    intro:
      "Rádiologická diagnostická platforma pre röntgenové snímky (RTG), CT, MRI a medicínske DICOM dáta (.dcm). Zabezpečuje automatickú detekciu patológií, fraktúr, cudzích telies v tráviacom trakte, segmentáciu hrudníka a interaktívny výpočet vertebrálneho srdcového skóre (VHS).",
    steps: [
      {
        icon: "🐾",
        title: "Nahratie snímky alebo voľba vzoru",
        description:
          "Pretiahnite súbor (JPG, PNG alebo medicínsky DICOM .dcm) alebo vyberte ukážkovú snímku z databázy kliniky.",
      },
      {
        icon: "🎯",
        title: "Voľba diagnostickej šablóny",
        description:
          "Zvoľte zameranie: Thorax / Srdce & Pľúca, Abdomen / Cudzie teleso, Končatiny / Fraktúry a kĺby, Dentálny RTG.",
      },
      {
        icon: "⚡",
        title: "Spustenie AI rádiologickej analýzy",
        description:
          "Kliknite na „Spustiť analýzu snímku\". AI model identifikuje anatomické štruktúry a popíše zistené abnormality.",
      },
      {
        icon: "❤️",
        title: "Kalkulačka VHS indexu",
        description:
          "Využite interaktívne meranie dĺžky a šírky srdcového tieňa voči telám hrudných stavcov od T4 pre presnú diagnózu kardiomegálie.",
      },
      {
        icon: "🖨️",
        title: "Tlač oficiálnej rádiologickej správy",
        description:
          "Vygenerujte obrazovú rádiologickú správu s nálezom a vaším komentárom pre majiteľa alebo odporúčajúceho lekára.",
      },
    ],
    tips: [
      "Systém plne podporuje DICOM súbory priamo v prehliadači s možnosťou úpravy jasu, kontrastu a priblíženia bez drahej PACS stanice.",
      "Kalkulačka VHS obsahuje referenčné normy upravené pre jednotlivé plemená (jazvečík, buldog, nemecká doga).",
      "Snímka sa uloží do karty pacienta v kategórii 'Zobrazovanie' a neprepíše profilovú fotografiu zvieraťa.",
    ],
    practicalExample: {
      title: "Posúdenie kardiomegálie a pľúcneho edému na laterálnom RTG hrudníka",
      badge: "Kardiológia",
      scenario:
        "10-ročný pes s nočným kašľom a dýchavičnosťou. Veterinár zhotovil pravú laterálnu snímku hrudníka.",
      solution:
        "V /agent/imaging nahrá DICOM snímku a zvolí šablónu Thorax. AI zmeria VHS skóre 11.6 stavca (norma do 10.5), deteguje zväčšenie ľavej predsiene a perihilárny intersticiálny edém pľúc. Lekár správu vytlačí majiteľovi ako jasný dôkaz potreby kardiologickej liečby.",
    },
  },

  "/agent/discharge": {
    title: "AI prepúšťacie správy & domáca liečba",
    intro:
      "Generátor zrozumiteľných inštrukcií domácej starostlivosti pre majiteľov zvierat po operáciách a hospitalizácii. Prekladá odborný SOAP záznam do zrozumiteľného jazyka, vytvára prehľadný harmonogram dávkovania liekov a v prípade úhynu automaticky prepína do empatického kondolenčného listu (Sympathy Gate).",
    steps: [
      {
        icon: "📋",
        title: "Výber ukončenej vizity",
        description:
          "Vyberte pacienta po prepustení z hospitalizácie alebo po chirurgickom zákroku.",
      },
      {
        icon: "✨",
        title: "Automatické generovanie inštrukcií",
        description:
          "AI asistent prečíta terapeutický plán (P) a preloží ho do jasných pokynov pre majiteľa (kŕmenie, venčenie, hygiena rany).",
      },
      {
        icon: "💊",
        title: "Rozpis domáceho dávkovania liekov",
        description:
          "Prehľadná tabuľka: názov lieku, dávka, čas podania (ráno / obed / večer) a spôsob podania (s krmivom / nalačno).",
      },
      {
        icon: "⚠️",
        title: "Varovné príznaky (Kedy volať pohotovosť)",
        description:
          "Automaticky doplní špecifické varovné príznaky pre daný zákrok (napr. krvácanie z rany, apatia, zvracanie).",
      },
      {
        icon: "🖨️",
        title: "Tlač a odoslanie majiteľovi",
        description:
          "Vytlačte správu na formát A4 do ruky majiteľovi a odošlite digitálnu kópiu priamo na jeho e-mail.",
      },
    ],
    tips: [
      "Správy neobsahujú latinské odborné termíny – majiteľ presne rozumie, čo má doma robiť.",
      "Tabuľka liekov obsahuje zaškrtávacie políčka pre majiteľa na odškrtávanie podaných tabliet.",
      "Sympathy Gate: Ak bol pacient eutanazovaný, modul automaticky vygeneruje dôstojný kondolenčný list namiesto liečebných pokynov.",
    ],
    practicalExample: {
      title: "Prepustenie psa po enterotómii (vybratie cudzieho telesa z čreva)",
      badge: "Domáca starostlivosť",
      scenario:
        "Pes odchádza domov po chirurgickom odstránení loptičky z tenkého čreva. Majiteľ je nervózny a bojí sa domácej starostlivosti.",
      solution:
        "Modul vygeneruje prepúšťací list: odporučí šetriacu diétu v malých dávkach 5x denne, zakáže skákanie a behanie na 10 dní, vytvorí tabuľku na antibiotiká a analgetiká a červeným písmom zvýrazní: 'V prípade zvracania alebo tvrdého brucha okamžite volajte našu pohotovosť'.",
    },
  },

  "/vet-intel": {
    title: "Veterinárny trhový radar & úradný vestník",
    intro:
      "Strategický informačný a analytický modul pre majiteľov veterinárnych kliník. Monitoruje úradné vestníky ŠVPS SR a KVL SR (mimoriadne núdzové opatrenia, africký mor ošípaných AMO, vtáčia chrípka HPAI, besnota), legislatívne zmeny a poskytuje anonymizovaný regionálny cenový benchmark.",
    steps: [
      {
        icon: "🏛️",
        title: "Úradné vestníky ŠVPS SR & KVL SR",
        description:
          "Sledujte aktuálne platné mimoriadne veterinárne nariadenia, karanténne pásma a legislatívne výnosy pre váš okres.",
      },
      {
        icon: "📍",
        title: "Regionálny trhový cenový radar",
        description:
          "Zadajte PSČ ambulancie a porovnajte priemerné cenové hladiny bežných úkonov v regióne (vakcinácia, kastrácia, čistenie zubov ultrazvukom).",
      },
      {
        icon: "💡",
        title: "Manažérske trendy a stratégie",
        description:
          "Inšpirujte sa overenými manažérskymi postupmi pre retenciu klientov, cenotvorbu a zavádzanie moderného vybavenia kliniky.",
      },
    ],
    tips: [
      "Všetky trhové porovnania rešpektujú Etický kódex KVL SR a slúžia výhradne pre interné rozhodovanie manažmentu kliniky.",
      "Upozornenia na výskyt nebezpečných nákaz v okrese kliniky sa automaticky zobrazujú s vysokou prioritou.",
    ],
    practicalExample: {
      title: "Preverenie povinností pri vyhlásení ohniska vtáčej chrípky (HPAI)",
      badge: "Veterinárny vestník",
      scenario:
        "V susednej obci bol potvrdený výskyt vtáčej chrípky u drobnochovateľa. Veterinár potrebuje vedieť reštrikcie pre presun hydiny a odber vzoriek.",
      solution:
        "V /vet-intel v záložke 'Úradné vestníky' okamžite nájde nariadenie ŠVPS SR, mapu 3 km ochranného pásma a 10 km pásma dohľadu s presnými povinnosťami súkromného veterinárneho lekára.",
    },
  },

  "/admin": {
    title: "Správa kliniky, prístupy a audit logy",
    intro:
      "Riadiaca konzola pre administrátorov a majiteľov praxe. Umožňuje správu používateľských účtov, prideľovanie bezpečnostných rolí (admin, veterinár, technik, recepcia), kontrolu forenzného auditného denníka, správu SMS kvót a monitorovanie systémových integrácií.",
    steps: [
      {
        icon: "👥",
        title: "Správa používateľov a pozvánok",
        description:
          "Pozvite nových zamestnancov e-mailom a priraďte im príslušnú bezpečnostnú rolu podľa ich pracovnej náplne.",
      },
      {
        icon: "🛡️",
        title: "Nastavenie rolí a oprávnení",
        description:
          "Roly striktne riadia prístup: len lekári a admini môžu potvrdzovať diagnózy, stornovať e-Kasa doklady a pristupovať k omamným látkam.",
      },
      {
        icon: "📜",
        title: "Forenzný auditný denník",
        description:
          "Sledujte chronologický zoznam všetkých udalostí v systéme: kto, kedy, z akej IP adresy upravil záznam pacienta alebo stornoval účet.",
      },
      {
        icon: "📱",
        title: "Monitoring SMS kvóty",
        description:
          "Prehľad odoslaných SMS správ cez bránu Telnyx/Twilio, stav kreditu a miera doručiteľnosti správ majiteľom.",
      },
      {
        icon: "📄",
        title: "Inšpekčný export pre úrady",
        description:
          "Vygenerujte oficiálny auditný protokol pre inšpekčné kontroly ŠVPS SR alebo Úrad na ochranu osobných údajov (ÚOOÚ).",
      },
    ],
    tips: [
      "Záznamy vo forenznom auditnom denníku nemožno vymazať ani upraviť – slúžia ako právny dôkaz pri súdnych sporoch.",
      "Zmena roly používateľa nadobúda platnosť okamžite bez nutnosti opätovného prihlasovania.",
      "Pre zvýšenie bezpečnosti odporúčame všetkým zamestnancom aktivovať dvojfaktorovú autentifikáciu (2FA).",
    ],
    practicalExample: {
      title: "Preverenie neoprávnenej zmeny v dávkovaní lieku cez audit log",
      badge: "Bezpečnosť",
      scenario:
        "Hlavný lekár zistil zmenu dávkovania anestetika v uzavretom operačnom protokole a potrebuje overiť, kto zmenu vykonal.",
      solution:
        "V /admin otvorí 'Forenzný auditný denník', zadá ID vizity a systém zobrazí presný záznam: dátum, čas, meno používateľa, pôvodnú a novú hodnotu vrátane kryptografického odtlačku zmeny.",
    },
  },

  "/migration-archive": {
    title: "Archív migrovaných dát (WinVet / Vetis)",
    intro:
      "Dlhoveký archív historických dát importovaných zo starších ambulantných systémov (WinVet, Vetis, Vetmax). Poskytuje bezpečný a bleskový prístup k historickým vyšetreniam, operáciám a očkovaniam starším ako 10 rokov, ktoré zákon vyžaduje uchovávať.",
    steps: [
      {
        icon: "🔍",
        title: "Vyhľadávanie v archíve",
        description:
          "Hľadajte podľa historického čísla karty, mena pacienta, majiteľa alebo starého formátu tetovacieho čísla.",
      },
      {
        icon: "📜",
        title: "Zobrazenie pôvodného textu",
        description:
          "Prezrite si pôvodné operačné protokoly, laboratórne nálezy a záznamy z predchádzajúcich rokov v nezmenenej podobe.",
      },
      {
        icon: "🔗",
        title: "Prepojenie s novou kartou",
        description:
          "Jedným kliknutím prepojte historický spis so znovuotvorenou kartou pacienta v modernom systéme OpenVPM.",
      },
      {
        icon: "📄",
        title: "Export archívneho spisu",
        description:
          "Stiahnite ucelený PDF výpis historických vizít pri vyžiadaní súdom, políciou alebo poisťovňou.",
      },
    ],
    tips: [
      "Archívne dáta sú uchovávané v režime read-only, čo garantuje ich dôkaznú integritu pre právne účely.",
      "Vyhľadávanie indexuje aj staré skratky diagnóz a voľný text, ktorý sa používal v systéme WinVet.",
    ],
    practicalExample: {
      title: "Dohľadanie operačného protokolu spred 9 rokov",
      badge: "Archív dát",
      scenario:
        "13-ročný kastrovaný pes má podozrenie na nádor na slezine. Majiteľ tvrdí, že pred 9 rokmi mal na klinike operovaný žalúdok, ale záznam v novej databáze nie je.",
      solution:
        "V /migration-archive zadajte meno psa a rok 2017. Systém okamžite nájde pôvodný textový protokol z WinVetu potvrdzujúci gastropexiu po torzii žalúdka, čo výrazne pomôže chirurgovi pri plánovaní dnešnej operácie.",
    },
  },

  "/onboarding": {
    title: "Sprievodca prvotným nastavením praxe",
    intro:
      "Interaktívny asistent pre bezproblémové spustenie novej veterinárnej ambulancie v systéme OpenVPM AI. Krok za krokom vás prevedie nastavením identifikačných údajov kliniky, importom pacientov, konfiguráciou e-Kasy, cenníka a prizvaním personálu.",
    steps: [
      {
        icon: "🏥",
        title: "Profil kliniky a legislatíva",
        description:
          "Zadajte IČO, DIČ, registračné číslo pracoviska KVL SR a adresu. Tieto údaje sa automaticky použijú na receptoch a faktúrach.",
      },
      {
        icon: "📥",
        title: "Import pacientov a klientov",
        description:
          "Nahrajte existujúcu databázu zo súboru Excel (CSV/XLSX) alebo požiadajte o asistovanú migráciu z WinVet/Vetis.",
      },
      {
        icon: "🖨️",
        title: "Pripojenie pokladnice e-Kasa",
        description:
          "Zadajte IP adresu fiškálnej tlačiarne FiskalPRO alebo prihlasovacie údaje do Virtuálnej registračnej pokladnice (VRP2).",
      },
      {
        icon: "💰",
        title: "Nastavenie cenníka výkonov",
        description:
          "Aktivujte odporúčaný veterinárny cenník KVL SR alebo nahrajte vlastný zoznam výkonov a liekov.",
      },
      {
        icon: "👥",
        title: "Prizvanie tímu ambulancie",
        description:
          "Zadajte e-maily kolegov, priraďte im roly a nastavte ordinačné hodiny v rozvrhu.",
      },
    ],
    tips: [
      "Kedykoľvek počas sprievodcu môžete kliknúť na „Vyžiadať asistenciu\" a náš tím technickej podpory vám pomôže s migráciou dát.",
      "Ukážkové demo dáta môžete po otestovaní systému vymazať jedným kliknutím v Nastaveniach.",
    ],
    practicalExample: {
      title: "Rýchly štart novej ambulancie za 30 minút",
      badge: "Onboarding",
      scenario:
        "Veterinár otvára novú prax pre malé zvieratá a potrebuje mať do hodiny funkčný rozvrh, cenník a pokladňu pre prvých pacientov.",
      solution:
        "V sprievodcovi /onboarding vyplní IČO (systém sám dotiahne adresu z registra firiem), načíta vzorový cenník KVL SR, prepojí FiskalPRO tlačiareň a systém je okamžite pripravený prijímať pacientov a vydávať bločky.",
    },
  },

  "/marketing": {
    title: "Marketing a komunikácia s klientmi",
    intro:
      "Centrálny modul pre budovanie vzťahov s majiteľmi zvierat, rast kliniky a edukáciu klientov. Zahŕňa hromadné kampane, automatické pripomienky, edukačné letáky s QR kódmi, správu reputácie na Google, TV displej v čakárni a správu webovej stránky ambulancie.",
    steps: [
      {
        icon: "🎯",
        title: "Tvorba cielenej kampane",
        description:
          "Zvoľte cieľovú skupinu (napr. majitelia psov nad 7 rokov, mačky bez vakcinácie) a pripravte personalizovanú SMS alebo e-mail.",
      },
      {
        icon: "📄",
        title: "Edukačné materiály a letáky",
        description:
          "Využite modul Letáky s AI generátorom na tvorbu letákov o prevencii kliešťov, zubnom kameni či kastraciách s QR kódom.",
      },
      {
        icon: "⭐",
        title: "Automatický zber Google recenzií",
        description:
          "Systém po úspešnej vizite automaticky osloví spokojného majiteľa so žiadosťou o krátke hodnotenie na Google.",
      },
      {
        icon: "🛡️",
        title: "Sympathy Gate ochrana",
        description:
          "Automatická etická poistka okamžite vyradí klientov so zosnulým zvieratkom zo všetkých marketingových kampaní.",
      },
    ],
    tips: [
      "Najvyššiu odozvu majú preventívne kampane načasované podľa sezóny: jarná ochrana pred kliešťami, jesenné geriatrické prehliadky.",
      "Brand Kit zabezpečuje, že všetky vaše letáky, e-maily a web používajú rovnaké logo a firemné farby kliniky.",
      "Nikdy neposielajte marketingové správy po 20:00 hodine – rešpektujte súkromie klientov.",
    ],
    practicalExample: {
      title: "Jarná kampaň na prevenciu parazitov s edukačným letákom",
      badge: "Kampaň",
      scenario:
        "Začína sezóna kliešťov a klinika chce upozorniť majiteľov na nebezpečenstvo babeziózy a lymskej boreliózy.",
      solution:
        "Vytvorte v module Letáky leták 'Pozor na kliešte' s QR kódom na rezerváciu, vytlačte plagát do čakárne a cez modul Správy odošlite cielenú SMS majiteľom psov s odkazom na digitálnu verziu letáku.",
    },
  },

  "/marketing/handouts": {
    title: "Letáky a edukačné materiály",
    intro:
      "Tvorba profesionálnych edukačných materiálov a letákov pre majiteľov zvierat s pomocou AI veterinárneho generátora. Materiály automaticky preberajú identitu kliniky z Brand Kitu, obsahujú QR kódy na online verziu a sú optimalizované pre farebnú tlač A4 alebo zdieľanie na webe.",
    steps: [
      {
        icon: "➕",
        title: "Vytvorenie nového letáku",
        description:
          "Zvoľte tému (napr. Starostlivosť o chrup, Parvoviróza, Diéta pri ochorení obličiek) a cieľový druh zvieraťa.",
      },
      {
        icon: "🤖",
        title: "Generovanie obsahu cez AI",
        description:
          "AI asistent pripraví odborný, no pre laika zrozumiteľný text s nadpisom, kľúčovými bodmi a odporúčaním veterinára.",
      },
      {
        icon: "🎨",
        title: "Dizajn podľa Brand Kitu",
        description:
          "Leták automaticky aplikuje vaše logo, firemnú paletu farieb a kontaktné údaje bez manuálnej grafickej práce.",
      },
      {
        icon: "📱",
        title: "QR kód a tlač na A4",
        description:
          "Vytlačte leták pre majiteľa do ruky alebo vystavte plagát v čakárni – klienti si naskenovaním QR kódu otvoria leták v mobile.",
      },
    ],
    tips: [
      "Letáky odovzdané majiteľovi po stanovení diagnózy znižujú počet telefonických otázok na kliniku až o 60 %.",
      "QR kód na letáku umožňuje klientovi priamo z mobilu objednať odporúčané diétne krmivo alebo kontrolný termín.",
    ],
    practicalExample: {
      title: "Edukačný leták pre majiteľa mačky s novozisteným diabetom",
      badge: "Edukácia",
      scenario:
        "Majiteľ mačky je po diagnostike cukrovky vystrašený z domáceho pichania inzulínu a merania glykémie glukometrom.",
      solution:
        "V module Letáky vygenerujte leták 'Domáci manažment diabetu u mačky'. Leták zrozumiteľne vysvetlí techniku aplikácie inzulínu, varovné príznaky hypoglykémie a majiteľ odchádza domov s jasným návodom.",
    },
  },

  "/marketing/brand-kit": {
    title: "Brand Kit – vizuálna identita kliniky",
    intro:
      "Centrálne nastavenie firemnej identity veterinárnej ambulancie. Uchováva logo v krivkách (SVG), firemnú paletu farieb, písma a oficiálne kontaktné údaje. Všetky generované materiály, e-maily, faktúry, web a TV obrazovky automaticky čerpajú z Brand Kitu pre jednotný reprezentatívny vzhľad.",
    steps: [
      {
        icon: "🖼️",
        title: "Nahratie loga ambulancie",
        description:
          "Nahrajte vektorové SVG alebo PNG s priehľadným pozadím (odporúčané rozlíšenie aspoň 512x512 px).",
      },
      {
        icon: "🎨",
        title: "Nastavenie firemných farieb",
        description:
          "Zvoľte primárnu a sekundárnu farbu kliniky pomocou HEX kódov pre zladenie všetkých výstupov.",
      },
      {
        icon: "📋",
        title: "Kontaktné údaje pre hlavičky",
        description:
          "Vyplňte oficiálny názov pracoviska, adresu, pohotovostný telefón a web pre automatické vkladanie do pätičiek.",
      },
      {
        icon: "👁️",
        title: "Náhľad na dokumentoch",
        description:
          "Skontrolujte, ako bude vaša identita vyzerať na letáku, faktúre, prepúšťacej správe a TV obrazovke v čakárni.",
      },
    ],
    tips: [
      "Vektorový formát SVG zaručuje dokonale ostré zobrazenie loga na tlači A4 aj na 4K monitore v čakárni.",
      "Zvoľte kontrastné farby, ktoré spĺňajú štandardy čitateľnosti textu (WCAG AA).",
    ],
    practicalExample: {
      title: "Zjednotenie vizuálu novootvorenej kliniky",
      badge: "Branding",
      scenario:
        "Nová klinika chce, aby všetky odosielané e-maily, tlačené recepty, faktúry a letáky mali rovnaký prémiový dizajn.",
      solution:
        "V /marketing/brand-kit nahrajte logo a nastavte tyrkysovú a tmavomodrú farbu. Systém okamžite preformátuje hlavičky všetkých tlačových zostáv, prepúšťacích správ a e-mailových šablón.",
    },
  },

  "/marketing/reviews": {
    title: "Recenzie – Google reputácia",
    intro:
      "Automatizovaný systém zberu pozitívnych hodnotení na Google a Facebooku. Inteligentne identifikuje spokojných klientov po úspešnej vizite a odosiela im priateľskú žiadosť o recenziu v optimálnom čase, čím výrazne zvyšuje pozíciu ambulancie v lokálnom vyhľadávaní Google máp.",
    steps: [
      {
        icon: "🔗",
        title: "Prepojenie s Google Business profilom",
        description:
          "Vložte priamy odkaz na zanechanie recenzie vášho profilu v Google mapách.",
      },
      {
        icon: "⏱️",
        title: "Časovanie odoslania žiadosti",
        description:
          "Nastavte časový odstup (odporúčame 2 až 4 hodiny po vizite, kedy má majiteľ čerstvý pozitívny dojem).",
      },
      {
        icon: "🛡️",
        title: "Etická poistka Sympathy Gate",
        description:
          "Systém automaticky blokuje žiadosti pri zosnulých pacientoch, komplikovaných operáciách alebo klientoch s reklamáciou.",
      },
      {
        icon: "📊",
        title: "Prehľad a sledovanie ratingu",
        description:
          "Sledujte vývoj priemerného hodnotenia (napr. 4.9★) a počet novozískaných hodnotení v čase.",
      },
    ],
    tips: [
      "Až 78 % nových klientov si vyberá veterinárnu ambulanciu na základe hodnotení v Google mapách.",
      "Rýchle oslovenie do 3 hodín po návšteve dosahuje 3x vyššiu mieru zanechania recenzie než pripomenutie na druhý deň.",
    ],
    practicalExample: {
      title: "Získanie 5★ recenzie po úspešnom zubnom ošetrení",
      badge: "Reputácia",
      scenario:
        "Majiteľka psíka bola nadšená z profesionálneho prístupu a čistých zubov po ultrazvukovej dentálnej hygiene.",
      solution:
        "2 hodiny po vizite jej príde milá SMS: 'Ďakujeme za návštevu s Benym. Ak ste boli spokojní s našou starostlivosťou, pomôžte nám krátkym hodnotením na Google: g.page/review...'. Majiteľka obratom zanechá 5-hviezdičkové hodnotenie.",
    },
  },

  "/marketing/messages": {
    title: "Správy – SMS a e-mailová fronta",
    intro:
      "Centrálny komunikačný dispečing ambulancie. Umožňuje sledovať stav doručenia všetkých odosielaných SMS správ a e-mailov v reálnom čase, odosielať manuálne správy klientom a riešiť nedoručené oznámenia.",
    steps: [
      {
        icon: "📨",
        title: "Sledovanie komunikačnej fronty",
        description:
          "Prehľad všetkých správ so stavom: Odoslané, Doručené, Čakajúce, Chyba doručenia (neplatné číslo).",
      },
      {
        icon: "✉️",
        title: "Odoslanie rýchlej správy klientovi",
        description:
          "Zvoľte príjemcu, vyberte kanál (SMS cez Telnyx/Twilio alebo e-mail cez Resend) a napíšte správu.",
      },
      {
        icon: "🔄",
        title: "Opätovné odoslanie pri chybe",
        description:
          "Pri zlyhaní doručenia (napr. vybitý mobil klienta) kliknite na ikonu opakovania pokusu po overení čísla.",
      },
    ],
    tips: [
      "SMS správy majú mieru otvorenia až 98 % – používajte ich na urgentné oznámenia a pripomienky termínov.",
      "E-mail odporúčame pre laboratórne výsledky, faktúry a dlhšie prepúšťacie správy.",
    ],
    practicalExample: {
      title: "Oznámenie majiteľovi o prebudení pacienta po narkóze",
      badge: "Komunikácia",
      scenario:
        "Pes po plánovanej kastrácii je plne prebudený z narkózy, stojí a môže ísť bezpečne do domácej starostlivosti.",
      solution:
        "V module Správy alebo priamo z vizity kliknite 'SMS klientovi' a odošlite šablónu: 'Váš psík Bono je už prebudený z anestézie a pripravený na vyzdvihnutie. Môžete si preňho prísť medzi 15:00 a 17:00'.",
    },
  },

  "/marketing/automations": {
    title: "Automatizácie & workflow pravidlá",
    intro:
      "Konfigurátor automatických pravidiel, ktoré šetria personálu desiatky hodín týždenne. Zabezpečuje automatické odosielanie správ na základe udalostí v systéme: potvrdenie rezervácie, pripomienka 24h pred termínom, poďakovanie po vizite či pripomenutie ročnej kontroly.",
    steps: [
      {
        icon: "⚡",
        title: "Výber spúšťača (Trigger)",
        description:
          "Zvoľte udalosť: Vytvorenie termínu, Ukončenie vizity, Expirácia vakcíny, Narodeniny pacienta.",
      },
      {
        icon: "🎯",
        title: "Nastavenie podmienok",
        description:
          "Obmedzte pravidlo na konkrétny druh zvierat (napr. len psy), vekovú kategóriu alebo typ zákroku.",
      },
      {
        icon: "✉️",
        title: "Definovanie obsahu a kanála",
        description:
          "Pripravte šablónu s dynamickými premennými ({meno_klienta}, {meno_pacienta}, {cas_terminu}).",
      },
      {
        icon: "⏱️",
        title: "Časový odstup",
        description:
          "Nastavte, kedy sa má správa odoslať (napr. 24 hodín pred termínom, 2 hodiny po vizite).",
      },
    ],
    tips: [
      "Začnite s 3 základnými automatizáciami: Potvrdenie termínu, Pripomienka deň vopred a Revakcinácia po roku.",
      "Automatizácie sú blokované v nočných hodinách (21:00 - 08:00), aby správy nerušili klientov v spánku.",
    ],
    practicalExample: {
      title: "Eliminácia nedostavenia sa na termín (No-show)",
      badge: "Automatizácia",
      scenario:
        "Klinika eviduje, že 15 % klientov zabudne prísť na objednaný termín, čo spôsobuje prestoje na operačnej sále.",
      solution:
        "Aktivujte pravidlo 'Pripomienka termínu 24 hodín vopred'. Klient dostane SMS s časom vyšetrenia a inštrukciou 'Nalačno od polnoci'. Miera nedostavenia sa okamžite klesne pod 2 %.",
    },
  },

  "/marketing/consents": {
    title: "GDPR súhlasy a právny audit",
    intro:
      "Komplexná správa súhlasov klientov so spracúvaním osobných údajov podľa Nariadenia EÚ 2016/679 (GDPR) a zákona č. 18/2018 Z. z. Zabezpečuje evidenciu súhlasov pre marketing, pripomienky, zmluvné podmienky a generuje certifikované protokoly pre kontrolu Úradu na ochranu osobných údajov SR.",
    steps: [
      {
        icon: "📋",
        title: "Prehľad stavu súhlasov",
        description:
          "Tabuľka klientov s vyznačeným stavom udelených súhlasov (SMS marketing, e-mail newsletter, spracovanie údajov).",
      },
      {
        icon: "✍️",
        title: "Zaznamenanie nového súhlasu",
        description:
          "Zaevidujte udelenie súhlasu (osobne podpisom na recepcii, cez Klientsky portál alebo webový formulár).",
      },
      {
        icon: "🚫",
        title: "Okamžité odvolanie súhlasu (Opt-out)",
        description:
          "Ak klient požiada o zrušenie zasielania správ, jedným klikom súhlas odvoláte a systém zablokuje marketing.",
      },
      {
        icon: "📄",
        title: "Export protokolu pre GDPR audit",
        description:
          "Vygenerujte časovo opečiatkovaný PDF výpis preukazujúci zákonnosť spracovania údajov pre inšpekciu ÚOOÚ SR.",
      },
    ],
    tips: [
      "Upozornenia na blížiace sa vakcinácie sú klasifikované ako priamy výkon veterinárnej starostlivosti, nie marketing.",
      "Všetky zmeny súhlasov sú zaznamenané s presnou časovou pečiatkou a IP adresou v auditnom denníku.",
    ],
    practicalExample: {
      title: "Preukázanie súhlasu so zasielaním SMS pri kontrole",
      badge: "GDPR audit",
      scenario:
        "Klient namietal zaslanie pripomienky dentálnej hygieny a obrátil sa so sťažnosťou na úrad.",
      solution:
        "V module GDPR Súhlasy vyhľadajte klienta a vygenerujte PDF protokol. Dokument jasne preukáže dátum a čas udelenia súhlasu pri registrácii na recepcii s podpisom.",
    },
  },

  "/marketing/media": {
    title: "Knižnica médií & AI canvas editor",
    intro:
      "Centrálne úložisko pre obrázky, infografiky, videá a materiály používané v letákoch, na webe a na TV obrazovke v čakárni. Obsahuje vstavaný grafický AI editor pre úpravu rozmerov, orezanie a generovanie vizuálov pre veterinárnu komunikáciu.",
    steps: [
      {
        icon: "📁",
        title: "Správa priečinkov a súborov",
        description:
          "Organizujte obrázky do kategórií: Priestory kliniky, Tím lekárov, Pacienti, Edukačné infografiky, Logá.",
      },
      {
        icon: "⬆️",
        title: "Nahratie nových médií",
        description:
          "Nahrajte obrázky JPG, PNG, SVG alebo WebP. Systém automaticky optimalizuje veľkosť pre rýchle načítanie.",
      },
      {
        icon: "🎨",
        title: "Úprava v AI Canvas editore",
        description:
          "Zmeňte rozmery pre sociálne siete, pridajte textový popis, logo kliniky alebo upravte pozadie priamo v prehliadači.",
      },
      {
        icon: "🔗",
        title: "Vloženie do letáku alebo na web",
        description:
          "Kopírujte odkaz na médium alebo ho priamo vyberte pri tvorbe letáku v module Letáky.",
      },
    ],
    tips: [
      "Pre web a sociálne siete preferujte moderný formát WebP, ktorý má až o 70 % menšiu veľkosť pri zachovaní špičkovej kvality.",
      "Fotografie reálneho personálu a pacientov kliniky dosahujú o 80 % vyššiu dôveru majiteľov ako anonymné fotobanky.",
    ],
    practicalExample: {
      title: "Príprava banneru o novom USG prístroji pre web a čakáreň",
      badge: "Médiá",
      scenario:
        "Klinika kúpila nový kardiologický ultrazvuk a chce o tom informovať majiteľov na webe a na TV v čakárni.",
      solution:
        "Odfoťte prístroj, nahrajte fotku do Knižnice médií, v AI Canvas editore pridajte logo kliniky, nápis 'Špičková kardiológia už u nás' a uložte. Obrázok sa okamžite sprístupní pre TV displej aj web.",
    },
  },

  "/marketing/plan": {
    title: "Obsahový plán – editoriálny kalendár",
    intro:
      "Vizuálny plánovací kalendár pre marketingové a edukačné aktivity kliniky. Umožňuje vopred naplánovať sezónne kampane, príspevky na sociálne siete, zmeny otváracích hodín a odosielanie hromadných newsletterov.",
    steps: [
      {
        icon: "📅",
        title: "Mesačný kalendárny pohľad",
        description:
          "Prehľad naplánovaných aktivít farebne rozlíšených podľa kanála (SMS kampaň, e-mail, príspevok na sociálne siete, leták).",
      },
      {
        icon: "➕",
        title: "Naplánovanie novej aktivity",
        description:
          "Kliknite na dátum v kalendári, zadajte tému, cieľovú skupinu, priraďte zodpovedného člena tímu a termín schválenia.",
      },
      {
        icon: "🤖",
        title: "AI návrh sezónneho plánu",
        description:
          "Tlačidlo „AI navrhnúť plán\" analyzuje veterinárnu sezónu a navrhne optimálny harmonogram kampaní na celý mesiac.",
      },
      {
        icon: "📊",
        title: "Sledovanie plnenia",
        description:
          "Sledujte stav úloh: V príprave, Schválené, Odoslané, Vyhodnotené.",
      },
    ],
    tips: [
      "Sezónne témy plánujte aspoň 3 týždne vopred (napr. kliešte vo februári, stomatologický mesiac v októbri, silvestrovský stres v novembri).",
      "Pravidelný obsah zvyšuje mieru návštevnosti webu a stabilizuje tržby v slabších mesiacoch.",
    ],
    practicalExample: {
      title: "Plánovanie Silvestrovskej kampane proti stresu z ohňostrojov",
      badge: "Obsahový plán",
      scenario:
        "V decembri majitelia masovo hľadajú prípravky na upokojenie psov pred Silvestrom (Sileo, Tessie, feromóny, adaptogény).",
      solution:
        "V obsahovom pláne naplánujte na 1. decembra edukačný článok na web, na 10. decembra leták do čakárne a na 15. decembra SMS kampaň majiteľom bojazlivých psov. Klinika včas pripraví zásoby a klienti prídu vopred.",
    },
  },

  "/marketing/website": {
    title: "Web ambulancie – CMS editor",
    intro:
      "Jednoduchý editor verejnej webovej stránky vašej veterinárnej ambulancie. Umožňuje bez nutnosti programátora upravovať otváracie hodiny, pohotovostné kontakty, predstavenie tímu lekárov, cenník a publikovať novinky s optimalizáciou pre Google vyhľadávanie (SEO).",
    steps: [
      {
        icon: "🏠",
        title: "Úprava úvodnej stránky",
        description:
          "Zmeňte hlavný uvítací nadpis, fotku kliniky, ordinačné hodiny a adresu ambulancie.",
      },
      {
        icon: "⏰",
        title: "Otváracie hodiny a sviatky",
        description:
          "Nastavte bežné ordinačné hodiny a špeciálny oznam o dovolenke alebo zmenách počas štátnych sviatkov.",
      },
      {
        icon: "📰",
        title: "Pridanie aktuality",
        description:
          "Publikujte článok o novom vybavení, varovaní pred nákazou alebo zmene v tíme. Zmeny sa prejavia okamžite.",
      },
      {
        icon: "🔍",
        title: "SEO nastavenia pre Google",
        description:
          "Nastavte kľúčové slová a meta popis (napr. 'Veterinárna klinika Žilina, pohotovosť a chirurgia'), aby vás klienti našli na 1. strane Google.",
      },
    ],
    tips: [
      "Aktualizujte otváracie hodiny pred každými sviatkami – predídete nespokojným klientom pred zatvorenými dverami.",
      "Pridanie novinky aspoň raz za mesiac posilňuje autoritu vášho webu v algoritme Google.",
    ],
    practicalExample: {
      title: "Okamžité zverejnenie oznamu o čerpaní letnej dovolenky",
      badge: "Web CMS",
      scenario:
        "Klinika má v piatok sanitárny deň a cez víkend neordinuje. Potrebuje to okamžite oznámiť verejnosti.",
      solution:
        "V /marketing/website zapnite lištu 'Dôležitý oznam': 'V piatok 15.8. zatvorené z dôvodu sanitárneho dňa. V akútnych prípadoch volajte zmluvnú pohotovosť...'. Oznam sa okamžite rozsvieti v záhlaví vášho webu.",
    },
  },

  "/marketing/tv": {
    title: "TV displej – obrazovka v čakárni",
    intro:
      "Vysielanie edukačného a informačného obsahu na TV obrazovku v čakárni bez nutnosti drahého hardvéru. Stačí otvoriť webový prehliadač na smart televízore. Zobrazuje čakací rad pacientov v reálnom čase, edukačné letáky, videá, otváracie hodiny a dôležité výstrahy.",
    steps: [
      {
        icon: "📺",
        title: "Pripojenie smart TV",
        description:
          "Na televízore v čakárni otvorte internetový prehliadač a zadajte jednorazovú adresu zobrazenú v tomto module.",
      },
      {
        icon: "🔄",
        title: "Výber obsahu pre slučku (Playlist)",
        description:
          "Vyberte, čo sa má striedať: letáky o prevencii, predstavenie lekárov, informácie o čipovaní, live čakacia fronta.",
      },
      {
        icon: "⏱️",
        title: "Nastavenie dĺžky zobrazenia",
        description:
          "Nastavte čas pre každý snímok (odporúčame 15 až 25 sekúnd pre optimálne prečítanie majiteľom).",
      },
      {
        icon: "📡",
        title: "Live widget čakárne",
        description:
          "Aktivujte anonymné poradové čísla pacientov – čakajúci majitelia presne vidia, kedy prídu na rad.",
      },
    ],
    tips: [
      "TV obrazovka v čakárni skracuje subjektívny pocit čakania majiteľa zvieraťa až o 40 %.",
      "Vložte na snímky QR kódy – klienti si počas čakania naskenujú leták alebo stiahnu aplikáciu portálu do mobilu.",
    ],
    practicalExample: {
      title: "Edukačné vysielanie o nebezpečenstve cudzích telies počas vianočných sviatkov",
      badge: "TV čakáreň",
      scenario:
        "V decembri čakajú v čakárni desiatky majiteľov. Hrozí riziko požitia vianočných ozdôb, čokolády a kostí z kapra.",
      solution:
        "Na TV displej zaraďte edukačný slajd 'Pozor na vianočné nástrahy: čokoláda, hrozienka a kosti'. Klienti si počas čakania prečítajú varovania a mnohí sa rovno pri pulte opýtajú na preventívne rady.",
    },
  },

  "/marketing/wellness": {
    title: "Wellness plány – preventívne predplatné",
    intro:
      "Tvorba a manažment preventívnych balíkov celoročnej starostlivosti. Umožňuje chovateľom a majiteľom predplatiť si ročnú starostlivosť (očkovania, odčervenia, dentálna hygiena, krvné testy, zľavy na zákroky) formou mesačných alebo ročných platieb, čo zabezpečuje klinike stabilný predvídateľný príjem.",
    steps: [
      {
        icon: "📦",
        title: "Definovanie wellness balíka",
        description:
          "Vytvorte balík (napr. 'Šteňa Junior', 'Dospelý pes Active', 'Senior Mačka 8+') a navoľte zahrnuté výkony a tovary.",
      },
      {
        icon: "🐾",
        title: "Priradenie pacienta k plánu",
        description:
          "V karte pacienta aktivujte zvolený plán, nastavte periodicitu platieb a vygenerujte zmluvu.",
      },
      {
        icon: "📅",
        title: "Sledovanie čerpania benefitov",
        description:
          "Pri vizite systém automaticky rozpozná predplatené položky (napr. 1x bezplatné strihanie pazúrikov, 2x kontrola krvi).",
      },
      {
        icon: "🔔",
        title: "Automatické upomienky čerpania",
        description:
          "Systém pripomenie majiteľovi nevyčerpané preventívne prehliadky pred koncom platnosti ročného plánu.",
      },
    ],
    tips: [
      "Pacienti zaradení do wellness plánov navštevujú ambulanciu priemerne 3,5-krát častejšie než nepredplatení klienti.",
      "Predplatné výrazne zvyšuje záchyt ranných štádií chronických ochorení u seniorov (obličky, srdce, zuby).",
    ],
    practicalExample: {
      title: "Senior Wellness plán pre 10-ročného labradora",
      badge: "Wellness",
      scenario:
        "Majiteľ staršieho labradora chce mať istotu, že nič nezanedbá, ale obáva sa nárazových vysokých výdavkov na vyšetrenia.",
      solution:
        "Aktivujte balík 'Senior Pes': zahŕňa ročnú vakcináciu, 2x biochemický profil krvi, kontrolný RTG hrudníka a kĺbov a 10 % zľavu na lieky proti artróze. Majiteľ platí fixný mesačný poplatok a pes má zabezpečený špičkový celoročný monitoring.",
    },
  },

  "/marketing/competitors": {
    title: "Analýza konkurencie v regióne",
    intro:
      "Prehľad o veterinárnom trhu a klinikách vo vašom okolí (okruh 5 - 25 km). Poskytuje verejne dostupné dáta o Google hodnoteniach, počte recenzií, otváracích hodinách, spektre poskytovaných služieb a pomáha identifikovať trhové medzery a príležitosti pre rozvoj ambulancie.",
    steps: [
      {
        icon: "🗺️",
        title: "Mapa veterinárnych pracovísk",
        description:
          "Prezrite si polohu a hustotu veterinárnych ambulancií vo vašom okrese.",
      },
      {
        icon: "⭐",
        title: "Porovnanie reputácie a recenzií",
        description:
          "Sledujte vývoj vášho hodnotenia v porovnaní s priemerom v regióne a identifikujte časté dôvody nespokojnosti u konkurencie.",
      },
      {
        icon: "🩺",
        title: "Analýza spektra služieb",
        description:
          "Zistite, ktoré špecializácie v regióne chýbajú (napr. laparoskopická chirurgia, špecializovaná stomatológia, hospitalizácia, nočná pohotovosť).",
      },
    ],
    tips: [
      "Diferenciácia na základe kvality služieb, moderného vybavenia a empatickej komunikácie je omnoho úspešnejšia ako cenová vojna.",
      "Sledovanie trendov pomáha pri rozhodovaní o investíciách do drahého vybavenia (napr. stomatologický RTG, endoskopia).",
    ],
    practicalExample: {
      title: "Identifikácia dopytu po stomatologických výkonoch v okrese",
      badge: "Strategické riadenie",
      scenario:
        "Majiteľ kliniky zvažuje kúpu dentálnej jednotky a stomatologického RTG v hodnote 15 000 € a potrebuje zistiť trhový potenciál.",
      solution:
        "V module Analýza konkurencie zistí, že v okruhu 20 km žiadna ambulancia neposkytuje intraorálny dentálny RTG a klienti sa v recenziách často pýtajú na extrakcie zubov. Investícia má garantovanú rýchlu návratnosť.",
    },
  },

  "/reports": {
    title: "Reporty a analytika ambulancie",
    intro:
      "Komplexná hospodárska a medicínska analytika. Ponúka detailné prehľady tržieb podľa lekárov, kategórií výkonov a liečiv, vývoj počtu nových pacientov, retention rate majiteľov zvierat, štatistiky vakcinácií a exporty pre účtovníctvo vo formátoch XLSX a PDF.",
    steps: [
      {
        icon: "📅",
        title: "Výber sledovaného obdobia",
        description:
          "Zvoľte deň, aktuálny mesiac, kvartál, kalendárny rok alebo vlastný dátumový rozsah.",
      },
      {
        icon: "💰",
        title: "Finančný report tržieb",
        description:
          "Rozpad príjmov podľa kategórií: veterinárne služby, predaj liekov, krmivá, chirurgia, laboratórium s rozdelením DPH.",
      },
      {
        icon: "👨‍⚕️",
        title: "Výkonnosť jednotlivých lekárov",
        description:
          "Prehľad počtu ošetrených vizít a vygenerovaného obratu jednotlivých veterinárov pre spravodlivé výpočty odmien.",
      },
      {
        icon: "🐾",
        title: "Pacientske demografické metriky",
        description:
          "Štatistiky nových pacientov, najčastejšie plemená, zastúpenie psov a mačiek a miera návratnosti klientov.",
      },
      {
        icon: "📥",
        title: "Export dát pre účtovníka",
        description:
          "Stiahnite prehľadnú tabuľku vo formáte XLSX alebo PDF s finálnym súčtom základov dane a DPH.",
      },
    ],
    tips: [
      "Pravidelný mesačný monitoring pomeru služieb k predaju tovaru pomáha optimalizovať maržovú politiku kliniky.",
      "Report neplatičov zobrazuje zoznam klientov s neuhradenými faktúrami po lehote splatnosti.",
    ],
    practicalExample: {
      title: "Mesačná uzávierka výkonov a podklady pre provízie lekárov",
      badge: "Manažment",
      scenario:
        "Majiteľ kliniky na konci mesiaca potrebuje vypočítať variabilnú zložku mzdy pre dvoch zamestnaných veterinárov na základe ich čistých výkonov.",
      solution:
        "V /reports zvolí filter 'Výkonnosť lekárov' za uplynulý mesiac. Systém zobrazí presný obrat vygenerovaný jednotlivými veterinármi očistený o nákupné ceny spotrebovaných liekov.",
    },
  },

  "/settings": {
    title: "Nastavenia ambulancie",
    intro:
      "Globálna konfigurácia celej platformy OpenVPM AI. Správa profilu pracoviska (IČO, DIČ, KVL SR kód), správa používateľských účtov a personálu, definovanie cenníka služieb a tovarov, nastavenie e-Kasa tlačiarne, integrácií SMS brán a importu dát.",
    steps: [
      {
        icon: "🏥",
        title: "Profil a identita ambulancie",
        description:
          "Záložka „Všeobecné\": upravte názov kliniky, adresu, registračné číslo KVL SR, bankový účet (IBAN) pre faktúry.",
      },
      {
        icon: "👥",
        title: "Správa tímu a ordinačných hodín",
        description:
          "Záložka „Zamestnanci\": pridajte lekárov a sestry, nastavte im prístupové roly a farbu v kalendári rozvrhu.",
      },
      {
        icon: "💰",
        title: "Konfigurácia cenníka",
        description:
          "Záložka „Cenník\": upravte ceny výkonov, sadzby DPH a vytvorte zľavové skupiny pre chovateľov.",
      },
      {
        icon: "🔌",
        title: "Integračné mosty",
        description:
          "Záložka „Integrácie\": prepojte SMS bránu (Telnyx/Twilio), odosielanie e-mailov (Resend) a platobnú bránu Stripe.",
      },
    ],
    tips: [
      "Zmena údajov v profile pracoviska sa okamžite premietne do hlavičiek všetkých novovystavených dokladov a receptov.",
      "API kľúče pre SMS bránu a e-maily sú uložené v šifrovanej podobe a nikto z bežných zamestnancov k nim nemá prístup.",
    ],
    practicalExample: {
      title: "Pridanie nového veterinárneho asistenta s obmedzenými právami",
      badge: "Správa tímu",
      scenario:
        "Do tímu nastupuje študent veterinárnej medicíny na pozíciu technika. Má mať prístup k rozvrhu a záznamom, ale nesmie meniť cenník ani stornovať faktúry.",
      solution:
        "V Nastavenia → Zamestnanci kliknite 'Pridať člena', zadajte jeho e-mail a vyberte rolu 'Technik'. Používateľ dostane pozvánku a systém automaticky obmedzí jeho prístup k finančným operáciám.",
    },
  },

  "/settings/ekasa": {
    title: "Nastavenie e-Kasa tlačiarne & pokladnice",
    intro:
      "Konfigurácia fiškálneho hardvéru a napojenia na Finančnú správu SR. Umožňuje nastaviť IP adresu a komunikačný port certifikovanej tlačiarne FiskalPRO (LAN/USB REST port 8080/8443) alebo prihlasovacie údaje pre Virtuálnu registračnú pokladnicu VRP2.",
    steps: [
      {
        icon: "🖨️",
        title: "Výber typu pokladničného riešenia",
        description:
          "Zvoľte hardvérovú tlačiareň FiskalPRO (eKasa Box / terminál) alebo cloudovú VRP2 Finančnej správy.",
      },
      {
        icon: "🌐",
        title: "Sieťové nastavenie (IP adresa & port)",
        description:
          "Zadajte lokálnu IP adresu tlačiarne v ambulancii (napr. 192.168.1.150) a port (predvolený 8080 alebo 8443 pre SSL).",
      },
      {
        icon: "🧪",
        title: "Test spojenia tlačiarne",
        description:
          "Kliknite na „Testovať pripojenie\". Systém overí komunikáciu a vytlačí skúšobný nedaňový diagnostický lístok.",
      },
      {
        icon: "📄",
        title: "Nastavenie hlavičky a päty bločku",
        description:
          "Upravte sprievodný text v päte dokladu (napr. 'Prajeme skoré uzdravenie vášmu miláčikovi!').",
      },
    ],
    tips: [
      "Pre tlačiareň FiskalPRO odporúčame na klinickom routeri nastaviť fixnú (statickú) IP adresu.",
      "V prípade poruchy hardvéru môžete v tomto module dočasne prepnúť pokladňu na VRP2 bez prerušenia prevádzky.",
    ],
    practicalExample: {
      title: "Prvotné spárovanie terminálu FiskalPRO na recepcii",
      badge: "e-Kasa nastavenie",
      scenario:
        "Technik priniesol novú e-Kasa tlačiareň FiskalPRO a zapojil ju do klinickej siete cez sieťový LAN kábel.",
      solution:
        "V /settings/ekasa zvoľte 'FiskalPRO Driver', zadajte IP adresu zobrazenú na displeji tlačiarne a kliknite 'Otestovať spojenie'. Tlačiareň pípne, vytlačí testovací riadok a od tej chvíle z nej vychádzajú všetky fiškálne doklady.",
    },
  },

  "/settings/import-v2": {
    title: "Import dát zo starých systémov (WinVet / Vetis)",
    intro:
      "Univerzálny migračný most pre prechod na OpenVPM AI. Zabezpečuje bezpečný import kompletných databáz z predchádzajúcich systémov (WinVet, Vetis, Vetmax, formáty CSV, XML, SQLite a SQL dumpy) vrátane anamnéz, čipov, vakcín a kontaktov majiteľov.",
    steps: [
      {
        icon: "📁",
        title: "Nahratie záložného súboru",
        description:
          "Nahrajte exportovaný ZIP archív alebo CSV súbory z pôvodného veterinárneho programu.",
      },
      {
        icon: "🔄",
        title: "Mapovanie stĺpcov a entít",
        description:
          "Skontrolujte priradenie polí (Meno zvieraťa -> patient.name, Číslo čipu -> microchip, Majiteľ -> client).",
      },
      {
        icon: "🧪",
        title: "Simulácia a overenie integrity",
        description:
          "Spustite testovací náhľad – systém odhalí prípadné chyby formátu a duplicity pred skutočným zápisom do databázy.",
      },
      {
        icon: "🚀",
        title: "Spustenie ostrej migrácie",
        description:
          "Potvrďte import. Záznamy sa bezpečne zapíšu do kartotéky so zachovaním historických dátumov a návštev.",
      },
    ],
    tips: [
      "Pred importom odporúčame skontrolovať telefónne čísla majiteľov (doplniť medzinárodnú predvoľbu +421).",
      "Ak máte neštandardný formát databázy, kliknite na 'Požiadať o asistovaný import' a naši technici vám databázu bezplatne pripravia.",
    ],
    practicalExample: {
      title: "Prechod kliniky z WinVetu s 5000 pacientmi",
      badge: "Migrácia",
      scenario:
        "Klinika fungovala 12 rokov na WinVete a prechádza na OpenVPM AI. Potrebuje zachovať kompletnú históriu 5000 zvierat.",
      solution:
        "Vo WinVete vyexportujte zálohu do XML/CSV, nahrajte ju do /settings/import-v2 a spustite sprievodcu. Systém počas obednej pauzy za 15 minút naimportuje všetkých 5000 pacientov vrátane čipov a anamnéz a poobede už lekári ordinujú v novom rozhraní.",
    },
  },

  "/inbox": {
    title: "Centrálna schránka komunikácie (Inbox)",
    intro:
      "Zjednotená schránka pre všetku prichádzajúcu a odchádzajúcu komunikáciu s klientmi. Združuje SMS konverzácie, e-maily a správy z klientskeho portálu do prehľadných konverzačných vlákien priradených priamo ku karte majiteľa.",
    steps: [
      {
        icon: "📥",
        title: "Prehľad prichádzajúcich správ",
        description:
          "Neprečítané SMS odpovede od klientov a e-maily sú zvýraznené v ľavom paneli s počítadlom.",
      },
      {
        icon: "💬",
        title: "Odpoveď v konverzačnom vlákne",
        description:
          "Kliknite na správu a odpovedzte priamo z aplikácie – klientovi príde SMS na mobil alebo e-mail do schránky.",
      },
      {
        icon: "🐾",
        title: "Kontext pacienta pri správe",
        description:
          "Priamo pri písaní správy vidíte v pravom paneli meno zvieraťa, poslednú návštevu a užívané lieky pre informovanú odpoveď.",
      },
      {
        icon: "✅",
        title: "Označenie za vybavené",
        description:
          "Po vyriešení požiadavky (napr. objednanie termínu) označte vlákno ako 'Vybavené' pre udržanie čistého inboxu.",
      },
    ],
    tips: [
      "Využite predpripravené rýchle odpovede (šablóny) pre najčastejšie otázky o otváracích hodinách či cene očkovania.",
      "Klient nemusí inštalovať žiadnu aplikáciu – odpovedá bežnou SMS správou zo svojho telefónu.",
    ],
    practicalExample: {
      title: "Odpoveď na SMS otázku majiteľa po nočnej operácii",
      badge: "Inbox",
      scenario:
        "Majiteľ o 7:00 posiela SMS: 'Dobrý deň, fenka po včerajšej operácii nechce piť vodu, môžem jej dať vývar?'.",
      solution:
        "Sestra v Inboxe vidí správu aj kartu fenky po operácii. Odpovie: 'Dobrý deň, vlažný nesolený vývar môžete ponúknuť v malých dávkach. Ak by do 10:00 nepila, zavolajte nám'. Majiteľ dostane odpoveď ako bežnú SMS.",
    },
  },

  "/support": {
    title: "Technická podpora a centrum pomoci",
    intro:
      "Oficiálny kanál technickej podpory pre používateľov OpenVPM AI. Slúži na riešenie prevádzkových incidentov, nahlásenie technických chýb, požiadavky na nové funkcie, asistenciu s certifikáciou e-Kasy a prístup k dokumentácii.",
    steps: [
      {
        icon: "🎫",
        title: "Otvorenie nového ticketu",
        description:
          "Zadajte predmet problému, popis situácie a úroveň závažnosti (Bežná otázka / Výpadok prevádzky).",
      },
      {
        icon: "📷",
        title: "Priloženie snímky obrazovky",
        description:
          "Pripojte screenshot alebo diagnostický súbor pre rýchlejšiu identifikáciu technickej príčiny.",
      },
      {
        icon: "📞",
        title: "Pohotovostná telefonická linka",
        description:
          "Pri kritických výpadkoch e-Kasy alebo databázy využite priamy telefonický kontakt na technickú službu.",
      },
      {
        icon: "📚",
        title: "Prehľadávanie vedomostnej bázy",
        description:
          "Návody krok za krokom, video manuály a odpovede na najčastejšie otázky personálu (FAQ).",
      },
    ],
    tips: [
      "Pre okamžité otázky využite online chat v pravom dolnom rohu obrazovky.",
      "Pred nahlásením chyby skúste obnoviť stránku stlačením Ctrl+F5 pre vyčistenie vyrovnávacej pamäte prehliadača.",
    ],
    practicalExample: {
      title: "Riešenie výpadku tlače fiškálnych dokladov pred víkendom",
      badge: "Podpora",
      scenario:
        "V piatok poobede prestala tlačiareň FiskalPRO reagovať na pokyny z počítača na recepcii.",
      solution:
        "Otvorte /support, kliknite 'Hlásenie kritického incidentu' s prioritou Urgent. Technik podpory sa do 10 minút spojí s ambulanciou, skontroluje IP adresu v sieti a obnoví tlačový most.",
    },
  },
};

/** Related modules for contextual navigation from help modal. */
const RELATED_MODULES: Record<string, RelatedModule[]> = {
  "/": [
    { name: "Rozvrh", href: "/schedule" },
    { name: "Pacienti", href: "/patients" },
    { name: "Čakáreň", href: "/waiting-room" },
    { name: "Fakturácia", href: "/billing" },
    { name: "Whiteboard", href: "/whiteboard" },
  ],
  "/schedule": [
    { name: "Čakáreň", href: "/waiting-room" },
    { name: "Pacienti", href: "/patients" },
    { name: "Klinické záznamy", href: "/records" },
    { name: "Fakturácia", href: "/billing" },
  ],
  "/patients": [
    { name: "Duplikáty pacientov", href: "/patients/duplicates" },
    { name: "Klinické záznamy", href: "/records" },
    { name: "Klienti", href: "/clients" },
    { name: "Zákonné registre", href: "/statutory" },
  ],
  "/patients/duplicates": [
    { name: "Pacienti", href: "/patients" },
    { name: "Klienti", href: "/clients" },
    { name: "Archív migrácie", href: "/migration-archive" },
  ],
  "/clients": [
    { name: "Pacienti", href: "/patients" },
    { name: "Fakturácia", href: "/billing" },
    { name: "Inbox", href: "/inbox" },
    { name: "GDPR súhlasy", href: "/marketing/consents" },
  ],
  "/records": [
    { name: "Pacienti", href: "/patients" },
    { name: "Vizity", href: "/encounters" },
    { name: "AI Hlasové diktovanie", href: "/agent/voice" },
    { name: "AI Asistent", href: "/agent" },
  ],
  "/encounters": [
    { name: "Klinické záznamy", href: "/records" },
    { name: "Pokladňa e-Kasa", href: "/billing/ekasa" },
    { name: "AI Prepúšťacie správy", href: "/agent/discharge" },
    { name: "Lab výsledky", href: "/lab-results" },
  ],
  "/billing": [
    { name: "e-Kasa pokladňa", href: "/billing/ekasa" },
    { name: "Rýchla pokladňa POS", href: "/billing/pos" },
    { name: "Reporty tržieb", href: "/reports" },
    { name: "Nastavenia cenníka", href: "/settings" },
  ],
  "/billing/ekasa": [
    { name: "Fakturácia", href: "/billing" },
    { name: "Rýchla pokladňa POS", href: "/billing/pos" },
    { name: "Nastavenie e-Kasa", href: "/settings/ekasa" },
    { name: "Reporty", href: "/reports" },
  ],
  "/billing/pos": [
    { name: "e-Kasa pokladňa", href: "/billing/ekasa" },
    { name: "Fakturácia", href: "/billing" },
    { name: "Sklad zásob", href: "/inventory" },
  ],
  "/care-reminders": [
    { name: "Pacienti", href: "/patients" },
    { name: "Rozvrh", href: "/schedule" },
    { name: "Klinické kontroly (Recalls)", href: "/recalls" },
    { name: "Automatizácie", href: "/marketing/automations" },
  ],
  "/inventory": [
    { name: "Kontrolované látky (Opiáty)", href: "/controlled-substances" },
    { name: "Fakturácia", href: "/billing" },
    { name: "Klinické záznamy", href: "/records" },
  ],
  "/lab-results": [
    { name: "Klinické záznamy", href: "/records" },
    { name: "Pacienti", href: "/patients" },
    { name: "AI Asistent", href: "/agent" },
  ],
  "/statutory": [
    { name: "KVEPIS Submission Hub", href: "/statutory/kvepis" },
    { name: "Kontrolované látky", href: "/controlled-substances" },
    { name: "Klinické záznamy", href: "/records" },
    { name: "Pacienti", href: "/patients" },
  ],
  "/statutory/kvepis": [
    { name: "Zákonné registre", href: "/statutory" },
    { name: "Pacienti", href: "/patients" },
    { name: "Klinické záznamy", href: "/records" },
  ],
  "/controlled-substances": [
    { name: "Zákonné registre", href: "/statutory" },
    { name: "Sklad liečiv", href: "/inventory" },
    { name: "Klinické záznamy", href: "/records" },
  ],
  "/waiting-room": [
    { name: "Rozvrh", href: "/schedule" },
    { name: "Klinická tabuľa", href: "/whiteboard" },
    { name: "TV Displej", href: "/marketing/tv" },
    { name: "Pacienti", href: "/patients" },
  ],
  "/whiteboard": [
    { name: "Čakáreň", href: "/waiting-room" },
    { name: "Rozvrh", href: "/schedule" },
    { name: "Klinické záznamy", href: "/records" },
  ],
  "/recalls": [
    { name: "Pripomienky", href: "/care-reminders" },
    { name: "Pacienti", href: "/patients" },
    { name: "Klinické záznamy", href: "/records" },
    { name: "Inbox", href: "/inbox" },
  ],
  "/agent": [
    { name: "Hlasové diktovanie", href: "/agent/voice" },
    { name: "AI Analýza RTG", href: "/agent/imaging" },
    { name: "Prepúšťacie správy", href: "/agent/discharge" },
    { name: "Klinické záznamy", href: "/records" },
  ],
  "/agent/voice": [
    { name: "Klinické záznamy", href: "/records" },
    { name: "Vizity", href: "/encounters" },
    { name: "AI Asistent", href: "/agent" },
  ],
  "/agent/imaging": [
    { name: "Pacienti", href: "/patients" },
    { name: "Klinické záznamy", href: "/records" },
    { name: "AI Asistent", href: "/agent" },
  ],
  "/agent/discharge": [
    { name: "Vizity", href: "/encounters" },
    { name: "Klinické záznamy", href: "/records" },
    { name: "Klienti", href: "/clients" },
  ],
  "/vet-intel": [
    { name: "Zákonné registre", href: "/statutory" },
    { name: "Klinické záznamy", href: "/records" },
    { name: "AI Asistent", href: "/agent" },
  ],
  "/admin": [
    { name: "Nastavenia", href: "/settings" },
    { name: "Reporty", href: "/reports" },
    { name: "Podpora", href: "/support" },
  ],
  "/migration-archive": [
    { name: "Pacienti", href: "/patients" },
    { name: "Duplikáty", href: "/patients/duplicates" },
    { name: "Import dát", href: "/settings/import-v2" },
  ],
  "/onboarding": [
    { name: "Nastavenia kliniky", href: "/settings" },
    { name: "Nastavenie e-Kasa", href: "/settings/ekasa" },
    { name: "Import dát", href: "/settings/import-v2" },
  ],
  "/marketing": [
    { name: "Letáky", href: "/marketing/handouts" },
    { name: "Brand Kit", href: "/marketing/brand-kit" },
    { name: "Recenzie", href: "/marketing/reviews" },
    { name: "Automatizácie", href: "/marketing/automations" },
  ],
  "/marketing/handouts": [
    { name: "Brand Kit", href: "/marketing/brand-kit" },
    { name: "Médiá", href: "/marketing/media" },
    { name: "TV Displej", href: "/marketing/tv" },
    { name: "Marketing", href: "/marketing" },
  ],
  "/marketing/brand-kit": [
    { name: "Letáky", href: "/marketing/handouts" },
    { name: "Web ambulancie", href: "/marketing/website" },
    { name: "TV Displej", href: "/marketing/tv" },
    { name: "Marketing", href: "/marketing" },
  ],
  "/marketing/reviews": [
    { name: "Automatizácie", href: "/marketing/automations" },
    { name: "Správy", href: "/marketing/messages" },
    { name: "Klienti", href: "/clients" },
  ],
  "/marketing/messages": [
    { name: "Inbox", href: "/inbox" },
    { name: "Automatizácie", href: "/marketing/automations" },
    { name: "Marketing", href: "/marketing" },
  ],
  "/marketing/automations": [
    { name: "Správy", href: "/marketing/messages" },
    { name: "Recenzie", href: "/marketing/reviews" },
    { name: "Pripomienky", href: "/care-reminders" },
  ],
  "/marketing/consents": [
    { name: "Klienti", href: "/clients" },
    { name: "Nastavenia", href: "/settings" },
    { name: "Marketing", href: "/marketing" },
  ],
  "/marketing/media": [
    { name: "Letáky", href: "/marketing/handouts" },
    { name: "Brand Kit", href: "/marketing/brand-kit" },
    { name: "Obsahový plán", href: "/marketing/plan" },
  ],
  "/marketing/plan": [
    { name: "Letáky", href: "/marketing/handouts" },
    { name: "Automatizácie", href: "/marketing/automations" },
    { name: "Marketing", href: "/marketing" },
  ],
  "/marketing/website": [
    { name: "Brand Kit", href: "/marketing/brand-kit" },
    { name: "TV Displej", href: "/marketing/tv" },
    { name: "Marketing", href: "/marketing" },
  ],
  "/marketing/tv": [
    { name: "Čakáreň", href: "/waiting-room" },
    { name: "Letáky", href: "/marketing/handouts" },
    { name: "Médiá", href: "/marketing/media" },
  ],
  "/marketing/wellness": [
    { name: "Pacienti", href: "/patients" },
    { name: "Pripomienky", href: "/care-reminders" },
    { name: "Fakturácia", href: "/billing" },
  ],
  "/marketing/competitors": [
    { name: "Veterinárny trhový radar", href: "/vet-intel" },
    { name: "Recenzie", href: "/marketing/reviews" },
    { name: "Reporty", href: "/reports" },
  ],
  "/reports": [
    { name: "Fakturácia", href: "/billing" },
    { name: "Rozvrh", href: "/schedule" },
    { name: "Klinické záznamy", href: "/records" },
    { name: "Admin", href: "/admin" },
  ],
  "/settings": [
    { name: "e-Kasa nastavenie", href: "/settings/ekasa" },
    { name: "Import dát", href: "/settings/import-v2" },
    { name: "Fakturácia", href: "/billing" },
    { name: "Admin", href: "/admin" },
  ],
  "/settings/ekasa": [
    { name: "e-Kasa pokladňa", href: "/billing/ekasa" },
    { name: "Nastavenia", href: "/settings" },
    { name: "Fakturácia", href: "/billing" },
  ],
  "/settings/import-v2": [
    { name: "Archív migrácie", href: "/migration-archive" },
    { name: "Nastavenia", href: "/settings" },
    { name: "Pacienti", href: "/patients" },
  ],
  "/inbox": [
    { name: "Klienti", href: "/clients" },
    { name: "Klinické kontroly (Recalls)", href: "/recalls" },
    { name: "Správy", href: "/marketing/messages" },
  ],
  "/support": [
    { name: "Nastavenia", href: "/settings" },
    { name: "Admin", href: "/admin" },
    { name: "Prehľad", href: "/" },
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
