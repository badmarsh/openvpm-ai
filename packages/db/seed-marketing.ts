import { config } from "dotenv";
config({ path: "../../.env" });
import { db } from "./client";
import { eq, and } from "drizzle-orm";
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
  extMarketingOperativeScripts,
  extMarketingMessageTemplates,
  extMarketingMessageLogs,
} from "./schema/index";

async function seedMarketingDemo() {
  console.log("Seeding rich demo marketing content for openvpm_ai...\n");

  // 1. Get primary practice
  const practice = await db.query.practices.findFirst({
    where: eq(practices.name, "Súkromná veterinárna klinika MVDr. Martin Sýkora"),
  });

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
  // 9. Google Reviews & Replies
  // -------------------------------------------------------------------------
  const existingReviews = await db.query.extMarketingReviews.findMany({
    where: eq(extMarketingReviews.practiceId, practiceId),
  });

  if (existingReviews.length === 0) {
    console.log("Seeding Google reviews...");
    await db.insert(extMarketingReviews).values([
      {
        practiceId,
        clientId: client1?.id,
        patientId: pet1?.id,
        reviewerName: "Zuzana Kováčová",
        rating: 5,
        reviewText: "Maximálna spokojnosť! Pán doktor Sýkora je obrovský odborník a má neskutočne milý prístup k zvieratám. Náš labrador Blesk sa k nemu do ambulancie dokonca teší. Zákrok prebehol hladko a oceňujem aj prehľadné pokyny po prepustení.",
        receivedAt: new Date(Date.now() - 5 * 86400_000),
        replyText: "Milá pani Kováčová, veľmi pekne ďakujeme za krásne slová a dôveru. Sme radi, že sa Bleskovi darí skvele a tešíme sa na ďalšiu preventívnu návštevu! S pozdravom, MVDr. Martin Sýkora",
        repliedAt: new Date(Date.now() - 4 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        clientId: client2?.id,
        patientId: pet2?.id,
        reviewerName: "Ing. Michal Baláž",
        rating: 5,
        reviewText: "Vynikajúca vybavenosť ambulancie (digitálny RTG aj laboratórium priamo na mieste). Rýchla diagnostika našej mačky počas víkendovej pohotovosti jej doslova zachránila život. Vrelo odporúčam každému chovateľovi.",
        receivedAt: new Date(Date.now() - 12 * 86400_000),
        replyText: "Pán Baláž, ďakujeme za hodnotenie. Včasná diagnostika a promptný prístup boli v tomto prípade kľúčové. Pozdravujeme pacientku a prajeme veľa zdravia!",
        repliedAt: new Date(Date.now() - 11 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        reviewerName: "Petra Nemcová",
        rating: 5,
        reviewText: "Krásne a čisté prostredie, Fear-Free prístup, ktorý naozaj funguje. Žiadny stres v čakárni, profesionálny personál. Objednanie online na presný čas funguje bez meškania.",
        receivedAt: new Date(Date.now() - 18 * 86400_000),
        replyText: "Ďakujeme, pani Nemcová. Pokojné a bezstresové prostredie pre zvieracích pacientov i majiteľov je našou prioritou.",
        repliedAt: new Date(Date.now() - 17 * 86400_000),
        repliedBy: userId,
      },
      {
        practiceId,
        reviewerName: "Tomáš Horváth",
        rating: 4,
        reviewText: "Veľmi dobrá starostlivosť a odborné rady. Jediné malé mínus bolo krátke čakanie kvôli akútnemu prípadu pred nami, ale personál sa nám ospravedlnil a vysvetlil situáciu.",
        receivedAt: new Date(Date.now() - 25 * 86400_000),
        replyText: "Pán Horváth, ďakujeme za pochopenie pri ošetrení náhleho život ohrozujúceho prípadu. Vážime si vašu trpezlivosť a spätnú väzbu.",
        repliedAt: new Date(Date.now() - 24 * 86400_000),
        repliedBy: userId,
      },
    ]);
    console.log("✓ Created 4 Google reviews & replies");
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
