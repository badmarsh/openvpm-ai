import postgres from 'postgres';
import { randomUUID } from 'crypto';

const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const sql = postgres('postgresql://openpims:openpims@localhost:5434/openvpm_ai');

interface FormSeed {
  slug: string;
  title: string;
  body: string;
  sortOrder: number;
}

const FORMS: FormSeed[] = [
  {
    slug: 'vysetrenie-besnota',
    title: 'Veterinárne osvedčenie o vyšetrení zvieraťa (poranenie človeka / besnota)',
    sortOrder: 1,
    body: [
      'Ja, dolu podpísaný(á) vlastník/držiteľ zvieraťa beriem na vedomie, že zviera musí byť po dobu 14 dní izolované tak, aby nemohlo uniknúť ani poraniť človeka alebo iné zviera. Každú zmenu v správaní, prípadne stratu alebo úhyn zvieraťa bezodkladne oznámim ošetrujúcemu veterinárnemu lekárovi a príslušnej Regionálnej veterinárnej a potravinovej správe (RVPS).',
      '',
      'Poučenie o nákaze a zákonné povinnosti:',
      'Besnota je nebezpečná nákazlivá choroba, prenosná na všetky teplokrvné stavovce vrátane človeka. Po prepuknutí príznakov má vždy smrteľný priebeh a je neliečiteľná. V zmysle § 17 zákona č. 39/2007 Z. z. o veterinárnej starostlivosti je vlastník alebo držiteľ zvieraťa povinný:',
      'a) hlásiť orgánu veterinárnej správy podozrenie alebo výskyt besnoty,',
      'b) zabezpečiť pri vnímavých mäsožravcoch vakcináciu proti besnote,',
      'c) bez meškania zabezpečiť veterinárne vyšetrenie zvieraťa, ktoré poranilo človeka.',
      '',
      'V zmysle § 4 ods. 4 zákona č. 282/2002 Z. z. je držiteľ psa povinný oznámiť svoje údaje osobe, ktorú pes pohrýzol, ako aj obci, kde je pes evidovaný. Toto osvedčenie je potrebné ihneď odovzdať ošetrujúcemu lekárovi poranenej osoby.',
      '',
      'Nariadené opatrenie:',
      'Izolovanie a klinické pozorovanie zvieraťa po dobu 14 dní.',
      'Dátum 1. vyšetrenia (deň poranenia / nahlásenia): ____',
      'Dátum 2. kontrolného vyšetrenia (5. deň): ____',
      'Dátum 3. záverečného vyšetrenia (14. deň): ____',
      'Výsledok vyšetrenia: Zviera neprejavuje žiadne klinické príznaky besnoty ani nervového ochorenia.',
    ].join('\n'),
  },
  {
    slug: 'suhlas-eutanazia',
    title: 'Súhlas s eutanáziou a asanáciou',
    sortOrder: 2,
    body: [
      'Beriem na vedomie, že v prípade akýchkoľvek otázok ohľadne nasledujúcich prehlásení sa môžem ošetrujúceho veterinárneho lekára opýtať na ich význam.',
      '',
      '- Potvrdzujem, že som výlučný vlastník alebo oprávnená osoba zodpovedná za horeuvedené zviera a že som oprávnený(á) rozhodnúť o jeho eutanázii (humanitárnom usmrtení).',
      '- Potvrdzujem, že horeuvedené zviera v posledných pätnástich (15) dňoch nepohrýzlo ani neporanilo človeka alebo iné zviera.',
      '- Prehlasujem, že podľa mojich vedomostí nebolo horeuvedené zviera v posledných pätnástich (15) dňoch poranené iným zvieraťom podozrivým alebo chorým na besnotu.',
      '- Prehlasujem, že zviera nie je poistené, alebo že príslušná poisťovňa bola o rozhodnutí o eutanázii vopred upovedomená.',
      '- Dávam ošetrujúcemu veterinárnemu lekárovi (MVDr. Martin Sýkora) súhlas a oprávnenie na eutanáziu horeuvedeného zvieraťa s predchádzajúcim zbavením vedomia (sedácia/narkóza).',
      '- Zbavujem veterinárne pracovisko a lekára akejkoľvek zodpovednosti za eutanáziu vykonanú v zmysle tohto rozhodnutia.',
      '',
      'Naloženie s telom zvieraťa po eutanázii (vyberte): ____',
      '(Možnosti: individuálna kremácia / hromadná kremácia / zvoz kafilérnou službou / vlastné pochovanie v súlade s predpismi)',
      '',
      'Tento súhlas a osvedčenie slúži aj ako doklad pre odhlásenie zvieraťa z evidencie príslušného mestského alebo obecného úradu.',
    ].join('\n'),
  },
  {
    slug: 'suhlas-zakrok-anestezia',
    title: 'Súhlas s hospitalizáciou, zákrokom a anestéziou',
    sortOrder: 3,
    body: [
      'Ja, dolu podpísaný(á) majiteľ(ka) alebo poverená osoba uvedeného zvieraťa súhlasím s navrhnutými veterinárnymi úkonmi, hospitalizáciou, ako aj s ďalšími úkonmi, ktoré by sa počas pobytu vo veterinárnom zariadení javili ako opodstatnené a nevyhnutné na záchranu života a zdravia zvieraťa.',
      '',
      'Plánovaný zákrok / vyšetrenie: ____',
      '',
      'Bol(a) som riadne poučený(á) o súčasnom zdravotnom stave zvieraťa, o účele zákroku, ako aj o možných komplikáciách a rizikách zákroku vrátane celkovej anestézie. Som si vedomý(á), že biologické procesy živého organizmu nie sú vždy ovplyvniteľné ani správne vykonanými diagnostickými a terapeutickými postupmi a výsledok zákroku nemôže byť vopred garantovaný.',
      '',
      'Rovnako som si vedomý(á), že pri celkovej anestézii dochádza k zmene fyziologických funkcií v organizme, ktoré môžu, najmä z dôvodu skrytých vád, viesť k vzniku nepredvídaných životoohrozujúcich stavov.',
      '',
      'Predanestetické vyšetrenia a vnútrožilná infúzia:',
      'Boli mi ponúknuté predanestetické laboratórne vyšetrenia (krvný obraz, biochemický profil) a infúzia: absolvované / odmietnuté na vlastnú zodpovednosť.',
      '',
      'Kardiopulmonálna resuscitácia (KPR) v prípade zlyhania vitálnych funkcií:',
      'Voľba majiteľa: ÁNO - resuscitovať / NIE - neresuscitovať (DNR).',
      '',
      'Telefónny kontakt pre dnešný deň: ____',
      '',
      'Náklady spojené s hospitalizáciou, vyšetrením a terapiou uhradím pri prevzatí zvieraťa. V prípade potreby neodkladného rozšírenia zákroku súhlasím s primeraným navýšením celkovej ceny.',
    ].join('\n'),
  },
  {
    slug: 'suhlas-gdpr-crsz',
    title: 'Súhlas so spracovaním osobných údajov (GDPR / CRSZ)',
    sortOrder: 4,
    body: [
      'Týmto ako dotknutá osoba dávam výslovný a dobrovoľný súhlas v zmysle Nariadenia Európskeho parlamentu a Rady (EÚ) 2016/679 (GDPR) a zákona č. 18/2018 Z. z. o ochrane osobných údajov, aby moje osobné údaje uvedené v tomto dokumente boli spracúvané veterinárnym pracoviskom pre účely vedenia zdravotnej dokumentácie a poskytovania veterinárnej starostlivosti.',
      '',
      'Zároveň udeľujem súhlas, aby tieto údaje boli poskytnuté a spracované Komorou veterinárnych lekárov Slovenskej republiky (KVL SR, Botanická 17, Bratislava) a Štátnou veterinárnou a potravinovou správou SR (ŠVPS SR) pre účely prevádzkovania Centrálneho registra spoločenských zvierat (CRSZ) v zmysle zákona č. 39/2007 Z. z. o veterinárnej starostlivosti.',
      '',
      'Súhlasím, aby orgány veterinárnej správy, obce a útulky mali prístup k týmto údajom v prípade overovania totožnosti, straty alebo nálezu môjho zvieraťa za účelom kontaktovania vlastníka.',
      '',
      'Tento súhlas udeľujem na dobu trvania evidencie zvieraťa. Prehlasujem, že všetky uvedené údaje sú pravdivé.',
    ].join('\n'),
  },
  {
    slug: 'kontrola-totoznosti',
    title: 'Potvrdenie o kontrole totožnosti zvieraťa (čip / tetovanie)',
    sortOrder: 5,
    body: [
      'POTVRDENIE O KONTROLE TOTOŽNOSTI ZVIERAŤA',
      '',
      'Druh a plemeno: ____',
      'Meno zvieraťa: ____',
      'Pohlavie a dátum narodenia: ____',
      'Číslo preukazu o pôvode (rodokmeň): ____',
      'Číslo pasu spoločenského zvieraťa: ____',
      '',
      'Výsledok odpočtu elektronického transpondéra / tetovania:',
      'Zistené číslo mikročipu / tetovania: ____',
      'Umiestnenie čipu: ľavá strana krku / iné: ____',
      '',
      'Vyhlásenie ošetrujúceho veterinárneho lekára:',
      'Týmto potvrdzujem, že číslo zisteného mikročipu / tetovania sa ZHOĎUJE s číslom uvedeným v preukaze o pôvode a v pase spoločenského zvieraťa. Funkčnosť a čitateľnosť transpondéra bola riadne overená čítacím zariadením.',
    ].join('\n'),
  },
  {
    slug: 'ziadanka-laboratorium',
    title: 'Žiadanka na laboratórne vyšetrenia',
    sortOrder: 6,
    body: [
      'ŽIADANKA NA LABORATÓRNE VYŠETRENIE',
      '',
      'Odosielajúci veterinárny lekár: MVDr. Martin Sýkora',
      'Dátum a čas odberu vzorky: ____',
      'Odobratý materiál: plná krv / sérum / plazma / moč / trus / biopsia / ster / iné: ____',
      '',
      'Požadované laboratórne panely a vyšetrenia:',
      '- Hematologické vyšetrenie (krvný obraz + diferenciál)',
      '- Základná biochémia (ALT, AST, ALP, Urea, Krea, Glukóza, Celková bielkovina)',
      '- Rozšírená biochémia (elektrolyty Na, K, Cl, Ca, P, Bilirubín, Amyláza, Lipáza)',
      '- Endokrinológia (T4, Kortizol, Progesterón, cTSH)',
      '- Vyšetrenie moču (chemicky + sediment + UPC pomer)',
      '- Koprologické / parazitologické vyšetrenie',
      '- Rýchly diagnostický test (SNAP FeLV/FIV, CPV, Giardia, 4Dx)',
      '- Cytológia / histopatologické vyšetrenie',
      '- Mikrobiologická kultivácia a stanovenie citlivosti (antibiogram)',
      '',
      'Klinická anamnéza a pracovná diagnóza: ____',
      'Podávané liečivá pred odberom: ____',
    ].join('\n'),
  },
  {
    slug: 'lekarska-sprava',
    title: 'Lekárska správa / Prepúšťacia správa',
    sortOrder: 7,
    body: [
      'LEKÁRSKA SPRÁVA / CLINICAL DISCHARGE REPORT',
      '',
      'Ošetrujúci veterinárny lekár: MVDr. Martin Sýkora',
      'Dátum vyšetrenia / zákroku: ____',
      '',
      'Dôvod návštevy a anamnéza: ____',
      '',
      'Klinický nález (Status praesens):',
      'Hmotnosť: ____ kg, Teplota: ____ °C, CRT: ____ s, Sliznice: ____, Pulz: ____/min, Dych: ____/min.',
      'Nález: ____',
      '',
      'Klinická diagnóza: ____',
      '',
      'Vykonané zákroky a aplikovaná terapia v ambulancii: ____',
      '',
      'Domáca liečba a ordinované liečivá (názov, dávkovanie, frekvencia, dĺžka):',
      '1. ____',
      '2. ____',
      '3. ____',
      '',
      'Odporúčania, diétny a kľudový režim: ____',
      'Termín plánovanej kontroly / vybratia stehov: ____',
      'V prípade nečakaného zhoršenia zdravotného stavu bezodkladne kontaktujte ambulanciu.',
    ].join('\n'),
  },
];

