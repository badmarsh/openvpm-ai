import { config } from "dotenv";
config({ path: "../../.env" });
import { db } from "./client";
import { eq, and, sql } from "drizzle-orm";
import {
  practices,
  users,
  clients,
  patients,
  wellnessEnrollments,
  extMarketingTvSlides,
  extMarketingHandouts,
  extMarketingContentBatches,
  extMarketingContentItems,
  extMarketingMessageTemplates,
  extMarketingMessageLogs,
  extSmsDeliveryLog,
  extMarketingAutomationRules,
  extMarketingPostopResponses,
  extMarketingStaffTasks,
  extMarketingOperativeScripts,
  extMarketingMediaConsents,
  extMarketingWellnessRedemptions,
} from "./schema/index";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function getMonday(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().slice(0, 10);
}

async function seedMarketingDemo() {
  console.log("🌱 Spúšťam seed marketingového modulu, TV čakárne a CRM pre openvpm-ai...\n");

  // 1. Nájdi alebo over primárnu kliniku
  let practice = await db.query.practices.findFirst({
    where: eq(practices.name, "Súkromná veterinárna klinika MVDr. Martin Sýkora"),
  });

  if (!practice) {
    practice = await db.query.practices.findFirst();
  }

  if (!practice) {
    console.log("⚠️ Žiadna klinika sa nenašla. Vytváram demo kliniku...");
    const [newP] = await db
      .insert(practices)
      .values({
        name: "Súkromná veterinárna klinika MVDr. Martin Sýkora",
        email: "info@vetsykora.sk",
        phone: "+421905123456",
        address: "Karpatská 12, 811 05 Bratislava",
        country: "SK",
        currency: "eur",
      })
      .returning();
    practice = newP;
  }

  const practiceId = practice.id;
  console.log(`✅ Používam kliniku: ${practice.name} (${practiceId})`);

  // 2. Nájdi používateľa (lekára/autora)
  let user = await db.query.users.findFirst({
    where: eq(users.practiceId, practiceId),
  });

  if (!user) {
    const [newUser] = await db
      .insert(users)
      .values({
        practiceId,
        name: "MVDr. Martin Sýkora",
        email: "sykora@vetsykora.sk",
        role: "veterinarian",
        passwordHash: "$2a$10$1Ui3ssO.fTXmUiyu4B7n0.EWb/M9fGHlZ5mjCXaq.Xqf1OdXwLs/K",
      })
      .returning();
    user = newUser;
  }
  const userId = user.id;

  // 3. Zabezpeč demo klientov a pacientov
  let existingClients = await db.query.clients.findMany({
    where: eq(clients.practiceId, practiceId),
    limit: 10,
  });

  if (existingClients.length < 5) {
    console.log("➕ Vytváram slovenských demo klientov a pacientov...");
    const newClientsData = [
      { firstName: "Jozef", lastName: "Kováč", phone: "+421901111222", email: "kovac@example.sk", pet: "Bono", species: "canine" as const, breed: "Nemecký ovčiak" },
      { firstName: "Mária", lastName: "Horváthová", phone: "+421902222333", email: "horvathova@example.sk", pet: "Luna", species: "feline" as const, breed: "Britská krátkosrstá" },
      { firstName: "Peter", lastName: "Varga", phone: "+421903333444", email: "varga@example.sk", pet: "Max", species: "canine" as const, breed: "Zlatý retriever", status: "deceased" },
      { firstName: "Zuzana", lastName: "Tóthová", phone: "+421904444555", email: "tothova@example.sk", pet: "Bella", species: "canine" as const, breed: "Jorkšírsky teriér" },
      { firstName: "Milan", lastName: "Baláž", phone: "+421905555666", email: "balaz@example.sk", pet: "Rony", species: "canine" as const, breed: "Bratislavský durič" },
      { firstName: "Katarína", lastName: "Molnárová", phone: "+421906666777", email: "molnarova@example.sk", pet: "Mia", species: "feline" as const, breed: "Európska mačka" },
    ];

    for (const c of newClientsData) {
      const [cl] = await db.insert(clients).values({
        practiceId,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        smsConsent: true,
      }).returning();

      await db.insert(patients).values({
        practiceId,
        clientId: cl.id,
        name: c.pet,
        species: c.species,
        breed: c.breed,
        status: (c.status as any) || "active",
        dob: "2020-05-10",
      });
    }

    existingClients = await db.query.clients.findMany({
      where: eq(clients.practiceId, practiceId),
      limit: 10,
    });
  }

  const existingPatients = await db.query.patients.findMany({
    where: eq(patients.practiceId, practiceId),
    limit: 10,
  });

  const client1 = existingClients[0];
  const client2 = existingClients[1] || existingClients[0];
  const client3 = existingClients[2] || existingClients[0];
  const client4 = existingClients[3] || existingClients[0];

  const patient1 = existingPatients[0];
  const patient2 = existingPatients[1] || existingPatients[0];
  const patient3 = existingPatients[2] || existingPatients[0];
  const patient4 = existingPatients[3] || existingPatients[0];

  // 4. Idempotentné vyčistenie marketingových demo dát pre čistý stav
  console.log("🧹 Čistím existujúce demo záznamy pre kliniku...");
  await db.delete(extMarketingWellnessRedemptions).where(eq(extMarketingWellnessRedemptions.practiceId, practiceId));
  await db.delete(extMarketingStaffTasks).where(eq(extMarketingStaffTasks.practiceId, practiceId));
  await db.delete(extMarketingPostopResponses).where(eq(extMarketingPostopResponses.practiceId, practiceId));
  await db.delete(extMarketingOperativeScripts).where(eq(extMarketingOperativeScripts.practiceId, practiceId));
  await db.delete(extMarketingAutomationRules).where(eq(extMarketingAutomationRules.practiceId, practiceId));
  await db.delete(extMarketingTvSlides).where(eq(extMarketingTvSlides.practiceId, practiceId));
  await db.delete(extMarketingHandouts).where(eq(extMarketingHandouts.practiceId, practiceId));
  await db.delete(extMarketingContentItems).where(eq(extMarketingContentItems.practiceId, practiceId));
  await db.delete(extMarketingContentBatches).where(eq(extMarketingContentBatches.practiceId, practiceId));
  await db.delete(extMarketingMessageLogs).where(eq(extMarketingMessageLogs.practiceId, practiceId));
  await db.delete(extMarketingMessageTemplates).where(eq(extMarketingMessageTemplates.practiceId, practiceId));
  await db.delete(extMarketingMediaConsents).where(eq(extMarketingMediaConsents.practiceId, practiceId));
  await db.delete(extSmsDeliveryLog).where(and(eq(extSmsDeliveryLog.practiceId, practiceId), eq(extSmsDeliveryLog.source, "marketing")));

  // ─────────────────────────────────────────────────────────────────────────────
  // A. TV Slajdy do čakárne (extMarketingTvSlides)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("📺 Vkladám TV slajdy do čakárne...");
  await db.insert(extMarketingTvSlides).values([
    {
      practiceId,
      createdBy: userId,
      title: "Kliešte a Babezióza – Sezónne varovanie",
      body: "Aktivita kliešťov na celom Slovensku stúpa. Chráňte svojho psíka či mačičku včas vhodnými veterinárnymi antiparazitikami (tablety, pipety, obojky). Zastavte sa na recepcii pre odborné odporúčanie.",
      durationSeconds: 15,
      sortOrder: 1,
      isActive: true,
    },
    {
      practiceId,
      createdBy: userId,
      title: "Zdravý úsmev & Dentálna hygiena",
      body: "Až 80 % psov a mačiek starších ako 3 roky trpí zubným kameňom a bolestivým zápalom ďasien. Ponúkame preventívne vyšetrenie chrupu a šetrné ultrazvukové čistenie zubov.",
      durationSeconds: 15,
      sortOrder: 2,
      isActive: true,
    },
    {
      practiceId,
      createdBy: userId,
      title: "Zákonné očkovanie proti besnote",
      body: "Podľa Zákona č. 39/2007 Z. z. o veterinárnej starostlivosti je každý držiteľ psa povinný zabezpečiť vakcináciu proti besnote od 3. mesiaca veku. Skontrolujte si očkovací preukaz!",
      durationSeconds: 12,
      sortOrder: 3,
      isActive: true,
    },
    {
      practiceId,
      createdBy: userId,
      title: "Preventívny seniorský skríning (7+ rokov)",
      body: "Psy a mačky starnú rýchlejšie než my. Včasný preventívny rozbor krvi a meranie tlaku pomáhajú odhaliť skryté ochorenia obličiek a srdca skôr, než sa prejavia príznaky.",
      durationSeconds: 15,
      sortOrder: 4,
      isActive: true,
    },
    {
      practiceId,
      createdBy: userId,
      title: "Označovanie zvierat mikročipom & CRSZ",
      body: "Zabezpečujeme bezbolestnú aplikáciu sterilných ISO mikročipov a okamžitý zápis do Centrálneho registra spoločenských zvierat (CRSZ) pre bezpečný návrat domov v prípade straty.",
      durationSeconds: 12,
      sortOrder: 5,
      isActive: true,
    },
    {
      practiceId,
      createdBy: userId,
      title: "Wellness Klub našej kliniky",
      body: "Pravidelné preventívne prehliadky, ročné vakcinácie, antiparazitiká a zvýhodnené ošetrenia v pohodlnom mesačnom balíčku starostlivosti. Opýtajte sa personálu na recepcii.",
      durationSeconds: 15,
      sortOrder: 6,
      isActive: true,
    },
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // B. Edukačné letáky (extMarketingHandouts)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("📄 Vkladám edukačné letáky (/h/[slug])...");
  await db.insert(extMarketingHandouts).values([
    {
      practiceId,
      createdBy: userId,
      slug: "klies-a-babezioza",
      title: "Kliešte a Babezióza: Ako bezpečne ochrániť vášho miláčika",
      body: `## Čo je babezióza a prečo je nebezpečná?

Babezióza je závažné, život ohrozujúce ochorenie spôsobené krvnými parazitmi rodu *Babesia*, ktoré na psy prenášajú kliešte (najmä pijak lužný – *Dermacentor reticulatus*). Tento parazit napadá a ničí červené krvinky zvieraťa.

### Hlavné príznaky babeziózy:
- **Náhle zvýšená telesná teplota** (často nad 40 °C)
- **Výrazná apatia**, slabosť a neochota k pohybu
- **Tmavý moč** (farba kofoly alebo silného čaju)
- **Bledé až žltkasté sliznice** (anémia a žltačka)
- Nechutenstvo a zvracanie

### Ako správne odstrániť prisatého kliešťa?
1. Použite špeciálnu pinzetu alebo háčik na kliešte.
2. Uchopte kliešťa čo najbližšie ku koži.
3. Kliešťa nepretáčajte a nekvapkajte naň olej ani lieh! Dusenie zvyšuje riziko vyvrhnutia obsahu do rany.
4. Pomalým, plynulým ťahom kolmo na kožu kliešťa vytiahnite a miesto vydezinfikujte.

### Prevencia
Základom ochrany je celoročná alebo sezónna aplikácia moderných veterinárnych ektoparazitík (ochranné pipety spot-on, antiparazitárne tablety s okamžitým účinkom alebo kvalitné obojky). Radi vám poradíme najvhodnejší prípravok podľa životného štýlu vášho psa.

—
*Len pre všeobecné informácie o zdraví zvierat. Vždy sa poraďte s naším veterinárnym tímom.*`,
      species: ["pes", "mačka"],
      tags: ["prevencia", "antiparazitika", "infekcie", "kliešte"],
      isPublic: true,
    },
    {
      practiceId,
      createdBy: userId,
      slug: "zubny-kamen-a-dasna",
      title: "Zubný kameň a zdravie ústnej dutiny u psov a mačiek",
      body: `## Prečo zápach z papuľky nie je normálny?

Mnoho majiteľov považuje zápach z tlamy psa či mačky za bežný jav. V skutočnosti je však takmer vždy varovným signálom pokročilého zápalu ďasien (gingivitídy) a hromadenia zubného kameňa.

### Riziká neliečeného zubného kameňa:
- **Chronická bolesť:** Zviera trpí pri prijímaní stravy, hoci sa snaží bolesť skrývať.
- **Uvoľňovanie zubov:** Hlboká paradentóza vedie k nezvratnej strate zubov.
- **Šírenie infekcie:** Baktérie zo zapálených ďasien sa krvným obehom dostávajú do tela a môžu vážne poškodiť srdcové chlopne, pečeň a obličky.

### Ako prebieha ošetrenie na našej klinike?
1. **Klinická prehliadka a predoperačný rozbor krvi** pre maximálnu bezpečnosť anestézie.
2. **Inhalačná anestézia s monitorovaním životných funkcií** (zabezpečené dýchacie cesty zabraňujú vdýchnutiu vody a baktérií).
3. **Ultrazvukové odstránenie zubného kameňa** nad aj pod líniou ďasien.
4. **Vyleštenie skloviny (polishing)**, ktoré spomaľuje opätovné usadzovanie povlaku.

—
*Len pre všeobecné informácie o zdraví zvierat. Vždy sa poraďte s naším veterinárnym tímom.*`,
      species: ["pes", "mačka"],
      tags: ["stomatologia", "chrup", "prevencia"],
      isPublic: true,
    },
    {
      practiceId,
      createdBy: userId,
      slug: "zakonne-ockovanie-besnota",
      title: "Zákonné očkovanie proti besnote na Slovensku (Zákon 39/2007 Z. z.)",
      body: `## Zákonné povinnosti držiteľa psa na Slovensku

Vakcinácia psov proti besnote je v Slovenskej republike **povinná zo zákona č. 39/2007 Z. z. o veterinárnej starostlivosti**. 

### Kľúčové fakty:
- Každý pes musí byť zaočkovaný proti besnote **od 3. mesiaca veku**.
- Zviera musí byť pred očkovaním **nezameniteľne označené mikročipom** a zaevidované v Centrálnom registri spoločenských zvierat (CRSZ).
- Držiteľ psa je povinný udržiavať zviera v trvalej imunite pravidelným preočkovaním podľa pokynov výrobcu použitej vakcíny (zvyčajne každé 1 až 3 roky).

### Cestovanie so zvieratami do zahraničia
Pri cestovaní v rámci Európskej únie musí mať zviera vystavený **Pas spoločenského zvieraťa (PetPass)** a platné očkovanie proti besnote (pri prvej vakcinácii vzniká platnosť až po 21 dňoch od aplikácie).

Náš tím zabezpečuje kompletnú evidenciu a overenie čipu pri každom očkovaní.

—
*Len pre všeobecné informácie o zdraví zvierat. Vždy sa poraďte s naším veterinárnym tímom.*`,
      species: ["pes", "fretka"],
      tags: ["ockovanie", "besnota", "legislativa", "crsz"],
      isPublic: true,
    },
    {
      practiceId,
      createdBy: userId,
      slug: "starostlivost-o-psa-seniora",
      title: "Starostlivosť o psa seniora: Ako mu zabezpečiť šťastnú starobu",
      body: `## Vstup do zlatej éry

Psi vstupujú do seniorského veku približne od 7. roku života (veľké a obrie plemená už od 5.–6. roku). Starnutie je prirodzený proces, no so správnou preventívnou starostlivosťou môže váš verný priateľ prežiť plnohodnotné roky bez zbytočnej bolesti.

### Čo si všímať u staršieho psa?
- Pomalšie vstávanie ráno alebo po odpočinku (častý prejav osteoartrózy).
- Zvýšený príjem vody a častejšie močenie (môže signalizovať ochorenie obličiek alebo cukrovku).
- Zmeny v správaní, dezorientácia alebo nepokoj v noci.
- Zhoršený zrak, sluch alebo zmeny na srsti.

### Odporúčané ročné vyšetrenia:
1. **Kompletný biochemický a hematologický rozbor krvi** na posúdenie funkcie obličiek a pečene.
2. **Vyšetrenie moču** vrátane stanovenia špecifickej hmotnosti a bielkovín.
3. **Meranie krvného tlaku** a auskultácia srdca.
4. **Ortopedické vyšetrenie** a nastavenie cielenej kĺbovej výživy či protizápalovej terapie.

—
*Len pre všeobecné informácie o zdraví zvierat. Vždy sa poraďte s naším veterinárnym tímom.*`,
      species: ["pes"],
      tags: ["seniori", "geriatria", "artroza", "prevencia"],
      isPublic: true,
    },
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // C. Dávky príspevkov a sociálne médiá (extMarketingContentBatches & Items)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("📅 Vkladám týždenné plány príspevkov...");
  const currentMonday = getMonday(new Date());
  const nextMonday = getMonday(daysFromNow(7));

  // Batch 1: Aktuálny schválený týždeň
  const [approvedBatch] = await db
    .insert(extMarketingContentBatches)
    .values({
      practiceId,
      weekStart: currentMonday,
      status: "approved",
    })
    .returning();

  // Batch 2: Budúci navrhovaný týždeň
  const [draftBatch] = await db
    .insert(extMarketingContentBatches)
    .values({
      practiceId,
      weekStart: nextMonday,
      status: "draft",
    })
    .returning();

  // Položky pre Batch 1 (Approved)
  await db.insert(extMarketingContentItems).values([
    {
      practiceId,
      batchId: approvedBatch.id,
      createdBy: userId,
      title: "Pozor na kliešte v tráve",
      body: "Jar je v plnom prúde a s ňou aj sezóna kliešťov. Babezióza je nebezpečná infekcia, no včasná ochrana šetrí život vášho psa. Zastavte sa u nás pre overené veterinárne antiparazitiká.\n\n#veterinar #zdraviezvierat #prevencia #pes #macka",
      channel: "instagram",
      status: "approved",
      scheduledFor: new Date(),
      validatorVerdict: "pass",
      approvedBy: userId,
      approvedAt: new Date(),
    },
    {
      practiceId,
      batchId: approvedBatch.id,
      createdBy: userId,
      title: "Zápach z papuľky nie je normálny",
      body: "Až 80 % psov starších ako 3 roky trpí zubným kameňom. Neliečený zápal ďasien môže poškodiť obličky aj srdce. Objednajte sa na kontrolu chrupu a ultrazvukové čistenie.\n\n#dentalnahygiena #zubnyskamen #veterinarnastomatologia",
      channel: "facebook",
      status: "approved",
      scheduledFor: daysFromNow(1),
      validatorVerdict: "pass",
      approvedBy: userId,
      approvedAt: new Date(),
    },
    {
      practiceId,
      batchId: approvedBatch.id,
      createdBy: userId,
      title: "Jarná revakcinácia SMS",
      body: "Vasej ambulancii zalezi na zdravi vasho milacika. Blizi sa termin celorocneho ockovania? Skontrolujte ockovaci preukaz a zarezervujte si termin online.",
      channel: "sms",
      status: "approved",
      scheduledFor: daysFromNow(2),
      validatorVerdict: "pass",
      approvedBy: userId,
      approvedAt: new Date(),
    },
    {
      practiceId,
      batchId: approvedBatch.id,
      createdBy: userId,
      title: "Seniorský profil zdravia",
      body: "Máte doma psíka alebo mačičku nad 7 rokov? Aj zvierací seniori si zaslúžia pokojnú starobu bez bolesti kĺbov a skrytých ochorení obličiek. Objednajte sa na preventívny seniorský rozbor krvi.\n\n#psisenior #kockasenior #veterinarnaprevencia",
      channel: "instagram",
      status: "approved",
      scheduledFor: daysFromNow(3),
      validatorVerdict: "pass",
      approvedBy: userId,
      approvedAt: new Date(),
    },
    {
      practiceId,
      batchId: approvedBatch.id,
      createdBy: userId,
      title: "Povinné čipovanie zvierat",
      body: "Podľa platnej legislatívy SR musí byť každý pes označený mikročipom. Je to najistejší spôsob, ako vám nálezca môže vrátiť zabehnuté zvieratko. Aplikácia je rýchla a bezpečná.",
      channel: "facebook",
      status: "approved",
      scheduledFor: daysFromNow(4),
      validatorVerdict: "pass",
      approvedBy: userId,
      approvedAt: new Date(),
    },
  ]);

  // Položky pre Batch 2 (Draft / Proposed)
  await db.insert(extMarketingContentItems).values([
    {
      practiceId,
      batchId: draftBatch.id,
      createdBy: userId,
      title: "Správna výživa po kastrácii",
      body: "Po kastrácii klesá metabolizmus zvieraťa až o 20 %. Poradíme vám, ako upraviť kŕmnu dávku, aby si váš chlpáč udržal ideálnu hmotnosť a zdravé kĺby.\n\n#vyzivazvierat #kastracia #zdravypes",
      channel: "instagram",
      status: "proposed",
      scheduledFor: daysFromNow(7),
      validatorVerdict: "pass",
    },
    {
      practiceId,
      batchId: draftBatch.id,
      createdBy: userId,
      title: "Letná príprava na cestovanie",
      body: "Plánujete dovolenku so psom v zahraničí? Skontrolujte si platnosť PetPassu a ošetrenia proti pásomniciam, ktoré vyžadujú niektoré krajiny.",
      channel: "facebook",
      status: "proposed",
      scheduledFor: daysFromNow(8),
      validatorVerdict: "pass",
    },
    {
      practiceId,
      batchId: draftBatch.id,
      createdBy: userId,
      title: "Prečo nekŕmiť psa čokoládou",
      body: "Teobromín v čokoláde je pre psy a mačky toxický. Majte maškrty pod kontrolou a pri podozrení na požitie okamžite kontaktujte veterinára.",
      channel: "instagram",
      status: "proposed",
      scheduledFor: daysFromNow(9),
      validatorVerdict: "pass",
    },
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // D. Šablóny správ (extMarketingMessageTemplates)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("✉️ Vkladám šablóny správ (SMS)...");
  const tplData = [
    {
      key: "appointment_reminder",
      body: "Pripomienka: Zajtra o {{appointment_time}} mate termin pre pacienta {{pet_name}} v nasej ambulancii {{clinic_name}}. Tesime sa na vas.",
      channel: "sms",
      legalBasis: "contract",
    },
    {
      key: "postop_check",
      body: "Dobry den, ako sa dnes citi {{pet_name}} po vcerejsom zakroku? Prosime o kratke info kliknutim sem: {{survey_url}} - {{clinic_name}}",
      channel: "sms",
      legalBasis: "contract",
    },
    {
      key: "review_request",
      body: "Dakujeme za navstevu s {{pet_name}}. Boli ste spokojni s nasou starostlivostou? Budeme vdacni za kratke hodnotenie: {{review_url}}",
      channel: "sms",
      legalBasis: "consent",
    },
    {
      key: "vaccine_due",
      body: "Dobry den, o 14 dni vyprsi platnost ockovania pre {{pet_name}}. Objednajte sa pohodlne na termin v ambulancii {{clinic_name}}.",
      channel: "sms",
      legalBasis: "contract",
    },
    {
      key: "booking_confirmation",
      body: "Potvrdenie rezervacie: Termin pre {{pet_name}} je naplanovany na {{appointment_time}}. {{clinic_name}}.",
      channel: "sms",
      legalBasis: "contract",
    },
    {
      key: "wellness_welcome",
      body: "Vitajte vo Wellness klube ambulancie {{clinic_name}}! Preventivna starostlivost pre {{pet_name}} je teraz plne zabezpecena.",
      channel: "sms",
      legalBasis: "contract",
    },
  ];

  for (const t of tplData) {
    await db.insert(extMarketingMessageTemplates).values({
      practiceId,
      key: t.key,
      language: "sk",
      channel: t.channel,
      body: t.body,
      legalBasis: t.legalBasis,
      version: 1,
      isActive: true,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // E. Pravidlá automatizácie (extMarketingAutomationRules)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("⚙️ Vkladám pravidlá automatizácií...");
  await db.insert(extMarketingAutomationRules).values([
    {
      practiceId,
      key: "postop_check",
      label: "Pooperačná kontrola stavu pacienta",
      description: "Automatická SMS s odkazom na dotazník 24 hodín po prepustení z chirurgického zákroku.",
      triggerKey: "surgery_completed",
      timing: "24h po zákroku",
      channel: "sms",
      legalBasis: "contract",
      enabled: true,
      sort: 1,
    },
    {
      practiceId,
      key: "review_request",
      label: "Žiadosť o Google recenziu",
      description: "Zaslanie SMS s prosbou o hodnotenie 24 hodín po úspešnej návšteve (okrem eutanázií).",
      triggerKey: "visit_completed",
      timing: "24h po návšteve",
      channel: "sms",
      legalBasis: "consent",
      enabled: true,
      sort: 2,
    },
    {
      practiceId,
      key: "vaccine_due",
      label: "Pripomienka zákonnej a infekčnej vakcinácie",
      description: "Notifikácia pre majiteľa 14 dní pred vypršaním platnosti očkovania v zázname.",
      triggerKey: "vaccine_due",
      timing: "14 dní vopred",
      channel: "sms",
      legalBasis: "contract",
      enabled: true,
      sort: 3,
    },
    {
      practiceId,
      key: "senior_screening",
      label: "Pozvánka na preventívny seniorský skríning",
      description: "Automatická výzva pre pacientov nad 7 rokov na preventívny rozbor krvi raz ročne.",
      triggerKey: "senior_screening",
      timing: "Ročne pre 7+ rokov",
      channel: "sms",
      legalBasis: "consent",
      enabled: true,
      sort: 4,
    },
    {
      practiceId,
      key: "wellness_welcome",
      label: "Uvítanie po registrácii do Wellness klubu",
      description: "Informačná správa s prehľadom benefitov a zliav po aktivácii predplatného.",
      triggerKey: "wellness_enrolled",
      timing: "1h po aktivácii",
      channel: "sms",
      legalBasis: "contract",
      enabled: true,
      sort: 5,
    },
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // F. História správ (extMarketingMessageLogs & extSmsDeliveryLog)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("📊 Vkladám históriu správ a SMS logy...");
  const logsData = [
    { client: client1, patient: patient1, key: "postop_check", status: "delivered", hoursAgo: 24, body: `Dobry den, ako sa dnes citi ${patient1.name} po vcerejsom zakroku? Prosime o kratke info cez formular.` },
    { client: client2, patient: patient2, key: "appointment_reminder", status: "delivered", hoursAgo: 18, body: `Pripomienka: Dnes o 14:30 mate termin pre pacienta ${patient2.name} v ambulancii.` },
    { client: client4, patient: patient4, key: "vaccine_due", status: "delivered", hoursAgo: 48, body: `Pripominame bliziacu sa revakcinaciu pre ${patient4.name}. Objednajte sa pohodlne online.` },
    { client: client1, patient: patient1, key: "review_request", status: "delivered", hoursAgo: 72, body: `Dakujeme za navstevu s ${patient1.name}. Budeme vdacni za kratke hodnotenie nasej ambulancie.` },
    { client: client2, patient: patient2, key: "postop_check", status: "sent", hoursAgo: 2, body: `Dobry den, ako sa dnes citi ${patient2.name} po osetreni? Prosime o spatnu vazbu.` },
    { client: client4, patient: patient4, key: "appointment_reminder", status: "sent", hoursAgo: 4, body: `Pripomienka: Zajtra o 10:00 mate termin pre pacienta ${patient4.name}.` },
    { client: client1, patient: patient1, key: "vaccine_due", status: "queued", hoursAgo: -2, body: `Dobry den, blizi sa ockovanie pre ${patient1.name}. Zarezervujte si termin.` },
    { client: client2, patient: patient2, key: "review_request", status: "queued", hoursAgo: -5, body: `Dakujeme za navstevu. Vase hodnotenie nam pomoze zlepsit sluzby.` },
    { client: client3, patient: patient3, key: "review_request", status: "blocked_sympathy", hoursAgo: 12, body: `[ZASTAVENÉ SYMPATHY GATES: Pacient ${patient3.name} je evidovaný ako zosnulý.]` },
    { client: client4, patient: patient4, key: "review_request", status: "suppressed_no_consent", hoursAgo: 20, body: `[ZASTAVENÉ: Majiteľ odvolal marketingový súhlas so zasielaním správ.]` },
  ];

  for (let i = 0; i < logsData.length; i++) {
    const item = logsData[i];
    const scheduled = new Date(Date.now() - item.hoursAgo * 3600 * 1000);
    const sent = item.status === "delivered" || item.status === "sent" ? scheduled : null;

    const [log] = await db.insert(extMarketingMessageLogs).values({
      practiceId,
      clientId: item.client.id,
      patientId: item.patient.id,
      templateKey: item.key,
      templateVersion: 1,
      legalBasis: item.key === "review_request" ? "consent" : "contract",
      channel: "sms",
      language: "sk",
      bodyRendered: item.body,
      triggerKey: item.key,
      status: item.status as any,
      idempotencyKey: `demo-msg-${practiceId.slice(0, 4)}-${i}-${Date.now()}`,
      scheduledFor: scheduled,
      sentAt: sent,
    }).returning();

    // Ak bola správa odoslaná, zapíš aj do auditného SMS rate-limit logu
    if (sent) {
      await db.insert(extSmsDeliveryLog).values({
        practiceId,
        clientId: item.client.id,
        source: "marketing",
        sourceRecordId: log.id,
        sentAt: sent,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // G. Pooperačné odpovede a eskalácie (extMarketingPostopResponses & StaffTasks)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("🩺 Vkladám pooperačné dotazníky a úlohy personálu...");
  await db.insert(extMarketingPostopResponses).values([
    {
      practiceId,
      clientId: client1.id,
      patientId: patient1.id,
      outcome: "good",
      note: "Ranka je pekne zahojená, Bono má skvelú chuť do jedla a už sa hrá.",
    },
    {
      practiceId,
      clientId: client2.id,
      patientId: patient2.id,
      outcome: "good",
      note: "Všetko v poriadku, Luna už pekne papá a nemá žiadne ťažkosti.",
    },
    {
      practiceId,
      clientId: client4.id,
      patientId: patient4.id,
      outcome: "fair",
      note: "Ešte je trochu ospalá a pomalšie chodí, ale pije dostatok vody.",
    },
    {
      practiceId,
      clientId: client4.id,
      patientId: patient4.id,
      outcome: "concern",
      note: "Pes si intenzívne líže ranu, okolo jedného stehu je mierne začervenanie.",
    },
  ]);

  // Úlohy personálu kliniky
  await db.insert(extMarketingStaffTasks).values([
    {
      practiceId,
      kind: "postop_escalation",
      title: "POOPERAČNÁ ESKALÁCIA: Bella – majiteľ hlási začervenanie a lízanie rany",
      detail: "Klientka Zuzana Tóthová nahlásila začervenanie operačnej rany. Potrebné telefonicky kontaktovať a overiť nasadenie ochranného goliera.",
      status: "open",
      clientId: client4.id,
    },
    {
      practiceId,
      kind: "condolence",
      title: "KONDOLENCIA: Odoslanie kondolenčnej karty rodine pacienta Max",
      detail: "Pacient Max eutanázovaný pred 2 dňami. Odoslať písomnú kondolenčnú kartu s podpisom ošetrujúceho lekára a pozastaviť všetky pripomienky.",
      status: "done",
      clientId: client3.id,
    },
    {
      practiceId,
      kind: "info",
      title: "GDPR: Skontrolovať písomný súhlas pre video šteniatok na sociálne siete",
      detail: "Na sociálne siete bolo navrhnuté video z vakcinácie vrhu. Overiť platnosť súhlasu pred publikovaním.",
      status: "open",
      clientId: client1.id,
    },
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // H. Skripty personálu a canned responses (extMarketingOperativeScripts)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("📞 Vkladám telefonické a komunikačné skripty pre recepciu...");
  await db.insert(extMarketingOperativeScripts).values([
    {
      practiceId,
      category: "discharge_ask",
      title: "Inštrukcie nalačno pred plánovanou operáciou",
      body: "Dobrý deň, pred zajtrajším zákrokom prosíme dodržať hladovku: krmivo odoberte večer o 20:00 (pes) / 22:00 (mačka). Čistú vodu môže mať k dispozícii do rána. Ráno zvieratko pred príchodom krátko vyvenčite bez kŕmenia.",
      note: "Použiť pri objednávaní na kastráciu, stomatológiu a mäkkotkanivovú chirurgiu.",
      sort: 1,
    },
    {
      practiceId,
      category: "crisis",
      title: "Vysvetlenie zákonnej povinnosti čipovania a CRSZ",
      body: "Označenie psa mikročipom je na Slovensku zákonná povinnosť podľa § 19 Zákona o veterinárnej starostlivosti. Aplikácia je rýchla ako bežné očkovanie a zviera je okamžite zaevidované do štátneho registra CRSZ.",
      note: "Štandardná odpoveď pre klientov odmietajúcich čipovanie.",
      sort: 2,
    },
    {
      practiceId,
      category: "crisis",
      title: "Pohotovostný príplatok a ošetrenie mimo hodín",
      body: "Dobrý deň, naša klinika mimo ordinačných hodín poskytuje pohotovostnú službu. K cene ošetrenia a liečiv sa účtuje pohotovostný príplatok za mimoriadne otvorenie ambulancie. Je stav zvieraťa akútny?",
      note: "Transparentné a empatické informovanie majiteľa pri nočných hovoroch.",
      sort: 3,
    },
    {
      practiceId,
      category: "review_ask",
      title: "Citlivé navrhnutie stomatologického vyšetrenia",
      body: "Všimli sme si mierny zápach z papuľky a začínajúci zubný kameň na stoličkách. Aby sme predišli bolesti a strate zubov, odporúčame naplánovať preventívne ultrazvukové vyčistenie v inhalačnej anestézii.",
      note: "Použiť lekárom alebo sestrou pri preventívnej prehliadke.",
      sort: 4,
    },
    {
      practiceId,
      category: "discharge_ask",
      title: "Postup majiteľa pri náleze prisatého kliešťa",
      body: "Kliešťa uchopte pinzetou čo najbližšie ku koži a plynulým ťahom vytiahnite bez točenia. Miesto vydezinfikujte. Nasledujúcich 7–14 dní sledujte teplotu, chuť do jedla a farbu moču. Pri apatii okamžite príďte.",
      note: "Telefonická inštruktáž pre majiteľa bez nutnosti okamžitej návštevy.",
      sort: 5,
    },
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // I. GDPR súhlasy s fotením a komunikáciou (extMarketingMediaConsents)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("🛡️ Vkladám GDPR súhlasy s fotením...");
  await db.insert(extMarketingMediaConsents).values([
    {
      practiceId,
      clientId: client1.id,
      patientId: patient1.id,
      scope: "photo_social",
      evidenceType: "signature",
      grantedAt: daysAgo(30),
      notes: "Podpísané digitálne na tablete pri prvej návšteve.",
    },
    {
      practiceId,
      clientId: client1.id,
      patientId: patient1.id,
      scope: "marketing_messages",
      evidenceType: "sms_confirm",
      grantedAt: daysAgo(30),
      notes: "Potvrdené cez SMS registračný odkaz.",
    },
    {
      practiceId,
      clientId: client2.id,
      patientId: patient2.id,
      scope: "photo_web",
      evidenceType: "signature",
      grantedAt: daysAgo(14),
      notes: "Súhlas s umiestnením fotky pacientky na web kliniky.",
    },
    {
      practiceId,
      clientId: client4.id,
      patientId: patient4.id,
      scope: "story",
      evidenceType: "signature",
      grantedAt: daysAgo(60),
      notes: "Súhlas s publikovaním príbehu o úspešnej operácii.",
    },
    {
      practiceId,
      clientId: client4.id,
      patientId: patient4.id,
      scope: "photo_social",
      evidenceType: "signature",
      grantedAt: daysAgo(90),
      revokedAt: daysAgo(3),
      notes: "Klientka požiadala o stiahnutie fotografií zo sociálnych sietí.",
    },
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // J. Čerpanie benefitov wellness (extMarketingWellnessRedemptions)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("🎁 Vkladám čerpanie wellness benefitov...");
  let enrollment = await db.query.wellnessEnrollments.findFirst({
    where: eq(wellnessEnrollments.practiceId, practiceId),
  });

  if (enrollment) {
    await db.insert(extMarketingWellnessRedemptions).values([
      {
        practiceId,
        enrollmentId: enrollment.id,
        benefitKey: "strihanie_pazurikov_free",
        redeemedAt: daysAgo(10),
        notes: "Uplatnené bezplatné skrátenie pazúrikov v rámci ročného balíčka.",
      },
      {
        practiceId,
        enrollmentId: enrollment.id,
        benefitKey: "vakcinacia_zlava_10",
        redeemedAt: daysAgo(45),
        notes: "Uplatnená zľava 10 % na každoročnú infekčnú vakcínu.",
      },
    ]);
  }

  console.log("\n✨ VŠETKY MARKETINGOVÉ DEMO DÁTA BOLI ÚSPEŠNE VLOŽENÉ!");
  console.log("────────────────────────────────────────────────────────────────");
  console.log("📺 TV Čakáreň:       6 edukačných slajdov (/marketing/tv & /tv/[clinicId])");
  console.log("📄 Letáky:           4 kompletné odborné letáky (/h/[slug])");
  console.log("📅 Plán príspevkov:  10 príspevkov v 2 týždenných dávkach (/marketing/plan)");
  console.log("✉️ Správy & SMS:     6 šablón a 10 záznamov v logu správ (/marketing/messages)");
  console.log("⚙️ Automatizácie:    5 aktívnych pravidiel (/marketing/automations)");
  console.log("🩺 Pooperačná péča:  4 odpovede a 3 úlohy personálu");
  console.log("📞 Skripty:          5 telefonických skriptov pre recepciu (/marketing/scripts)");
  console.log("🛡️ GDPR súhlasy:     5 evidovaných súhlasov (/marketing/consents)");
  console.log("────────────────────────────────────────────────────────────────\n");
}

seedMarketingDemo()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Chyba pri seedovaní marketingových demo dát:", err);
    process.exit(1);
  });
