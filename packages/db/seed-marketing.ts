import { config } from "dotenv";
config({ path: "../../.env" });
import { db } from "./client";
import { eq, and, ilike, isNull } from "drizzle-orm";
import {
  practices,
  users,
  clients,
  patients,
  extMarketingMediaConsents,
  extMarketingMediaAssets,
  extMarketingContentBatches,
  extMarketingContentItems,
  extMarketingTvSlides,
  extMarketingHandouts,
  extMarketingReviews,
  extMarketingCompetitorSnapshots,
  extMarketingAutomationRules,
  extAutomationRules,
  extAutomationJourneys,
  extCrmSegments,
  extCrmSegmentMemberships,
  extContentPillars,
  extContentBriefs,
  extChannelAccounts,
  extMarketingOperativeScripts,
  extMarketingMessageTemplates,
  extMarketingMessageLogs,
} from "./schema/index";

async function seedMarketingDemo() {
  console.log("Seeding rich demo marketing content for openvpm_ai...\n");

  // 1. Get primary practice
  const practice =
    (await db.query.practices.findFirst({
      where: ilike(practices.name, "%Martin Sýkora%"),
    })) ?? (await db.query.practices.findFirst());

  if (!practice) {
    console.error("Practice not found. Please run `pnpm db:seed:sk` first.");
    process.exit(1);
  }

  const practiceId = practice.id;
  console.log(`✓ Using practice: ${practice.name} (${practiceId})`);

  // Update Brand Kit in settings if needed
  const settings = (practice.settings as Record<string, unknown>) || {};
  if (!settings.brandKit) {
    settings.brandKit = {
      brandColor: "#0E5E4A",
      secondaryColor: "#E8A33D",
      toneOfVoice: "Odborný, empatický a láskavý k zvieratám",
      brandVoiceInstructions:
        "Komunikujeme zrozumiteľne pre majiteľov, bez zbytočného strašenia. Vyzdvihujeme prevenciu, low-stress manipuláciu a moderné diagnostické vybavenie.",
      disclaimer: "Informácie v príspevkoch majú edukačný charakter a nenahrádzajú priame veterinárne vyšetrenie.",
      defaultHashtags: ["#veterinar", "#zdravezviera", "#veterinarnaklinika", "#starostlivostozvierata"],
      socialHandles: {
        instagram: "@vetsykora",
        facebook: "Veterinárna klinika MVDr. Martin Sýkora",
      },
    };
    await db.update(practices).set({ settings }).where(eq(practices.id, practiceId));
    console.log("✓ Brand Kit initialized in practice settings");
  }

  // 2. Get first user (staff/vet)
  const vetUser = await db.query.users.findFirst({
    where: eq(users.practiceId, practiceId),
  });
  if (!vetUser) {
    console.error("User not found in practice.");
    process.exit(1);
  }
  const userId = vetUser.id;

  // 3. Get existing clients and patients
  const clinicClients = await db.query.clients.findMany({
    where: eq(clients.practiceId, practiceId),
    limit: 10,
  });

  const clinicPatients = await db.query.patients.findMany({
    where: eq(patients.practiceId, practiceId),
    limit: 10,
  });

  const client1 = clinicClients[0];
  const client2 = clinicClients[1] || client1;
  const pet1 = clinicPatients[0];
  const pet2 = clinicPatients[1] || pet1;

  // -------------------------------------------------------------------------
  // 4. GDPR Media Consents
  // -------------------------------------------------------------------------
  const existingConsents = await db.query.extMarketingMediaConsents.findMany({
    where: eq(extMarketingMediaConsents.practiceId, practiceId),
  });

  let consent1Id: string | undefined = existingConsents[0]?.id;
  let consent2Id: string | undefined = existingConsents[1]?.id;

  if (existingConsents.length === 0 && client1) {
    console.log("Seeding GDPR media consents...");
    const [c1] = await db
      .insert(extMarketingMediaConsents)
      .values({
        practiceId,
        clientId: client1.id,
        patientId: pet1?.id,
        scope: "photo_social",
        evidenceType: "signature",
        grantedAt: new Date(Date.now() - 30 * 86400_000),
        notes: "Podpísaný súhlas pri registrácii na recepcii kliniky.",
      })
      .returning();

    const [c2] = await db
      .insert(extMarketingMediaConsents)
      .values({
        practiceId,
        clientId: client2.id,
        patientId: pet2?.id,
        scope: "photo_web",
        evidenceType: "sms_confirm",
        grantedAt: new Date(Date.now() - 15 * 86400_000),
        notes: "Overené cez SMS token po zákroku.",
      })
      .returning();

    consent1Id = c1.id;
    consent2Id = c2.id;
    console.log("✓ Created 2 GDPR media consents");
  }

  // -------------------------------------------------------------------------
  // 5. Media Assets (Photos, Graphics, Illustrations, Video)
  // -------------------------------------------------------------------------
  const existingMedia = await db.query.extMarketingMediaAssets.findMany({
    where: eq(extMarketingMediaAssets.practiceId, practiceId),
  });

  if (existingMedia.length === 0) {
    console.log("Seeding media library assets...");
    await db.insert(extMarketingMediaAssets).values([
      {
        practiceId,
        uploadedBy: userId,
        url: "https://images.pexels.com/photos/7469274/pexels-photo-7469274.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800",
        kind: "photo",
        caption: "Preventívna prehliadka psa v ambulancii",
        patientName: pet1?.name || "Blesk",
        subjectsPresent: true,
        consentId: consent1Id,
        tags: ["pes", "prevencia", "prehliadka", "ambulancia"],
        altText: "Veterinárny lekár vyšetruje pokojného psa na vyšetrovacom stole – MVDr. Martin Sýkora",
      },
      {
        practiceId,
        uploadedBy: userId,
        url: "https://images.pexels.com/photos/6234607/pexels-photo-6234607.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800",
        kind: "photo",
        caption: "Stomatologická kontrola chrupu mačky",
        patientName: pet2?.name || "Micka",
        subjectsPresent: true,
        consentId: consent2Id,
        tags: ["macka", "stomatologia", "chrup", "prevencia"],
        altText: "Veterinárka kontroluje zubný kameň a ďasná mačacieho pacienta – MVDr. Martin Sýkora",
      },
      {
        practiceId,
        uploadedBy: userId,
        url: "https://images.pexels.com/photos/7470634/pexels-photo-7470634.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800",
        kind: "brand_graphic",
        caption: "Jarná antiparazitárna kampaň – vizuál",
        subjectsPresent: false,
        tags: ["kampaň", "kliešte", "prevencia", "grafika"],
        altText: "Grafická infografika o dôležitosti prevencie proti kliešťom a blchám na jar – Klinika MVDr. Martin Sýkora",
      },
      {
        practiceId,
        uploadedBy: userId,
        url: "https://images.pexels.com/photos/6235024/pexels-photo-6235024.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800",
        kind: "photo",
        caption: "Digitálny RTG snímok a konzultácia s majiteľom",
        subjectsPresent: false,
        tags: ["rtg", "diagnostika", "technologie", "kosti"],
        altText: "Zobrazenie digitálneho RTG vyšetrenia hrudníka na monitore vo veterinárnej ordinácii",
      },
      {
        practiceId,
        uploadedBy: userId,
        url: "https://images.pexels.com/photos/7469220/pexels-photo-7469220.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800",
        kind: "illustration",
        caption: "Ilustrácia: 5 zásad zdravého seniorského veku psa",
        subjectsPresent: false,
        tags: ["senior", "pes", "edukacia", "ilustracia"],
        altText: "Ilustrovaný edukačný prehľad starostlivosti o starnúceho psíka",
      },
      {
        practiceId,
        uploadedBy: userId,
        url: "https://images.pexels.com/photos/7469213/pexels-photo-7469213.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800",
        kind: "video",
        caption: "Krátke video: Ako správne podávať tabletu mačke bez stresu",
        subjectsPresent: false,
        tags: ["video", "macka", "tipy", "fear-free"],
        altText: "Názorné inštruktážne video pre majiteľov mačiek k domácej medikácii bez stresu",
      },
    ]);
    console.log("✓ Created 6 media assets in library");
  }

  // -------------------------------------------------------------------------
  // 6. Content Plan Items & Batches
  // -------------------------------------------------------------------------
  const existingContent = await db.query.extMarketingContentItems.findMany({
    where: eq(extMarketingContentItems.practiceId, practiceId),
  });

  if (existingContent.length === 0) {
    console.log("Seeding content plan items...");
    await db.insert(extMarketingContentItems).values([
      {
        practiceId,
        createdBy: userId,
        title: "Sezóna kliešťov sa začína: Ako správne chrániť vášho miláčika",
        body: "Jarné počasie prebúdza parazity skôr, než si myslíme. Kliešte prenášajú nebezpečné ochorenia ako babezióza a borelióza. Nečakajte na prvé prisatie – zastavte sa u nás v ambulancii a radi vám odporučíme vhodnú preventívnu ochranu (obojky, spot-on pipety alebo žuvacie tablety) šitú na mieru životnému štýlu vášho psíka alebo mačky. 🐾\n\nObjednajte sa pohodlne online cez náš rezervačný formulár.",
        channel: "instagram",
        status: "approved",
        scheduledFor: new Date(Date.now() + 2 * 86400_000),
        validatorVerdict: "pass",
        validatorFindings: [],
      },
      {
        practiceId,
        createdBy: userId,
        title: "Prečo psy a mačky potrebujú dentálnu hygienu?",
        body: "Až 80 % psov a 70 % mačiek starších ako 3 roky vykazuje známky ochorenia ďasien a zubného kameňa. Zápach z tlamy nie je normálny – je to signál začínajúceho zápalu. Včasná sanácia zubného kameňa ultrazvukom v inhalačnej anestézii predchádza bolestivým extrakciám a chráni srdce i obličky pred infekciou. Tento mesiac ponúkame bezplatnú kontrolu chrupu pri každej preventívnej prehliadke!",
        channel: "facebook",
        status: "published",
        publishedAt: new Date(Date.now() - 3 * 86400_000),
        validatorVerdict: "pass",
        validatorFindings: [],
      },
      {
        practiceId,
        createdBy: userId,
        title: "Rozšírené ordinačné hodiny a online výsledky laboratória",
        body: "Vážení klienti, aby sme vám ešte viac uľahčili návštevu, od tohto mesiaca máme otvorené aj každú sobotu dopoludnia od 8:30 do 12:00. Navyše, všetky výsledky krvných a biochemických testov si môžete bezpečne pozrieť vo svojej online klientskej zóne ihneď po spracovaní prístrojom.",
        channel: "google_business",
        status: "approved",
        scheduledFor: new Date(Date.now() + 5 * 86400_000),
        validatorVerdict: "pass",
        validatorFindings: [],
      },
      {
        practiceId,
        createdBy: userId,
        title: "SMS pripomienka: Termín ročného očkovania",
        body: "Dobrý deň, pripomíname blížiaci sa termín ročného povinného preočkovania pre pacienta {{pet_name}}. Objednajte si termín online alebo na tel. +421905123456. MVDr. Martin Sýkora",
        channel: "sms",
        status: "approved",
        validatorVerdict: "pass",
        validatorFindings: [],
      },
      {
        practiceId,
        createdBy: userId,
        title: "5 zásad starostlivosti o starnúceho psíka (od 7. roku)",
        body: "Seniori potrebujú viac pozornosti a pravidelnejší skríning. V novom článku na našom webe vám MVDr. Sýkora radí, ako upraviť kŕmnu dávku, podporiť kĺbový aparát a kedy absolvovať kontrolné USG vyšetrenie. Prečítajte si celý leták v našej knižnici edukačných materiálov.",
        channel: "facebook",
        status: "proposed",
        validatorVerdict: "pass",
        validatorFindings: [],
      },
    ]);
    console.log("✓ Created 5 content plan items");
  }

  // -------------------------------------------------------------------------
  // 7. Waiting Room TV Slides
  // -------------------------------------------------------------------------
  const existingSlides = await db.query.extMarketingTvSlides.findMany({
    where: eq(extMarketingTvSlides.practiceId, practiceId),
  });

  if (existingSlides.length === 0) {
    console.log("Seeding waiting room TV slides...");
    await db.insert(extMarketingTvSlides).values([
      {
        practiceId,
        createdBy: userId,
        title: "Vitajte vo Veterinárnej klinike MVDr. Martin Sýkora",
        body: "Pohotovostný telefón: +421 905 123 456. Ordinačné hodiny: Po-Pi 8:00–18:00, So 8:30–12:00. Pripravte si prosím očkovací preukaz pacienta.",
        durationSeconds: 12,
        sortOrder: 1,
        isActive: true,
      },
      {
        practiceId,
        createdBy: userId,
        title: "Dentálna hygiena chráni srdce i obličky",
        body: "Zápach z tlamy alebo žlté zuby? Nechajte skontrolovať chrup vášho miláčika. Včasné ultrazvukové čistenie predchádza bolesti a stratám zubov.",
        durationSeconds: 14,
        sortOrder: 2,
        isActive: true,
      },
      {
        practiceId,
        createdBy: userId,
        title: "Fear-Free vyšetrenie: Liečime bez strachu a stresu",
        body: "Používame upokojujúce feromóny, mäkké protišmykové podložky a maškrtky ako pozitívnu motiváciu. Chceme, aby sa u nás váš miláčik cítil bezpečne.",
        durationSeconds: 12,
        sortOrder: 3,
        isActive: true,
      },
      {
        practiceId,
        createdBy: userId,
        title: "Klientska zóna v mobile: Všetky výsledky po ruke",
        body: "Prihláste sa do online portálu našej kliniky a majte očkovania, prepúšťacie správy a laboratórne výsledky vždy priamo vo svojom smartfóne.",
        durationSeconds: 12,
        sortOrder: 4,
        isActive: true,
      },
      {
        practiceId,
        createdBy: userId,
        title: "Povinné čipovanie a register CRSZ",
        body: "Každý pes na Slovensku musí byť označený mikročipom a zaevidovaný v Centrálnom registri spoločenských zvierat (CRSZ). Čipujeme šetrne na počkanie.",
        durationSeconds: 12,
        sortOrder: 5,
        isActive: true,
      },
    ]);
    console.log("✓ Created 5 TV slides");
  }

  // -------------------------------------------------------------------------
  // 8. Educational Handouts (Markdown & QR)
  // -------------------------------------------------------------------------
  const existingHandouts = await db.query.extMarketingHandouts.findMany({
    where: eq(extMarketingHandouts.practiceId, practiceId),
  });

  if (existingHandouts.length === 0) {
    console.log("Seeding educational handouts...");
    await db.insert(extMarketingHandouts).values([
      {
        practiceId,
        createdBy: userId,
        slug: "starostlivost-po-kastracii",
        title: "Starostlivosť o psa a mačku po kastrácii a sterilizácii",
        species: ["pes", "macka"],
        tags: ["chirurgia", "kastracia", "pooperacna-starostlivost", "rana"],
        isPublic: true,
        body: `# Pokyny k domácej starostlivosti po kastrácii

Váš miláčik úspešne absolvoval plánovaný chirurgický zákrok. Aby rekonvalescencia prebehla hladko a bez komplikácií, dodržiavajte prosím nasledujúce zásady.

---

### 1. Prebúdzanie a prvých 24 hodín
* **Pokojné a teplé miesto:** Uložte zviera na zem na deku (nie na gauč ani posteľ, hrozí pád pri zvyškovej malátnosti).
* **Teplota prostredia:** Po narkóze je termoregulácia znížená – chráňte pacienta pred prievanom a chladom.
* **Príjem vody a krmiva:** Vodu ponúknite po malých dávkach až po plnom nadobudnutí vedomia. Prvé ľahké jedlo (1/3 bežnej dávky) podajte najskôr 4 hodiny po prebudení.

### 2. Starostlivosť o operačnú ranu
* **Ochranný golier alebo pooperačné body:** Musí byť nasadené **nepretržite 24/7**, kým ste nevybrali stehy. Lízanie rany je najčastejšou príčinou infekcie a rozpadu stehov!
* **Kontrola rany:** 2× denne skontrolujte ranu. Mierne začervenanie je normálne; rana však nesmie krvácať, mokvať ani mať nepríjemný zápach.
* **Kúpanie:** Pacienta nekúpte minimálne 10 dní po zákroku.

### 3. Pohybový režim
* Psy venčite **výhradne na krátkom vodidle** (žiadny beh, skákanie do auta, schody obmedziť).
* Mačky držte v interiéri, zamedzte skákaniu na vyvýšené skrinky.

---

### Kedy bezodkladne volať našu pohotovosť:
* Výrazná apatia alebo odmietanie pitia dlhšie ako 24 hodín
* Opakované zvracanie
* Silné krvácanie alebo výtok z rany
* Bledé sliznice alebo zrýchlené sťažené dýchanie

**Telefón kliniky MVDr. Martin Sýkora:** +421 905 123 456
`,
      },
      {
        practiceId,
        createdBy: userId,
        slug: "dentalna-hygiena-doma",
        title: "Domáca dentálna hygiena a prevencia zubného kameňa",
        species: ["pes", "macka"],
        tags: ["zuby", "stomatologia", "prevencia", "hygiena"],
        isPublic: true,
        body: `# Ako udržať zuby a ďasná vášho miláčika zdravé

Až 8 z 10 psov a mačiek má v dospelosti problém so zubným povlakom a kameňom. Pravidelná domáca starostlivosť dokáže výrazne predĺžiť intervaly medzi profesionálnymi sanáciami.

---

### 1. Zlatý štandard: Mechanické čistenie kefkou
* Používajte **výhradne enzýmové zubné pasty pre zvieratá** (s príchuťou hydiny/pečene).
* **Nikdy nepoužívajte ľudskú zubnú pastu!** Obsahuje fluoridy a xylitol, ktoré sú pre psy a mačky toxické.
* Začínajte postupne: najprv masírujte ďasná prstom s trochou pasty, po pár dňoch pridajte prstovú alebo jemnú detskú kefku.

### 2. Dentálne maškrty a hračky
* Špeciálne dentálne žuvacie plátky s VOHC pečaťou (Veterinary Oral Health Council) pomáhajú mechanicky stierať povlak zo stoličiek.
* Vyhnite sa príliš tvrdým predmetom (kravské kosti, parohy), ktoré často spôsobujú zlomeniny zubov (fraktúry koruniek).

### 3. Ročná kontrola u veterinára
* Pri každom očkovaní skontrolujeme stav závesného aparátu zubov a prítomnosť paradentózy.
`,
      },
      {
        practiceId,
        createdBy: userId,
        slug: "ochrana-pred-kliestami-a-blchami",
        title: "Bezpečná prevencia proti kliešťom a blchám",
        species: ["pes", "macka"],
        tags: ["parazity", "kliest", "prevencia", "babezióza"],
        isPublic: true,
        body: `# Sprievodca modernou antiparazitárnou ochranou

Kliešte a blchy už dávno nie sú len sezónnou záležitosťou jari. V dôsledku miernych zím sú aktívne takmer celoročne, ak teplota vystúpi nad 5 °C.

---

### Prečo je prevencia nevyhnutná?
* **Babezióza:** Smrteľné protozoárne ochorenie psov, pri ktorom dochádza k masívnemu rozpadu červených krviniek (príznaky: tmavý moč, vysoká horúčka, apatia).
* **Lymská borelióza:** Spôsobuje chronické zápaly kĺbov a poškodenie obličiek.
* **Alergia na blšie uhryznutie (FAD):** Najčastejšia príčina intenzívneho svrbenia a straty srsti.

### Formy modernej ochrany:
1. **Žuvacie tablety:** Poskytujú ochranu na 1 až 3 mesiace. Sú odolné voči vode a kúpaniu.
2. **Kvalitné antiparazitárne obojky:** Dlhodobá ochrana (až 7-8 mesiacov). Dôležité je správne utiahnutie (na dva prsty od krku).
3. **Spot-on pipety:** Aplikujú sa na kožu medzi lopatky. Ideálne pre mačky a citlivé zvieratá.

*Poznámka: Prípravky s obsahom permethrínu sú pre mačky smrteľne toxické! Vždy používajte len overené veterinárne produkty určené pre daný druh.*
`,
      },
    ]);
    console.log("✓ Created 3 educational handouts");
  }

  // -------------------------------------------------------------------------
  // 9. Google & Facebook Reviews & Replies
  // -------------------------------------------------------------------------
  const existingReviews = await db.query.extMarketingReviews.findMany({
    where: eq(extMarketingReviews.practiceId, practiceId),
  });

  if (existingReviews.length === 0) {
    console.log("Seeding Google & Facebook reviews...");
    await db.insert(extMarketingReviews).values([
      // Google Reviews
      {
        practiceId,
        platform: "google",
        clientId: client1?.id,
        patientId: pet1?.id,
        reviewerName: "Zuzana Kováčová",
        rating: 5,
        reviewText: "Maximálna spokojnosť! Pán doktor Sýkora je obrovský odborník a má neskutočne milý prístup k zvieratám. Náš labrador Blesk sa k nemu do ambulancie dokonca teší. Zákrok prebehol hladko a oceňujem aj prehľadné pokyny po prepustení.",
        receivedAt: new Date(Date.now() - 3 * 86400_000),
        replyText: "Milá pani Kováčová, veľmi pekne ďakujeme za krásne slová a dôveru. Sme radi, že sa Bleskovi darí skvele a tešíme sa na ďalšiu preventívnu návštevu! S pozdravom, MVDr. Martin Sýkora",
        repliedAt: new Date(Date.now() - 2 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "google",
        clientId: client2?.id,
        patientId: pet2?.id,
        reviewerName: "Ing. Michal Baláž",
        rating: 5,
        reviewText: "Vynikajúca vybavenosť ambulancie (digitálny RTG aj laboratórium priamo na mieste). Rýchla diagnostika našej mačky počas víkendovej pohotovosti jej doslova zachránila život. Vrelo odporúčam každému chovateľovi.",
        receivedAt: new Date(Date.now() - 7 * 86400_000),
        replyText: "Pán Baláž, ďakujeme za hodnotenie. Včasná diagnostika a promptný prístup boli v tomto prípade kľúčové. Pozdravujeme pacientku a prajeme veľa zdravia!",
        repliedAt: new Date(Date.now() - 6 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "google",
        reviewerName: "Petra Nemcová",
        rating: 5,
        reviewText: "Krásne a čisté prostredie, Fear-Free prístup, ktorý naozaj funguje. Žiadny stres v čakárni, profesionálny personál. Objednanie online na presný čas funguje bez meškania.",
        receivedAt: new Date(Date.now() - 12 * 86400_000),
        replyText: "Ďakujeme, pani Nemcová. Pokojné a bezstresové prostredie pre zvieracích pacientov i majiteľov je našou prioritou.",
        repliedAt: new Date(Date.now() - 11 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "google",
        reviewerName: "Tomáš Horváth",
        rating: 4,
        reviewText: "Veľmi dobrá starostlivosť a odborné rady. Jediné malé mínus bolo krátke čakanie kvôli akútnemu prípadu pred nami, ale personál sa nám ospravedlnil a vysvetlil situáciu.",
        receivedAt: new Date(Date.now() - 18 * 86400_000),
        replyText: "Pán Horváth, ďakujeme za pochopenie pri ošetrení náhleho život ohrozujúceho prípadu. Vážime si vašu trpezlivosť a spätnú väzbu.",
        repliedAt: new Date(Date.now() - 17 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "google",
        reviewerName: "Martina Kováčiková",
        rating: 5,
        reviewText: "Chodíme sem už 3 roky so psíkom aj kocúrom. Vždy precízne vyšetrenie, špičkový sonograf a žiadne zbytočné predražovanie liečby. Ďakujeme celému personálu.",
        receivedAt: new Date(Date.now() - 24 * 86400_000),
        replyText: "Ďakujeme za dlhoročnú dôveru a vernosť našej klinike! Radi sa o vašich štvornohých parťákov postaráme kedykoľvek.",
        repliedAt: new Date(Date.now() - 23 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "google",
        reviewerName: "Branislav Novák",
        rating: 5,
        reviewText: "Záchrana nášho bernského salašníckeho psa Hektora pri nočnej torzii žalúdka (GDV). Okamžitá operácia, skvelá anestézia a starostlivosť na hospitalizačnom oddelení. Dnes je Hektor opäť vitálny a veselý. Nesmierna vďaka!",
        receivedAt: new Date(Date.now() - 28 * 86400_000),
        replyText: "Pán Novák, sme šťastní, že Hektor zvládol tak náročný zákrok a je v poriadku. Včasný príchod bol rozhodujúci. Prajeme mu veľa síl a zdravia!",
        repliedAt: new Date(Date.now() - 27 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "google",
        reviewerName: "Monika Čierna",
        rating: 5,
        reviewText: "Kastračný program dvoch adoptovaných mačiek z útulku. Neskutočne citlivý a trpezlivý prístup k plachým zvieratkám. Miniatúrne operačné ranky sa zahojili za pár dní bez nutnosti goliera.",
        receivedAt: new Date(Date.now() - 33 * 86400_000),
        replyText: "Ďakujeme pani Čierna za pomoc útulkáčom a za dôveru v našu chirurgiu. Mačičkám prajeme krásny a pokojný život v novom domove.",
        repliedAt: new Date(Date.now() - 32 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "google",
        reviewerName: "MVDr. Peter Krajčír",
        rating: 5,
        reviewText: "Ako chovateľ nemeckých ovčiakov vysoko oceňujem zhotovenie oficiálnych RTG snímkov bedrových a lakťových kĺbov (DBK/DLK) pre klubové posúdenie chovnosti. Špičková polohovacia technika, presná sedácia a promptné odoslanie dokumentácie.",
        receivedAt: new Date(Date.now() - 38 * 86400_000),
        replyText: "Ďakujeme za uznanie od skúseného chovateľa. Presná rádiológia a zdravie plemien sú pre nás srdcovou záležitosťou.",
        repliedAt: new Date(Date.now() - 37 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "google",
        reviewerName: "Juraj Varga",
        rating: 4,
        reviewText: "Absolvovali sme ultrazvukové odstránenie zubného kameňa a leštenie zubov u 8-ročného jazvečíka. Zákrok prebehol bezpečne v inhalačnej anestézii s monitoringom. Pes má opäť čisté zúbky a žiadny zápach z tlamy. Odporúčam!",
        receivedAt: new Date(Date.now() - 42 * 86400_000),
      },
      {
        practiceId,
        platform: "google",
        reviewerName: "Silvia Hrušková",
        rating: 5,
        reviewText: "Špecializácia na drobné cicavce! Náš králik Bobo trpel prerastaním stoličiek a odmietal seno. Pán doktor mu chrup odborne obrúsil a nastavil podpornú motilitnú liečbu. Na druhý deň už sám s chuťou jedol.",
        receivedAt: new Date(Date.now() - 47 * 86400_000),
      },
      {
        practiceId,
        platform: "google",
        reviewerName: "Radoslav Majerčík",
        rating: 5,
        reviewText: "Veľké plus za bezbariérový vstup a vyhradené parkovanie priamo pred vchodom kliniky. Náš starší retríver s ťažkou dyspláziou by schody nezvládol. Liečba bolesti a laserová terapia mu výrazne zlepšili mobilitu.",
        receivedAt: new Date(Date.now() - 51 * 86400_000),
        replyText: "Pán Majerčík, komfort a prístupnosť pre hendikepovaných a starších pacientov je pre nás kľúčová. Tešíme sa z pokroku pri laserovej terapii!",
        repliedAt: new Date(Date.now() - 50 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "google",
        reviewerName: "Elena Kolárová",
        rating: 5,
        reviewText: "Diagnostika a nastavenie liečby cukrovky u 10-ročného kocúra Félixa. Pani doktorka nám všetko trpezlivo vysvetlila, ukázala aplikáciu inzulínu a domáce meranie glukometrom. Veľmi nám to psychicky pomohlo.",
        receivedAt: new Date(Date.now() - 56 * 86400_000),
      },
      // Facebook Reviews
      {
        practiceId,
        platform: "facebook",
        reviewerName: "Lucia Tóthová",
        rating: 5,
        reviewText: "Odporúča Veterinárnu kliniku MVDr. Sýkora: Neskutočne ľudský a empatický prístup! S našou fenkou Bellou sme absolvovali náročnú stomatologickú operáciu. Po prebudení nám pani doktorka podrobne vysvetlila domácu starostlivosť a na druhý deň nám z kliniky volali, ako sa fenka cíti. Ďakujeme z celého srdca! ❤️🐾",
        receivedAt: new Date(Date.now() - 4 * 86400_000),
        replyText: "Milá Lucia, nesmierne nás teší vaša recenzia. Zdravie a komfort Belly boli na prvom mieste. Ďakujeme za dôveru!",
        repliedAt: new Date(Date.now() - 3 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "facebook",
        reviewerName: "Marek Dvořák",
        rating: 5,
        reviewText: "Odporúča kliniku: Skvelý tím lekárov a sestričiek. RTG bedrových kĺbov a oficiálne posúdenie prebehlo hladko a v pokojnej atmosfére. Špičková komunikácia cez SMS notifikácie pred termínom.",
        receivedAt: new Date(Date.now() - 8 * 86400_000),
        replyText: "Ďakujeme, pán Dvořák! Tešíme sa, že moderný systém notifikácií prináša pohodlie chovateľom.",
        repliedAt: new Date(Date.now() - 7 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "facebook",
        reviewerName: "Katarína Szabóová",
        rating: 5,
        reviewText: "Odporúča kliniku: Najlepšia vet klinika v širokom okolí. Moderné vybavenie, čistota a hlavne láskavý prístup k vystrašeným zvieratkám. Naša mačička Líza bola úplne pokojná.",
        receivedAt: new Date(Date.now() - 14 * 86400_000),
        replyText: "Ďakujeme za milé odporúčanie na Facebooku! Spokojnosť Lízy a pokojné ošetrenie mačiek je naša špecialita. 🐱",
        repliedAt: new Date(Date.now() - 13 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "facebook",
        reviewerName: "Peter Molnár",
        rating: 4,
        reviewText: "Odporúča kliniku: Profesionálny prístup pri vakcinácii a čipovaní šteniatka. Veľmi oceňujem aj brožúrku s radami pre nových majiteľov, ktorú sme dostali.",
        receivedAt: new Date(Date.now() - 19 * 86400_000),
        replyText: "Pán Molnár, ďakujeme! Výchova a zdravý štart šteniatka sú základom celoživotného zdravia. Radi vás opäť privítame.",
        repliedAt: new Date(Date.now() - 18 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "facebook",
        reviewerName: "Andrea Urbanová",
        rating: 5,
        reviewText: "Odporúča kliniku: Vďaka promptnej pohotovosti a nočnej infúznej terapii zachránili nášho yorkshira po otrave. Vďačnosť sa nedá ani opísať.",
        receivedAt: new Date(Date.now() - 26 * 86400_000),
        replyText: "Pani Urbanová, sme šťastní, že malý bojovník to zvládol a je v poriadku. Všetko dobré celej rodine!",
        repliedAt: new Date(Date.now() - 25 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "facebook",
        reviewerName: "Dominika Kučerová",
        rating: 5,
        reviewText: "Odporúča kliniku: Kardiologické sono vyšetrenie u nášho kavaliera Olivera. Pán doktor detailne vysvetlil štádium ochorenia mitrálnej chlopne a nastavil lieky s presným dávkovaním. Oceňujem odbornosť a empatiu.",
        receivedAt: new Date(Date.now() - 31 * 86400_000),
      },
      {
        practiceId,
        platform: "facebook",
        reviewerName: "Filip Valach",
        rating: 5,
        reviewText: "Odporúča kliniku: Prvá návšteva so šteniatkom border kólie. Absolvovali sme socializačnú návštevu bez ihiel, s množstvom maškŕt a hladkania. Šteniatko nemá zo stolíka ani ordinácie žiadny strach!",
        receivedAt: new Date(Date.now() - 37 * 86400_000),
        replyText: "Presne o tom Fear-Free prístup je! Šteniatko si kliniku zafixovalo s radosťou a pozitívnymi emóciami. Tešíme sa na ďalšie stretnutie!",
        repliedAt: new Date(Date.now() - 36 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "facebook",
        reviewerName: "Veronika Šimková",
        rating: 5,
        reviewText: "Odporúča kliniku: Diagnostika a liečba chronickej atopickej dermatitídy u francúzskeho buldočka. Po mesiacoch trápenia a škriabania na iných pracoviskách nám tu nasadili cielenú terapiu a pes konečne kľudne spí.",
        receivedAt: new Date(Date.now() - 43 * 86400_000),
      },
      {
        practiceId,
        platform: "facebook",
        reviewerName: "Patrik Olexa",
        rating: 5,
        reviewText: "Odporúča kliniku: Pred cestou do Chorvátska nám expresne vybavili medzinárodný Petpas, skontrolovali mikročip a aplikovali odčervenie s pečiatkou do pasu. Žiadne zdržanie, perfektný servis.",
        receivedAt: new Date(Date.now() - 49 * 86400_000),
        replyText: "Pán Olexa, ďakujeme! Prajeme šťastnú cestu a pohodovú dovolenku pri mori aj so psíkom.",
        repliedAt: new Date(Date.now() - 48 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        platform: "facebook",
        reviewerName: "Simona Poláková",
        rating: 5,
        reviewText: "Odporúča kliniku: Akútna operácia pyometry (hnisavý zápal maternice) u 11-ročnej sučky. Obrovský rešpekt pred celým tímom chirurgov a anestéziológov – zvládli to na jednotku napriek vysokému veku pacientky.",
        receivedAt: new Date(Date.now() - 55 * 86400_000),
      },
      {
        practiceId,
        platform: "facebook",
        reviewerName: "Martin Žiga",
        rating: 4,
        reviewText: "Odporúča kliniku: Rýchle ošetrenie hlbokej reznej rany na labke z lesa počas nedeľného popoludnia. Šitie v lokálnej anestézii, vyčistenie a ochranný obväz. Hojenie prebehlo bez akejkoľvek infekcie.",
        receivedAt: new Date(Date.now() - 60 * 86400_000),
      },
    ]);
    console.log("✓ Created 23 Google & Facebook reviews & replies");
  }

  // -------------------------------------------------------------------------
  // 10. Competitor Snapshots
  // -------------------------------------------------------------------------
  const existingSnapshots = await db.query.extMarketingCompetitorSnapshots.findMany({
    where: eq(extMarketingCompetitorSnapshots.practiceId, practiceId),
  });

  if (existingSnapshots.length === 0) {
    console.log("Seeding competitor market snapshots...");
    await db.insert(extMarketingCompetitorSnapshots).values([
      {
        practiceId,
        query: "Rimavská Sobota a okolie",
        region: "Rimavská Sobota",
        clinics: [
          {
            name: "Veterinárna ambulancia Sever",
            rating: 4.5,
            reviewCount: 94,
            services: ["Základná prevencia", "Vakcinácie", "Chirurgia"],
            pricingNote: "Štandardné regionálne ceny (vyšetrenie ~25-30€)",
            mapsUrl: "https://maps.google.com/?q=veterinar+Rimavska+Sobota",
            latestPosts: [
              { platform: "facebook", text: "Oznamujeme zmenu ordinačných hodín počas piatku.", publishedAt: "pred 4 dňami", engagement: 18 }
            ]
          },
          {
            name: "Veterinárna prax MVDr. Kovács",
            rating: 4.7,
            reviewCount: 142,
            services: ["Hospodárske zvieratá", "Malé zvieratá", "Výjazdy"],
            pricingNote: "Zameranie na výjazdovú prax a terén",
            mapsUrl: "https://maps.google.com/?q=veterinar+Kovacs+Rimavska+Sobota",
            latestPosts: [
              { platform: "facebook", text: "Jarné odčervovanie koní a oviec – prijímame objednávky na výjazdy.", publishedAt: "pred týždňom", engagement: 31 }
            ]
          },
          {
            name: "Zveroklinika Lučenec",
            rating: 4.6,
            reviewCount: 230,
            services: ["Hospitalizácia", "Digitálny RTG", "Pohotovosť"],
            pricingNote: "Vyššia cenová úroveň, regionálne centrum",
            mapsUrl: "https://maps.google.com/?q=zveroklinika+Lucenec",
            latestPosts: [
              { platform: "instagram", text: "Nový ultrazvukový prístroj v našej ambulancii.", publishedAt: "pred 2 dňami", engagement: 84 }
            ]
          }
        ],
        recommendations: [
          "Žiadne konkurenčné pracovisko v okrese neponúka online klientsku zónu s digitálnym archívom výsledkov – komunikujte túto výhodu ako hlavnú technologickú prednosť.",
          "Zamerajte sa na stomatologickú prevenciu a Fear-Free prístup – majitelia psov v regióne hľadajú ambulanciu s citlivým zaobchádzaním.",
          "Pravidelne publikujte edukačné príspevky na Facebooku – v regióne je silná chovateľská komunita, ktorá oceňuje praktické rady.",
        ],
        articles: [
          {
            title: "Prehľad dopytu po veterinárnych službách v Banskobystrickom kraji",
            source: "Veterinárny spravodajca SR",
            url: "https://www.kvlsr.sk",
            publishedAt: "Tento mesiac",
            summary: "Rastúci záujem chovateľov o preventívne balíčky a ultrasonografickú diagnostiku."
          }
        ],
        sources: ["Google Maps Grounding", "Register KVL SR"],
        model: "regional-benchmark-v1",
        isSample: true,
      }
    ]);
    console.log("✓ Created competitor snapshot");
  }

  // -------------------------------------------------------------------------
  // 11. Automation Rules
  // -------------------------------------------------------------------------
  const existingRules = await db.query.extMarketingAutomationRules.findMany({
    where: eq(extMarketingAutomationRules.practiceId, practiceId),
  });

  if (existingRules.length === 0) {
    console.log("Seeding automation rules...");
    await db.insert(extMarketingAutomationRules).values([
      {
        practiceId,
        key: "vaccination_recall",
        label: "Pripomienka exspirácie očkovania",
        description: "Automatické odoslanie SMS pripomienky 14 dní pred vypršaním platnosti vakcinácie.",
        triggerKey: "vaccine_due",
        timing: "14 dní vopred o 10:00",
        channel: "sms",
        legalBasis: "contract",
        enabled: true,
        sort: 1,
      },
      {
        practiceId,
        key: "postop_checkin_24h",
        label: "Pooperačná kontrola stavu (24 hodín)",
        description: "Dotaz na stav pacienta a hojenie rany nasledujúci deň po chirurgickom zákroku.",
        triggerKey: "surgery_completed",
        timing: "24 hodín po checkout",
        channel: "sms",
        legalBasis: "vital_interests",
        enabled: true,
        sort: 2,
      },
      {
        practiceId,
        key: "google_review_ask",
        label: "Žiadosť o Google recenziu po vyšetrení",
        description: "Zaslanie odkazu na Google Business profil 48 hodín po úspešnom ukončení ambulantnej návštevy.",
        triggerKey: "visit_closeout",
        timing: "48 hodín po návšteve",
        channel: "sms",
        legalBasis: "legitimate_interest",
        enabled: true,
        sort: 3,
      },
      {
        practiceId,
        key: "annual_wellness_invitation",
        label: "Pozvánka na ročnú preventívnu prehliadku",
        description: "E-mailová pozvánka s tipmi pre chovateľov po 11 mesiacoch od poslednej celkovej prehliadky.",
        triggerKey: "annual_checkup_due",
        timing: "330 dní od návštevy",
        channel: "email",
        legalBasis: "contract",
        enabled: true,
        sort: 4,
      },
    ]);
    console.log("✓ Created 4 automation rules");
  }

  // -------------------------------------------------------------------------
  // 11b. Autopilot Automation Rules (ext_automation_rules)
  // -------------------------------------------------------------------------
  const existingExtAutoRules = await db.query.extAutomationRules.findMany({
    where: eq(extAutomationRules.practiceId, practiceId),
  });

  if (existingExtAutoRules.length === 0) {
    console.log("Seeding ext_automation_rules...");
    await db.insert(extAutomationRules).values([
      {
        practiceId,
        ruleKey: "vaccination_recall",
        name: "Pripomienka exspirácie očkovania",
        description: "Automatické naplánovanie pripomienky po návšteve s očkovaním.",
        triggerEventType: "visit_completed",
        actionType: "send_communication",
        actionConfig: {
          channel: "sms",
          templateKey: "vaccination_reminder",
          careReminderDueDays: 330,
        },
        delayHours: 0,
        priority: 10,
        legalBasis: "contract",
        isActive: true,
        migratedFromKey: "vaccination_recall",
      },
      {
        practiceId,
        ruleKey: "postop_checkin_24h",
        name: "Pooperačná kontrola stavu (24 hodín)",
        description: "Dotaz na stav pacienta a hojenie rany nasledujúci deň po chirurgickom zákroku.",
        triggerEventType: "surgery_completed",
        actionType: "send_communication",
        actionConfig: {
          channel: "sms",
          templateKey: "postop_checkin",
        },
        delayHours: 24,
        priority: 20,
        legalBasis: "vital_interests",
        isActive: true,
        migratedFromKey: "postop_checkin_24h",
      },
      {
        practiceId,
        ruleKey: "google_review_ask",
        name: "Žiadosť o Google recenziu po vyšetrení",
        description: "Zaslanie odkazu na Google Business profil po ukončení návštevy.",
        triggerEventType: "visit_completed",
        actionType: "send_communication",
        actionConfig: {
          channel: "sms",
          templateKey: "review_request",
        },
        delayHours: 48,
        priority: 30,
        legalBasis: "legitimate_interest",
        isActive: true,
        migratedFromKey: "google_review_ask",
      },
    ]);
    console.log("✓ Created ext_automation_rules");
  }

  // -------------------------------------------------------------------------
  // 11c. Built-in Autopilot Journeys (ext_automation_journeys)
  // -------------------------------------------------------------------------
  const existingJourneys = await db.query.extAutomationJourneys.findMany({
    where: eq(extAutomationJourneys.practiceId, practiceId),
  });

  if (existingJourneys.length === 0) {
    console.log("Seeding 5 built-in autopilot journeys...");
    await db.insert(extAutomationJourneys).values([
      {
        practiceId,
        journeyKey: "welcome_new_client",
        // Untargeted: every new client is eligible.
        targetSegmentKeys: [],
        name: "Uvítací program pre nového klienta",
        description: "Multikanálová uvítacia sekvencia po prvej registrácii klienta na klinike.",
        triggerEventType: "client_created",
        isActive: true,
        version: 1,
        frequencyCapWindowDays: 30,
        frequencyCapMaxSteps: 4,
        allowReentry: false,
        createdBy: userId,
        steps: [
          {
            index: 0,
            kind: "send",
            label: "Uvítacia SMS s pohotovostným kontaktom",
            delayHours: 0,
            channel: "sms",
            templateKey: "welcome_sms",
            legalBasis: "contract",
          },
          {
            index: 1,
            kind: "send",
            label: "E-mail s klientskym portálom a sprievodcom starostlivosti",
            delayHours: 72,
            channel: "email",
            templateKey: "welcome_portal_guide",
            legalBasis: "contract",
          },
          {
            index: 2,
            kind: "task",
            label: "Telefonická kontrola spokojnosti personálom recepcie",
            delayHours: 336,
            taskKind: "welcome_call",
          },
        ],
      },
      {
        practiceId,
        journeyKey: "post_visit_followup",
        // Untargeted: every visited client is eligible.
        targetSegmentKeys: [],
        name: "Následná starostlivosť po ambulantnej návšteve",
        description: "Kontrola zdravotného stavu po vyšetrení a žiadosť o Google recenziu.",
        triggerEventType: "visit_completed",
        isActive: true,
        version: 1,
        frequencyCapWindowDays: 14,
        frequencyCapMaxSteps: 3,
        allowReentry: true,
        createdBy: userId,
        steps: [
          {
            index: 0,
            kind: "send",
            label: "SMS dotaz na stav pacienta 24h po návšteve",
            delayHours: 24,
            channel: "sms",
            templateKey: "post_visit_checkin",
            legalBasis: "vital_interests",
          },
          {
            index: 1,
            kind: "send",
            label: "Žiadosť o Google hodnotenie pri spokojnosti",
            delayHours: 72,
            channel: "sms",
            templateKey: "review_ask",
            legalBasis: "legitimate_interest",
          },
        ],
      },
      {
        practiceId,
        journeyKey: "vaccine_reminder_journey",
        // Only clients with overdue unvaccinated patients enroll.
        targetSegmentKeys: ["unvaccinated_overdue"],
        name: "Vakcinačná recall kampaň",
        description: "Viacstupňové pripomenutie blížiaceho sa a exspirovaného termínu očkovania.",
        triggerEventType: "vaccine_due",
        isActive: true,
        version: 1,
        frequencyCapWindowDays: 60,
        frequencyCapMaxSteps: 3,
        allowReentry: false,
        createdBy: userId,
        steps: [
          {
            index: 0,
            kind: "send",
            label: "SMS pripomienka: Vakcinácia exspiruje o 14 dní",
            delayHours: 0,
            channel: "sms",
            templateKey: "vaccination_recall",
            legalBasis: "contract",
          },
          {
            index: 1,
            kind: "send",
            label: "E-mailová pripomienka s možnosťou online objednania",
            delayHours: 264,
            channel: "email",
            templateKey: "vaccine_reminder_urgent",
            legalBasis: "contract",
          },
          {
            index: 2,
            kind: "send",
            label: "SMS upozornenie: Očkovanie je po termíne platnosti",
            delayHours: 504,
            channel: "sms",
            templateKey: "vaccine_overdue",
            legalBasis: "contract",
          },
        ],
      },
      {
        practiceId,
        journeyKey: "post_operative_care",
        // Only clients with a pet in post-op recovery enroll.
        targetSegmentKeys: ["post_op_recovery"],
        name: "Pooperačný protokol a starostlivosť o rany",
        description: "Intenzívne sledovanie rekonvalescencie pacienta po chirurgickom zákroku.",
        triggerEventType: "surgery_completed",
        isActive: true,
        version: 1,
        frequencyCapWindowDays: 14,
        frequencyCapMaxSteps: 4,
        allowReentry: true,
        createdBy: userId,
        steps: [
          {
            index: 0,
            kind: "send",
            label: "Kontrolná SMS 24 hodín po zákroku (bolesť, chuť do jedla)",
            delayHours: 24,
            channel: "sms",
            templateKey: "postop_checkin",
            legalBasis: "vital_interests",
          },
          {
            index: 1,
            kind: "send",
            label: "SMS kontrola hojenia operačnej rany a goliera",
            delayHours: 72,
            channel: "sms",
            templateKey: "postop_checkin_72h",
            legalBasis: "vital_interests",
          },
          {
            index: 2,
            kind: "send",
            label: "Pripomienka termínu na vybratie stehov",
            delayHours: 240,
            channel: "sms",
            templateKey: "postop_suture_removal",
            legalBasis: "vital_interests",
          },
        ],
      },
      {
        practiceId,
        journeyKey: "patient_reactivation",
        // Only churn-risk clients enroll.
        targetSegmentKeys: ["churn_risk"],
        name: "Reaktivácia neaktívneho pacienta (Ročný recall)",
        description: "Oslovenie majiteľov, ktorí nenavštívili kliniku viac ako 12 mesiacov.",
        triggerEventType: "inactive_recall",
        isActive: true,
        version: 1,
        frequencyCapWindowDays: 90,
        frequencyCapMaxSteps: 2,
        allowReentry: false,
        createdBy: userId,
        steps: [
          {
            index: 0,
            kind: "send",
            label: "Pozvánka e-mailom: Čas na ročnú preventívnu prehliadku",
            delayHours: 0,
            channel: "email",
            templateKey: "annual_wellness_invitation",
            legalBasis: "contract",
          },
          {
            index: 1,
            kind: "send",
            label: "SMS s odkazom na online rezerváciu termínu",
            delayHours: 336,
            channel: "sms",
            templateKey: "reactivation_sms",
            legalBasis: "contract",
          },
        ],
      },
    ]);
    console.log("✓ Created 5 built-in ext_automation_journeys");
  }

  // -------------------------------------------------------------------------
  // 11d. 12 Canonical CRM Segments (ext_crm_segments)
  //
  // MUST mirror CRM_SEGMENT_DEFINITIONS in
  // apps/web/lib/autopilot/segmentation-engine.ts exactly: the engine only
  // computes memberships for those keys, so any other system key would be
  // dead data (see the seed/engine drift guard test).
  // -------------------------------------------------------------------------
  const canonicalSegmentKeys = [
    "puppy_kitten",
    "senior_pet",
    "chronic_patient",
    "vip_clients",
    "churn_risk",
    "unvaccinated_overdue",
    "wellness_enrolled",
    "dental_attention",
    "post_op_recovery",
    "frequent_flyer",
    "weight_management",
    "lapsed_inactive",
  ];
  const liveSegments = await db.query.extCrmSegments.findMany({
    where: and(
      eq(extCrmSegments.practiceId, practiceId),
      isNull(extCrmSegments.deletedAt)
    ),
  });

  // Retire dead system rows from the pre-unification seed (set-A keys such as
  // new_clients / inactive_6mo): the engine never computes them.
  const deadKeys = liveSegments.filter(
    (s) => s.isSystem && !canonicalSegmentKeys.includes(s.segmentKey)
  );
  for (const dead of deadKeys) {
    await db
      .update(extCrmSegments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(extCrmSegments.id, dead.id));
  }
  if (deadKeys.length > 0) {
    console.log(
      `✓ Retired ${deadKeys.length} dead system segment(s): ${deadKeys.map((s) => s.segmentKey).join(", ")}`
    );
  }

  const liveKeys = new Set(
    liveSegments
      .filter((s) => !deadKeys.some((d) => d.id === s.id))
      .map((s) => s.segmentKey)
  );
  const missingKeys = canonicalSegmentKeys.filter((k) => !liveKeys.has(k));

  if (missingKeys.length > 0) {
    console.log("Seeding 12 canonical ext_crm_segments...");
    await db.insert(extCrmSegments).values([
      {
        practiceId,
        segmentKey: "puppy_kitten",
        name: "Šteniatka a mačiatka",
        description:
          "Klienti so psom alebo mačkou mladšou ako 1 rok. Vhodné pre puppy balíčky, prvé očkovanie a socializačné kampane.",
        isSystem: true,
        isActive: true,
        refreshStrategy: "scheduled" as const,
        conditionJson: { species: ["canine", "feline"], maxAgeYears: 1 },
        conditionSql:
          "patients.species IN ('canine','feline') AND patients.dob >= current_date - interval '1 year'",
        memberCountCache: 0,
        createdBy: userId,
      },
      {
        practiceId,
        segmentKey: "senior_pet",
        name: "Seniorski pacienti (7+ rokov)",
        description:
          "Klienti so psom alebo mačkou vo veku 7 a viac rokov. Geriatrické skríningy, senior panely a preventívne prehliadky.",
        isSystem: true,
        isActive: true,
        refreshStrategy: "scheduled" as const,
        conditionJson: { species: ["canine", "feline"], minAgeYears: 7 },
        conditionSql:
          "patients.species IN ('canine','feline') AND patients.dob <= current_date - interval '7 years'",
        memberCountCache: 0,
        createdBy: userId,
      },
      {
        practiceId,
        segmentKey: "chronic_patient",
        name: "Chronickí pacienti",
        description:
          "Pacienti s ≥2 receptami za posledných 6 mesiacov alebo ≥4 dokončenými návštevami za 12 mesiacov. Manažment dlhodobej liečby a kontroly.",
        isSystem: true,
        isActive: true,
        refreshStrategy: "scheduled" as const,
        conditionJson: { activeWithinDays: 365 },
        conditionSql: "(prescriptions_180d >= 2) OR (completed_visits_365d >= 4)",
        memberCountCache: 0,
        createdBy: userId,
      },
      {
        practiceId,
        segmentKey: "vip_clients",
        name: "VIP klienti",
        description:
          "Klienti s úhradami ≥ 1 500 € za posledných 12 mesiacov. Vernostný program, prioritné rezervácie a prémiová starostlivosť.",
        isSystem: true,
        isActive: true,
        refreshStrategy: "scheduled" as const,
        conditionJson: {},
        conditionSql: "sum(invoices.paid_amount last 365d) >= 1500 EUR",
        memberCountCache: 0,
        createdBy: userId,
      },
      {
        practiceId,
        segmentKey: "churn_risk",
        name: "Riziko odchodu",
        description:
          "Predtým aktívni klienti (≥2 návštevy) bez návštevy 6–12 mesiacov. Win-back kampane skôr, než prejdú k inej klinike.",
        isSystem: true,
        isActive: true,
        refreshStrategy: "scheduled" as const,
        conditionJson: { inactiveDays: 180 },
        conditionSql: "visit_count >= 2 AND last_visit BETWEEN 180d AND 365d ago",
        memberCountCache: 0,
        createdBy: userId,
      },
      {
        practiceId,
        segmentKey: "unvaccinated_overdue",
        name: "Po termíne očkovania",
        description:
          "Pacienti, ktorých posledný vakcinačný záznam má prekročený dátum ďalšej dávky. Pripomienky očkovania podľa zmluvného právneho základu.",
        isSystem: true,
        isActive: true,
        refreshStrategy: "scheduled" as const,
        conditionJson: {},
        conditionSql: "latest_vaccination.next_due_date < current_date",
        memberCountCache: 0,
        createdBy: userId,
      },
      {
        practiceId,
        segmentKey: "wellness_enrolled",
        name: "Členovia wellness programu",
        description:
          "Klienti s aktívnym wellness plánom. Preventívna starostlivosť, pripomienky čerpania benefítov a fakturácie.",
        isSystem: true,
        isActive: true,
        refreshStrategy: "scheduled" as const,
        conditionJson: {},
        conditionSql: "wellness_enrollments.status = 'active'",
        memberCountCache: 0,
        createdBy: userId,
      },
      {
        practiceId,
        segmentKey: "dental_attention",
        name: "Vyžadujú dentálnu starostlivosť",
        description:
          "Pacienti s patologickým nálezom v zubnej karte (kaz, zlomenina, vratkosť…) za posledných 18 mesiacov. Dentálne recall kampane.",
        isSystem: true,
        isActive: true,
        refreshStrategy: "scheduled" as const,
        conditionJson: {},
        conditionSql:
          "dental_charts.condition NOT IN ('HEALTHY','MISSING','CROWNED') within 18 months",
        memberCountCache: 0,
        createdBy: userId,
      },
      {
        practiceId,
        segmentKey: "post_op_recovery",
        name: "Po operačnej rekonvalescencii",
        description:
          "Pacienti so zaznamenanou operáciou (surgery_completed) za posledných 30 dní. Post-op kontroly 24 h / 3. deň / 10. deň.",
        isSystem: true,
        isActive: true,
        refreshStrategy: "scheduled" as const,
        conditionJson: {},
        conditionSql:
          "ext_automation_events.event_type = 'surgery_completed' within 30 days",
        memberCountCache: 0,
        createdBy: userId,
      },
      {
        practiceId,
        segmentKey: "frequent_flyer",
        name: "Častí návštevníci",
        description:
          "Klienti s ≥6 dokončenými návštevami za posledných 12 mesiacov. Loajalita, prednostné termíny a referenčné programy.",
        isSystem: true,
        isActive: true,
        refreshStrategy: "scheduled" as const,
        conditionJson: { activeWithinDays: 365 },
        conditionSql: "completed_visits_365d >= 6",
        memberCountCache: 0,
        createdBy: userId,
      },
      {
        practiceId,
        segmentKey: "weight_management",
        name: "Redukcia hmotnosti",
        description:
          "Pacienti so zvýšeným telesným skóre kondície (BCS ≥7/9 alebo ≥4/5) za posledný rok. Diétne programy a kontrolné váženia.",
        isSystem: true,
        isActive: true,
        refreshStrategy: "scheduled" as const,
        conditionJson: {},
        conditionSql: "vital_signs.body_condition_score >= threshold within 12 months",
        memberCountCache: 0,
        createdBy: userId,
      },
      {
        practiceId,
        segmentKey: "lapsed_inactive",
        name: "Neaktívni 12+ mesiacov",
        description:
          "Klienti bez dokončenej návštevy viac ako 12 mesiacov a bez budúcej rezervácie. Reaktivačné (recall) kampane.",
        isSystem: true,
        isActive: true,
        refreshStrategy: "scheduled" as const,
        conditionJson: { inactiveDays: 365 },
        conditionSql:
          "last_completed_visit < now() - interval '365 days' AND no future appointment",
        memberCountCache: 0,
        createdBy: userId,
      },
    ].filter((row) => missingKeys.includes(row.segmentKey)));
    console.log("✓ Created 12 canonical ext_crm_segments");
  }

  // -------------------------------------------------------------------------
  // 11e. Content Calendar Strategy Pillars (ext_content_pillars)
  // -------------------------------------------------------------------------
  const existingPillars = await db.query.extContentPillars.findMany({
    where: eq(extContentPillars.practiceId, practiceId),
  });

  if (existingPillars.length === 0) {
    console.log("Seeding 5 content strategy pillars...");
    await db.insert(extContentPillars).values([
      {
        practiceId,
        pillarKey: "preventive_care",
        title: "Preventívna medicína a vakcinácie",
        description: "Dôležitosť ročnej prevencie, kontroly chrupu, srdca a pravidelného očkovania psov a mačiek.",
        species: ["canine", "feline"],
        seasonMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        isActive: true,
        sortOrder: 1,
        voiceGuidance: "Odborný, preventívny a povzbudivý tón. Vyzdvihovať bezbolestnosť vyšetrenia.",
      },
      {
        practiceId,
        pillarKey: "dental_health",
        title: "Zubná hygiena a prevencia paradentózy",
        description: "Čistenie zubného kameňa ultrazvukom, domáca dentálna hygiena a nebezpečenstvo zápalov ďasien.",
        species: ["canine", "feline"],
        seasonMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        isActive: true,
        sortOrder: 2,
        voiceGuidance: "Vysvetliť vplyv neošetreného zubného kameňa na obličky a srdcovú chlopňu.",
      },
      {
        practiceId,
        pillarKey: "parasite_seasonal",
        title: "Sezónna ochrana: Kliešte, blchy a odčervenie",
        description: "Aktuálne riziká babeziózy, kliešťovej encefalitídy a správny výber antiparazitík na jar a jeseň.",
        species: ["canine", "feline"],
        seasonMonths: [3, 4, 5, 6, 7, 8, 9, 10],
        isActive: true,
        sortOrder: 3,
        voiceGuidance: "Varovať pred lokálnymi endemickými ohniskami kliešťov na juhu Slovenska a v okolí.",
      },
      {
        practiceId,
        pillarKey: "senior_wellness",
        title: "Starostlivosť o psích a mačacích seniorov",
        description: "Špecializovaný geriatrický screening, včasný záchyt zlyhávania obličiek a manažment osteoartrózy.",
        species: ["canine", "feline"],
        seasonMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        isActive: true,
        sortOrder: 4,
        voiceGuidance: "Hlboká empatia, porozumenie k starnutiu zvieratiek a praktické rady pre pohodlie doma.",
      },
      {
        practiceId,
        pillarKey: "clinic_stories",
        title: "Príbehy z ambulancie a úspešné vyliečenia",
        description: "Zaujímavé klinické prípady, úspešné operácie a poďakovanie obetavým majiteľom (so súhlasom GDPR).",
        species: ["canine", "feline"],
        seasonMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        isActive: true,
        sortOrder: 5,
        voiceGuidance: "Ľudský, inšpiratívny a autentický tón budujúci komunitu okolo kliniky.",
      },
    ]);
    console.log("✓ Created 5 ext_content_pillars");
  }

  // -------------------------------------------------------------------------
  // 11f. Connected Channel Accounts (ext_channel_accounts)
  // -------------------------------------------------------------------------
  const existingChannels = await db.query.extChannelAccounts.findMany({
    where: eq(extChannelAccounts.practiceId, practiceId),
  });

  if (existingChannels.length === 0) {
    console.log("Seeding connected channel accounts...");
    await db.insert(extChannelAccounts).values([
      {
        practiceId,
        provider: "google_business",
        externalAccountId: "gbp_loc_sykora_1",
        displayName: "Google Firemný Profil (MVDr. Martin Sýkora)",
        scopesGranted: ["https://www.googleapis.com/auth/business.manage"],
        status: "connected",
        connectedBy: userId,
        connectedAt: new Date(Date.now() - 30 * 86400_000),
      },
      {
        practiceId,
        provider: "facebook",
        externalAccountId: "fb_page_sykora_1",
        displayName: "Facebook Stránka: Veterinárna klinika MVDr. Martin Sýkora",
        scopesGranted: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"],
        status: "connected",
        connectedBy: userId,
        connectedAt: new Date(Date.now() - 25 * 86400_000),
      },
      {
        practiceId,
        provider: "instagram",
        externalAccountId: "ig_user_sykora_1",
        displayName: "Instagram @vetsykora",
        scopesGranted: ["instagram_basic", "instagram_content_publish"],
        status: "connected",
        connectedBy: userId,
        connectedAt: new Date(Date.now() - 20 * 86400_000),
        publishingQuotaRemaining: 25,
        publishingQuotaFetchedAt: new Date(),
      },
    ]);
    console.log("✓ Created 3 ext_channel_accounts");
  }

  // -------------------------------------------------------------------------
  // 11g. Content Calendar Briefs & KVL Approval Queue (ext_content_briefs)
  // -------------------------------------------------------------------------
  const existingBriefs = await db.query.extContentBriefs.findMany({
    where: eq(extContentBriefs.practiceId, practiceId),
  });

  if (existingBriefs.length === 0) {
    console.log("Seeding content calendar briefs...");
    const pillars = await db.query.extContentPillars.findMany({
      where: eq(extContentPillars.practiceId, practiceId),
    });
    const pillarMap = new Map(pillars.map((p) => [p.pillarKey, p.id]));
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrowStr = new Date(now.getTime() + 86400_000).toISOString().slice(0, 10);
    const inTwoDaysStr = new Date(now.getTime() + 2 * 86400_000).toISOString().slice(0, 10);
    const inFourDaysStr = new Date(now.getTime() + 4 * 86400_000).toISOString().slice(0, 10);

    await db.insert(extContentBriefs).values([
      {
        practiceId,
        pillarId: pillarMap.get("parasite_seasonal") || null,
        briefText: "Sezóna kliešťov vrcholí! Pripravili sme pre vás prehľad najúčinnejších antiparazitárnych prípravkov na mieru pre vášho psa alebo mačku. Chráňte svojich miláčikov včas.",
        targetChannels: ["google_business", "facebook", "instagram"],
        targetAudience: "Majitelia psov a mačiek v endemických oblastiach",
        clinicalClaims: [
          {
            claim: "Odporúčané dávkovanie systémových antiparazitík je každých 12 týždňov pre tablety alebo mesačne pre topické roztoky.",
            kind: "dosage",
            sourceRef: "SPC lieku & KVL SR smernica",
          },
          {
            claim: "Včasná a kontinuálna prevencia znižuje riziko prenosu babeziózy a kliešťovej encefalitídy o viac ako 95%.",
            kind: "prevention_efficacy",
            sourceRef: "ESCCAP klinické odporúčania",
          },
        ],
        status: "review",
        generatedBy: "autopilot_content_planner",
        generatedAt: new Date(Date.now() - 3600_000),
        confidence: 94,
        source: {
          scheduledDate: tomorrowStr,
          seasonHint: "spring_parasites",
        },
      },
      {
        practiceId,
        pillarId: pillarMap.get("dental_health") || null,
        briefText: "Až 80% psov nad 3 roky trpí ochorením ďasien. Neliečený zápal a zubný kameň môžu viesť k závažnému poškodeniu srdcových chlopní a obličiek. Objednajte sa na kontrolu chrupu.",
        targetChannels: ["facebook", "instagram"],
        targetAudience: "Chovatelia dospelých psov a mačiek",
        clinicalClaims: [
          {
            claim: "Neliečený zubný kameň a parodontitída spôsobujú bakteriálnu translokáciu a zvyšujú riziko endokarditídy a chronického zlyhávania obličiek.",
            kind: "diagnosis",
            sourceRef: "Veterinárna stomatologická asociácia",
            verdict: "approved",
            reviewerNote: "Klinicky presné a v súlade s etickým kódexom.",
          },
        ],
        status: "approved",
        generatedBy: "autopilot_content_planner",
        generatedAt: new Date(Date.now() - 24 * 3600_000),
        confidence: 96,
        reviewedBy: userId,
        reviewedAt: new Date(Date.now() - 12 * 3600_000),
        reviewNote: "Schválené MVDr. Martin Sýkora v súlade so Zákonom 39/2007 Z. z. a KVL SR.",
        source: {
          scheduledDate: todayStr,
        },
      },
      {
        practiceId,
        pillarId: pillarMap.get("preventive_care") || null,
        briefText: "Nezabudnite na pravidelnú ročnú preventívnu prehliadku a vakcináciu. Komplexná kontrola zdravotného stavu pomáha zachytiť skryté ochorenia v počiatočných štádiách.",
        targetChannels: ["google_business", "facebook"],
        targetAudience: "Všetci registrovaní klienti kliniky",
        clinicalClaims: [],
        status: "pending",
        generatedBy: "autopilot_content_planner",
        generatedAt: new Date(Date.now() - 48 * 3600_000),
        confidence: 91,
        source: {
          scheduledDate: inTwoDaysStr,
        },
      },
      {
        practiceId,
        pillarId: pillarMap.get("senior_wellness") || null,
        briefText: "Geriatrický screening: Špeciálna preventívna starostlivosť pre zvieracích seniorov. Zahŕňa vyšetrenie krvi, moču, krvného tlaku a posúdenie mobility.",
        targetChannels: ["facebook", "instagram"],
        targetAudience: "Majitelia psov nad 7 rokov a mačiek nad 8 rokov",
        clinicalClaims: [
          {
            claim: "Pravidelný screening u seniorov od 5 rokov veku odhalí subklinické zlyhávanie obličiek.",
            kind: "diagnosis",
            sourceRef: "Iris staging guidelines",
            verdict: "rejected",
            reviewerNote: "Vekové vymedzenie je nejednoznačné, upresniť plemennú predispozíciu.",
          },
        ],
        status: "rejected",
        generatedBy: "autopilot_content_planner",
        generatedAt: new Date(Date.now() - 72 * 3600_000),
        confidence: 88,
        reviewedBy: userId,
        reviewedAt: new Date(Date.now() - 36 * 3600_000),
        reviewNote: "Potrebné upraviť vekovú hranicu pre obrie plemená a doplniť SDMA biomarker.",
        source: {
          scheduledDate: inFourDaysStr,
        },
      },
      {
        practiceId,
        pillarId: pillarMap.get("clinic_stories") || null,
        briefText: "Úspešný príbeh z našej chirurgie: 4-ročná sučka Luna po zložitej ortopedickej operácii kolena opäť radostne behá. Ďakujeme majiteľom za vzornú pooperačnú rehabilitáciu.",
        targetChannels: ["facebook", "instagram"],
        targetAudience: "Komunita a priaznivci kliniky",
        clinicalClaims: [],
        status: "approved",
        generatedBy: "staff_dr_sykora",
        generatedAt: new Date(Date.now() - 96 * 3600_000),
        confidence: 99,
        reviewedBy: userId,
        reviewedAt: new Date(Date.now() - 80 * 3600_000),
        reviewNote: "GDPR súhlas overený na recepcii, príbeh schválený.",
        source: {
          scheduledDate: todayStr,
        },
      },
    ] as any);
    console.log("✓ Created 5 ext_content_briefs");
  }

  // -------------------------------------------------------------------------
  // 12. Operative Scripts
  // -------------------------------------------------------------------------
  const existingScripts = await db.query.extMarketingOperativeScripts.findMany({
    where: eq(extMarketingOperativeScripts.practiceId, practiceId),
  });

  if (existingScripts.length === 0) {
    console.log("Seeding operative scripts...");
    await db.insert(extMarketingOperativeScripts).values([
      {
        practiceId,
        category: "discharge_ask",
        title: "Prepustenie po zákroku: Odovzdanie pokynov majiteľovi",
        body: "Pán/Pani [Meno], zákrok u [Meno pacienta] prebehol bez komplikácií. Do SMS a e-mailu sme vám poslali odkaz na presné domáce inštrukcie aj s priamym kontaktom na našu pohotovosť v prípade akýchkoľvek otázok. Ochranný golier majte nasadený nepretržite. Zajtra vám pošleme kontrolnú správu.",
        note: "Odovzdať pri prepúšťaní na recepcii spolu s vytlačenou alebo digitálnou prepúšťacou správou.",
        sort: 1,
      },
      {
        practiceId,
        category: "review_ask",
        title: "Osobná žiadosť o Google recenziu pri spokojnom klientovi",
        body: "Veľmi sa tešíme, že [Meno pacienta] je v poriadku a vyšetrenie dobre zvládol! Ak ste boli s naším prístupom spokojní, veľmi by nám pomohlo krátke hodnotenie na Google Mapách – pomáha to aj ostatným chovateľom v okolí nájsť našu ambulanciu.",
        note: "Použiť len v prípade vysoko pozitívnej návštevy a spokojného klienta.",
        sort: 2,
      },
      {
        practiceId,
        category: "condolence",
        title: "Protokol súcitu (Sympathy Gate) – Komunikácia pri strate pacienta",
        body: "Vážený pán/pani [Meno], prijmite prosím našu najhlbšiu a úprimnú sústrasť v mene celého tímu kliniky MVDr. Martin Sýkora. Strata milovaného zvieracieho člena rodiny je nesmierne bolestivá. Ďakujeme vám za všetku lásku a obetavú starostlivosť, ktorú ste [Meno pacienta] počas celého života venovali.",
        note: "DÔLEŽITÉ: Pacient je v systéme okamžite označený ako DECEASED. Všetky marketingové správy a automatické recall pripomienky sú prísne zablokované.",
        sort: 3,
      },
      {
        practiceId,
        category: "crisis",
        title: "Krízová komunikácia: Náhle meškanie v čakárni",
        body: "Dobrý deň, ospravedlňujeme sa za nečakané zdržanie. Práve sme museli prijať akútneho pacienta v kritickom stave ohrozenia života. Ďakujeme vám za pochopenie a trpezlivosť, hneď po stabilizácii sa vám budeme plne venovať.",
        note: "Informovať čakáreň proaktívne najneskôr do 10 minút od vzniku meškania.",
        sort: 4,
      },
    ]);
    console.log("✓ Created 4 operative scripts");
  }

  // -------------------------------------------------------------------------
  // 13. Message Templates & Logs
  // -------------------------------------------------------------------------
  const existingTemplates = await db.query.extMarketingMessageTemplates.findMany({
    where: eq(extMarketingMessageTemplates.practiceId, practiceId),
  });

  if (existingTemplates.length === 0) {
    console.log("Seeding message templates & logs...");
    const [tpl1] = await db
      .insert(extMarketingMessageTemplates)
      .values({
        practiceId,
        key: "postop_checkin",
        language: "sk",
        channel: "sms",
        body: "Dobrý deň {{owner_name}}, ako sa cíti {{pet_name}} 24 hodín po zákroku? V prípade akýchkoľvek obáv nám zavolajte na +421905123456. MVDr. Martin Sýkora",
        legalBasis: "vital_interests",
        version: 1,
        isActive: true,
      })
      .returning();

    await db.insert(extMarketingMessageTemplates).values([
      {
        practiceId,
        key: "vaccination_recall",
        language: "sk",
        channel: "sms",
        body: "Dobrý deň, pripomíname termín ročného očkovania pre pacienta {{pet_name}}. Objednajte sa na https://vetsykora.sk alebo tel. +421905123456.",
        legalBasis: "contract",
        version: 1,
        isActive: true,
      },
      {
        practiceId,
        key: "review_ask",
        language: "sk",
        channel: "sms",
        body: "Dobrý deň, ďakujeme za návštevu s pacientom {{pet_name}}. Boli ste spokojní? Poteší nás krátke hodnotenie našej kliniky na Google: https://g.page/r/vetsykora/review",
        legalBasis: "legitimate_interest",
        version: 1,
        isActive: true,
      },
    ]);

    if (client1) {
      await db.insert(extMarketingMessageLogs).values([
        {
          practiceId,
          clientId: client1.id,
          patientId: pet1?.id,
          templateId: tpl1.id,
          templateKey: "postop_checkin",
          templateVersion: 1,
          legalBasis: "vital_interests",
          channel: "sms",
          language: "sk",
          bodyRendered: `Dobrý deň ${client1.firstName}, ako sa cíti ${pet1?.name || "Blesk"} 24 hodín po zákroku? V prípade akýchkoľvek obáv nám zavolajte na +421905123456. MVDr. Martin Sýkora`,
          triggerKey: "surgery_completed",
          status: "delivered",
          idempotencyKey: `sms:demo:${Date.now()}:1`,
          scheduledFor: new Date(Date.now() - 86400_000),
          sentAt: new Date(Date.now() - 86400_000 + 30_000),
        },
      ]);
    }
    console.log("✓ Created 3 message templates and sample delivery log");
  }

  console.log("\n✅ All marketing demo content successfully seeded for openvpm_ai!");
}

seedMarketingDemo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error seeding marketing demo:", err);
    process.exit(1);
  });