async function main() {
  console.log(`=== SEEDOVANIE TLAČOVÝCH ZOSTÁV PRE PRAX ${PRACTICE_ID} ===`);

  for (const form of FORMS) {
    const existing = await sql`
      SELECT id FROM consent_forms 
      WHERE practice_id = ${PRACTICE_ID} AND slug = ${form.slug}
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE consent_forms
        SET title = ${form.title},
            body = ${form.body},
            sort_order = ${form.sortOrder},
            is_active = true,
            updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
      console.log(`[UPDATE] ${form.slug} -> ${form.title}`);
    } else {
      const id = randomUUID();
      await sql`
        INSERT INTO consent_forms (
          id, practice_id, slug, title, body, sort_order, is_active, created_at, updated_at
        ) VALUES (
          ${id}, ${PRACTICE_ID}, ${form.slug}, ${form.title}, ${form.body}, ${form.sortOrder}, true, NOW(), NOW()
        )
      `;
      console.log(`[INSERT] ${form.slug} -> ${form.title}`);
    }
  }

  const finalRows = await sql`
    SELECT id, slug, title, sort_order, is_active 
    FROM consent_forms 
    WHERE practice_id = ${PRACTICE_ID} AND deleted_at IS NULL
    ORDER BY sort_order
  `;

  console.log(`\nÚspešne nasadené. Celkovo aktívnych formulárov: ${finalRows.length}`);
  for (const r of finalRows) {
    console.log(`  ${r.sort_order}. [${r.slug}] ${r.title}`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
