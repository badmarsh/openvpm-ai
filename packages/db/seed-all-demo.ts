import { config } from "dotenv";
config({ path: "../../.env" });
import { db } from "./client";
import { eq } from "drizzle-orm";
import {
  practices,
  users,
  clients,
  patients,
  files,
  controlledSubstanceLog,
  vaccinationRecords,
  labResults,
  wellnessPlans,
  wellnessEnrollments,
  consentForms,
  aiImagingAnalyses,
  dischargeReports,
  voiceDictations,
  ekasaConfig,
  ekasaReceipts,
  extMarketingCompetitorSnapshots,
} from "./schema/index";

export async function seedAllDemoData() {
  console.log("🚀 Spúšťam kompletný seeding demo dát pre OpenVPM AI...\n");

  // 1. Practice & Users & Patients
  const practice = await db.query.practices.findFirst({
    where: eq(practices.name, "Súkromná veterinárna klinika MVDr. Martin Sýkora"),
  });

  if (!practice) {
    console.error("❌ Hlavná klinika nebola nájdená. Najprv spustite pnpm db:seed:sk.");
    return;
  }

  const practiceId = practice.id;
  const userList = await db.query.users.findMany({
    where: eq(users.practiceId, practiceId),
  });
  const adminUser = userList.find((u) => u.role === "admin") ?? userList[0];
  const vetUser = userList.find((u) => u.role === "veterinarian") ?? adminUser;

  if (!adminUser) {
    console.error("❌ Žiadny používateľ nebol nájdený pre túto kliniku.");
    return;
  }

  const patientList = await db.query.patients.findMany({
    where: eq(patients.practiceId, practiceId),
  });
  const clientList = await db.query.clients.findMany({
    where: eq(clients.practiceId, practiceId),
  });

  const blesk = patientList.find((p) => p.name === "Blesk") ?? patientList[0];
  const bella = patientList.find((p) => p.name === "Bella") ?? patientList[1] ?? blesk;
  const felix = patientList.find((p) => p.name === "Félix") ?? patientList[2] ?? blesk;
  const bruno = patientList.find((p) => p.name === "Bruno") ?? patientList[3] ?? blesk;

  const client1 = clientList[0];
  const client2 = clientList[1] ?? client1;

  console.log(`✓ Klinika: ${practice.name}`);
  console.log(`✓ Lekári: ${adminUser.name}, ${vetUser?.name}`);
  console.log(`✓ Pacienti: ${blesk?.name}, ${bella?.name}, ${felix?.name}, ${bruno?.name}\n`);

  const dAgo = (days: number) => new Date(Date.now() - days * 86400_000);

  // ---------------------------------------------------------------------------
  // 1. AI Vzorové Dáta (Analýza Snímkov, Prepúšťacie Správy, Hlasové Diktáty)
  // ---------------------------------------------------------------------------
  console.log("📸 [1/5] Vkladám vzorové AI analýzy snímkov, prepúšťacie správy a diktáty...");

  // Files for imaging
  const existingFiles = await db.query.files.findMany({
    where: eq(files.practiceId, practiceId),
  });

  let fileThoraxId: string;
  let fileAbdomenId: string;
  let fileBoneId: string;
  let fileSkinId: string;

  if (existingFiles.length < 4) {
    const insertedFiles = await db
      .insert(files)
      .values([
        {
          practiceId,
          uploadedBy: adminUser.id,
          fileName: "rtg_hrudnik_blesk_ll.jpg",
          fileKey: `imaging/${practiceId}/rtg_hrudnik_blesk_ll.jpg`,
          fileUrl: "/images/demo/rtg_thorax.jpg",
          mimeType: "image/jpeg",
          fileSizeBytes: 1428500,
          storageStatus: "available",
        },
        {
          practiceId,
          uploadedBy: adminUser.id,
          fileName: "rtg_abdomen_felix_vd.jpg",
          fileKey: `imaging/${practiceId}/rtg_abdomen_felix_vd.jpg`,
          fileUrl: "/images/demo/rtg_abdomen.jpg",
          mimeType: "image/jpeg",
          fileSizeBytes: 1890200,
          storageStatus: "available",
        },
        {
          practiceId,
          uploadedBy: adminUser.id,
          fileName: "rtg_tibia_bella_fraktura.jpg",
          fileKey: `imaging/${practiceId}/rtg_tibia_bella_fraktura.jpg`,
          fileUrl: "/images/demo/rtg_fracture.jpg",
          mimeType: "image/jpeg",
          fileSizeBytes: 1650300,
          storageStatus: "available",
        },
        {
          practiceId,
          uploadedBy: adminUser.id,
          fileName: "klinicka_foto_bruno_pyodermia.jpg",
          fileKey: `imaging/${practiceId}/klinicka_foto_bruno_pyodermia.jpg`,
          fileUrl: "/images/demo/skin_pyoderma.jpg",
          mimeType: "image/jpeg",
          fileSizeBytes: 954000,
          storageStatus: "available",
        },
      ])
      .returning();

    fileThoraxId = insertedFiles[0].id;
    fileAbdomenId = insertedFiles[1].id;
    fileBoneId = insertedFiles[2].id;
    fileSkinId = insertedFiles[3].id;
  } else {
    fileThoraxId = existingFiles[0].id;
    fileAbdomenId = existingFiles[1].id;
    fileBoneId = existingFiles[2].id;
    fileSkinId = existingFiles[3].id;
  }

  // AI Imaging Analyses
  const existingAnalyses = await db.query.aiImagingAnalyses.findMany({
    where: eq(aiImagingAnalyses.practiceId, practiceId),
  });

  if (existingAnalyses.length === 0 && blesk) {
    await db.insert(aiImagingAnalyses).values([
      {
        practiceId,
        patientId: blesk.id,
        fileId: fileThoraxId,
        requestedBy: adminUser.id,
        modelId: "gemini-3.8-flash",
        imageType: "xray",
        analysisType: "diagnosis",
        userPrompt: "Zameraj sa na kardiovertebrálny index (VHS), veľkosť srdcovej siluety a pľúcne polia.",
        result: `### Rádiologický Nález — RTG Thorax (Laterolaterálna projekcia)

**Pacient:** ${blesk.name} (Labrador retriever, 6 rokov)

#### 1. Kardiovaskulárny aparát:
- **Vertebrálny index srdca (VHS):** 11.4 stavcov (referenčná norma: 9.7 – 10.5).
- Prítomná generalizovaná kardiomegália s dorzálnym nadvihnutím trachey a zaoblením hrotu ľavej komory.
- Pľúcne vény sú mierne ektatické v pomere k príslušným artériám (> 1:1), čo poukazuje na miernu venóznu kongesciu.

#### 2. Pľúcny parenchým:
- V perihilovej a kaudodorzálnej pľúcnej oblasti je prítomný intersticiálno-bronchiálny vzor bez masívnej konsolidácie.
- Nález svedčí pre skoré štádium pľúcneho edému kardiogénneho pôvodu.

#### 3. Pleura a mediastínum:
- Bez známok fluidotoraxu alebo voľného plynu (pneumotorax). Bránica intaktná s fyziologickou konvexitou.

---

### Diagnostický Záver a Diferenciálna Diagnóza:
1. **Kongestívne zlyhávanie srdca (CHF, štádium C podľa ACVIM)** sekundárne k myxomatóznej degenerácii mitrálnej chlopne / kardiomyopatii.
2. Mierny pľúcny edém.

### Klinické Odporúčanie pre Terapiu:
- Furosemid 2 mg/kg i.v. / s.c. akútne, následne perorálne 1–2 mg/kg 2x denne.
- Pimobendan (Vetmedin) 0.25 mg/kg p.o. 2x denne nalačno (30 min pred kŕmením).
- Benazepril 0.5 mg/kg 1x denne.
- Odporúčaná echokardiografia (sono srdca) na definitívne potvrdenie regurgitačnej frakcie.`,
        status: "COMPLETED",
        completedAt: dAgo(2),
      },
      {
        practiceId,
        patientId: felix?.id ?? blesk.id,
        fileId: fileAbdomenId,
        requestedBy: vetUser?.id ?? adminUser.id,
        modelId: "gemini-3.8-flash",
        imageType: "xray",
        analysisType: "diagnosis",
        userPrompt: "Podozrenie na požitie cudzieho telesa a zvracanie, skontroluj gastrointestinálny trakt.",
        result: `### Rádiologický Nález — RTG Abdomen (Ventrodorzálna a laterálna projekcia)

**Pacient:** ${felix?.name ?? "Félix"} (Európska krátkosrstá mačka, 3 roky)

#### 1. Žalúdok a tenké črevo:
- V oblasti pylorickej časti žalúdka je zrejmý rádiokontrastný tieň nepravidelného tvaru s plynovou stopou (veľkosť cca 2.2 × 1.1 cm).
- V proxiálnom jejune prítomná segmentálna dilatácia črevných kľučiek plynom ("string-of-pearls" obraz) s výrazným plikovaním črevnej steny.
- Nález silne svedčí pre lineárne cudzie teleso (textilné vlákno/šnúrka) ukotvené v pylore.

#### 2. Ostatné orgány:
- Obličky normálnej veľkosti a symetrického tvaru.
- Močový mechúr primerane naplnený, bez litiázy.

---

### Záver:
- **Mechanický ileus tenkého čreva spôsobený lineárnym cudzím telesom.**
- Indikovaná urgentná exploratívna laparotómia a enterotómia / gastrotómia.`,
        status: "COMPLETED",
        completedAt: dAgo(5),
      },
      {
        practiceId,
        patientId: bella?.id ?? blesk.id,
        fileId: fileBoneId,
        requestedBy: adminUser.id,
        modelId: "gemini-3.8-flash",
        imageType: "xray",
        analysisType: "diagnosis",
        userPrompt: "Akútne nezaťažovanie ľavej zadnej končatiny po úraze v behu.",
        result: `### Rádiologický Nález — RTG Ľavá Tibia a Fibula (AP a ML projekcia)

**Pacient:** ${bella?.name ?? "Bella"} (Border kólia, 4 roky)

#### 1. Kostný skelet:
- V strednej až distálnej diafýze ľavej tibie je prítomná kompletná špirálová fraktúra s miernou laterálnou dislokáciou distálneho fragmentu o 3.5 mm.
- Súbežná šikmá fraktúra fibuly v rovnakej úrovni.
- Bez prítomnosti voľných medulárnych fragmentov (jednoduchá bikortikálna fraktúra).
- Okolité mäkké tkanivá vykazujú mierny zápalový opuch bez subkutánneho emfyzému.

---

### Záver:
- **Jednoduchá špirálová diafyzárna fraktúra tibie a fibuly (AO/ASIF 42-A1).**
- Odporúčaná interná osteosyntéza kompresnou LCP dlahou 3.5 mm a cerklážou. Prognóza hojenia výborná.`,
        status: "COMPLETED",
        completedAt: dAgo(8),
      },
    ]);
    console.log("  ✓ Vytvorené 3 vzorové rádiologické analýzy snímkov.");
  }

  // Discharge Reports
  const existingDischarges = await db.query.dischargeReports.findMany({
    where: eq(dischargeReports.practiceId, practiceId),
  });

  if (existingDischarges.length === 0 && blesk) {
    await db.insert(dischargeReports).values([
      {
        practiceId,
        patientId: blesk.id,
        createdBy: adminUser.id,
        petName: blesk.name,
        species: blesk.species ?? "Pes, Labrador retriever",
        diagnosis: "Stav po úspešnej operácii akútnej torzie a dilatácie žalúdka (GDV), gastropexia.",
        treatment: "Laparotómia, dekompresia a repozícia žalúdka, incízna gastropexia o pravú brušnú stenu. Pooperačná analgézia a infúzia.",
        followUp: "Kŕmenie po malých dávkach 4-5x denne (vlhká gastrointestinálna strava). Prísny kľudový režim 14 dní bez behania. Kontrola rany a stehov o 10 dní.",
        reportText: `## Záverečná prepúšťacia správa pre majiteľa

Vážená pani Kováčová,

náš tím úspešne vykonal operačný zákrok a stabilizoval Vášho psíka **Bleska**. Zákrok prebehol bez komplikácií a pacient je v stabilizovanom stave pripravený na domácu rekonvalescenciu.

### 📋 Zhrnutie diagnózy a zákroku
- **Diagnóza:** Akútna torzia žalúdka (GDV) vyriešená včas bez nekrózy steny žalúdka.
- **Vykonaný zákrok:** Chirurgická repozícia žalúdka a preventívna gastropexia (prišitie žalúdka k brušnej stene), ktorá trvalo zabráni opätovnej torzii v budúcnosti.

### 💊 Predpísané domáce lieky
1. **Meloxicam (Rheumocam perorálna suspenzia):** 1x denne 1.5 ml s malým kúskom krmiva po dobu 4 dní.
2. **Omeprazol 20 mg:** 1 tableta ráno nalačno po dobu 7 dní.
3. **Probiotická pasta (Canikur Pro):** 2x denne 4 ml do krmiva na podporu črevnej mikroflóry.

### 🥣 Diétny a domáci režim
- Prvé 4 dni podávajte výhradne veterinárnu diétu *Gastrointestinal* rozdelenú do **4–5 malých porcií denne**.
- Zabezpečte stály prístup k čerstvej vlažnej vode, avšak nedovoľte psovi naraz vypiť veľké množstvo vody.
- **Kľudový režim:** Venčenie výlučne na krátkom vodítku len na vykonanie potreby. Zákaz behania, skákania a schodov.

### 🩺 Kontrola
- Kontrola operačnej rany a vybratie stehov je naplánované na **${new Date(Date.now() + 10 * 86400_000).toLocaleDateString("sk-SK")}**.
- V prípade nechutenstva, apatie alebo zvracania nás kontaktujte ihneď na pohotovostnom čísle kliniky.`,
        language: "sk",
        status: "finalized",
      },
      {
        practiceId,
        patientId: bella?.id ?? blesk.id,
        createdBy: vetUser?.id ?? adminUser.id,
        petName: bella?.name ?? "Bella",
        species: bella?.species ?? "Pes, Border kólia",
        diagnosis: "Ťažká gingivitída a periodontálne ochorenie III. stupňa, fraktúra premolára P4 vľavo hore.",
        treatment: "Ultrazvukové odstránenie zubného kameňa, subgingiválny kuretáž, leštenie zubov a chirurgická extrakcia zuba P4.",
        followUp: "Mäkká vlhká strava po dobu 7 dní, zákaz tvrdých hračiek a kostí. Kontrola hojenia sliznice o 7 dní.",
        reportText: `## Záverečná prepúšťacia správa po stomatologickom zákroku

Milá majiteľka,

dnes sme u **Belly** úspešne dokončili kompletné ošetrenie ústnej dutiny v inhalačnej anestézii. Zubný kameň a ložiská zápalu boli bezpečne odstránené.

### 🦷 Vykonané úkony
- Odstránenie masívneho zubného kameňa ultrazvukom a jemné leštenie skloviny (polishing).
- Extrakcia zlomeného zuba P4, ktorý spôsoboval bolesť a chronický zápal ďasna. Rana po vytrhnutí zuba bola zašitá vstrebateľnými stehmi, ktoré netreba vyberať.

### 💊 Domáca liečba
- **Meloxicam suspenzia:** 1x denne po dobu 5 dní proti bolesti a opuchu.
- **Stomodine dentálny gél:** Aplikovať na ďasná 2x denne po jedle od zajtrajšieho dňa.

### 🐾 Odporúčania
- Podávajte len mäkkú varenú stravu alebo namočené granule izbovej teploty.
- Kontrola sliznice ďasna o týždeň.`,
        language: "sk",
        status: "finalized",
      },
    ]);
    console.log("  ✓ Vytvorené 2 vzorové prepúšťacie správy.");
  }

  // Voice Dictations
  const existingVoices = await db.query.voiceDictations.findMany({
    where: eq(voiceDictations.practiceId, practiceId),
  });

  if (existingVoices.length === 0 && blesk) {
    await db.insert(voiceDictations).values([
      {
        practiceId,
        patientId: blesk.id,
        dictatedBy: adminUser.id,
        modelId: "gemini-3.8-flash",
        audioDurationSeconds: "45",
        rawTranscript: "Diktát vyšetrenia pes Blesk labrador 6 rokov. Majiteľ udáva zhoršené dýchanie pri námahe a nočný kašeľ. Teplota 38.4 stupňa, sliznice ružové, auskultačne systolický šelest na mitrálnej chlopni stupňa 3 zo 6. Na pľúcach vezikulárne dýchanie so zachytenými vlhkými vrzotmi kaudodorzálne. Odporúčam RTG hrudníka a nasadenie Vetmedinu a Furosemidu.",
        language: "sk",
        subjective: "Majiteľ pozoruje posledné 2 týždne zhoršenú toleranciu fyzickej záťaže, rýchle zadýchavanie a záchvaty suchého kašľa prevažne v noci v kľude.",
        objective: "Hmotnosť: 34.2 kg, TT: 38.4 °C, CRT: do 2 sekúnd. Auskultačne: srdcový šelest holosystolický 3/6 na hrote srdca vľavo. Pulz symetrický, dobre hmatateľný. Pľúca: obojstranne zosilnené vezikulárne dýchanie s diskrétnymi vlhkými chrapotmi.",
        assessment: "Suspektné myxomatózne ochorenie mitrálnej chlopne (MMVD) s kardiomegáliou a začínajúcou pľúcnou kongesciou (štádium B2/C).",
        plan: "1. RTG vyšetrenie hrudníka (laterálna a VD projekcia).\n2. Začať terapiu Pimobendan 0.25 mg/kg 2x denne a Furosemid 1.5 mg/kg 2x denne.\n3. Kontrola dychovej frekvencie v spánku (SRR pod 30 dychov/minútu). Kontrola o 5 dní.",
        status: "COMPLETED",
        transcribedAt: dAgo(2),
      },
      {
        practiceId,
        patientId: felix?.id ?? blesk.id,
        dictatedBy: vetUser?.id ?? adminUser.id,
        modelId: "gemini-3.8-flash",
        audioDurationSeconds: "38",
        rawTranscript: "Kocúr Félix preventívna geriatrická prehliadka. Majiteľka hlási zvýšený smäd a častejšie močenie posledný mesiac, strata váhy pol kila. Auskultácia v norme, zuby mierny kameň. Palpačne obličky menšie, pevnejšie, nebolestivé. Odber krvi na kompletnú biochémiu a SDMA.",
        language: "sk",
        subjective: "Majiteľka pozoruje polyúriu a polydipsiu (PU/PD) trvajúcu cca 4 týždne, postupné chudnutie (úbytok 500 g za 3 mesiace) pri zachovanom apetíte.",
        objective: "Hmotnosť: 3.8 kg (pôvodne 4.3 kg). Sliznice ružové, hydratácia mierne znížená (kožná riasa cca 1.5 s). Palpácia: obličky menšieho rozmeru s mierne hrboľatým povrchom, indolentné. Chrup s miernym zubným kameňom na stoličkách.",
        assessment: "Podozrenie na chronické ochorenie obličiek (CKD) vs. hypertyreóza vs. diabetes mellitus.",
        plan: "1. Odber venóznej krvi: biochemický profil (Urea, Krea, Fosfor, SDMA), elektrolyty a T4.\n2. Vyšetrenie ranného moču (hustota refraktometrom, pomer UPC).\n3. Prechod na obličkovú diétu (Renal) po potvrdení výsledkov.",
        status: "COMPLETED",
        transcribedAt: dAgo(6),
      },
    ]);
    console.log("  ✓ Vytvorené 2 vzorové hlasové diktáty a SOAP záznamy.");
  }

  // ---------------------------------------------------------------------------
  // 2. Kniha omamných látok (OPLaP) & Očkovací register (Kniha besnoty)
  // ---------------------------------------------------------------------------
  console.log("💉 [2/5] Vkladám záznamy do Knihy omamných látok (OPLaP) a očkovaní...");

  const existingLogs = await db.query.controlledSubstanceLog.findMany({
    where: eq(controlledSubstanceLog.practiceId, practiceId),
  });

  if (existingLogs.length === 0 && blesk) {
    await db.insert(controlledSubstanceLog).values([
      {
        practiceId,
        drugName: "Ketamín 100 mg/ml (Calypsol)",
        deaSchedule: "OPLaP-II",
        action: "received",
        quantity: "50.000",
        unit: "ml",
        performedBy: adminUser.id,
        lotNumber: "KET-2026-08",
        notes: "Príjem balenia z centrálneho skladu Pharmacopola s.r.o., faktúra FV-2026-149.",
        performedAt: dAgo(15),
      },
      {
        practiceId,
        drugName: "Ketamín 100 mg/ml (Calypsol)",
        deaSchedule: "OPLaP-II",
        action: "administered",
        quantity: "0.600",
        unit: "ml",
        patientId: blesk.id,
        performedBy: adminUser.id,
        witnessedBy: vetUser?.id ?? adminUser.id,
        lotNumber: "KET-2026-08",
        notes: "Úvod do celkovej anestézie pri akútnom chirurgickom zákroku (GDV).",
        performedAt: dAgo(2),
      },
      {
        practiceId,
        drugName: "Ketamín 100 mg/ml (Calypsol)",
        deaSchedule: "OPLaP-II",
        action: "administered",
        quantity: "0.350",
        unit: "ml",
        patientId: bella?.id ?? blesk.id,
        performedBy: vetUser?.id ?? adminUser.id,
        witnessedBy: adminUser.id,
        lotNumber: "KET-2026-08",
        notes: "Sedácia a anestézia pri stomatologickej extrakcii zuba.",
        performedAt: dAgo(5),
      },
      {
        practiceId,
        drugName: "Butorfanol 10 mg/ml (Torbugesic)",
        deaSchedule: "OPLaP-III",
        action: "received",
        quantity: "10.000",
        unit: "ml",
        performedBy: adminUser.id,
        lotNumber: "BUT-9912-SK",
        notes: "Dodávka od licencovaného distribútora Cymedica SK.",
        performedAt: dAgo(20),
      },
      {
        practiceId,
        drugName: "Butorfanol 10 mg/ml (Torbugesic)",
        deaSchedule: "OPLaP-III",
        action: "administered",
        quantity: "0.300",
        unit: "ml",
        patientId: blesk.id,
        performedBy: adminUser.id,
        witnessedBy: vetUser?.id ?? adminUser.id,
        lotNumber: "BUT-9912-SK",
        notes: "Pre-medikácia a viscerálna analgézia.",
        performedAt: dAgo(2),
      },
      {
        practiceId,
        drugName: "Butorfanol 10 mg/ml (Torbugesic)",
        deaSchedule: "OPLaP-III",
        action: "wasted",
        quantity: "0.050",
        unit: "ml",
        performedBy: adminUser.id,
        witnessedBy: vetUser?.id ?? adminUser.id,
        lotNumber: "BUT-9912-SK",
        notes: "Znehodnotenie zvyšku liečiva v spojovacej hadičke, zaznamenané v denníku znehodnotenia.",
        performedAt: dAgo(2),
      },
      {
        practiceId,
        drugName: "Diazepam 10 mg/2 ml (Apaurin)",
        deaSchedule: "OPLaP-IV",
        action: "administered",
        quantity: "1.000",
        unit: "ml",
        patientId: bruno?.id ?? blesk.id,
        performedBy: adminUser.id,
        witnessedBy: vetUser?.id ?? adminUser.id,
        lotNumber: "DIA-2025-04",
        notes: "Akútne prerušenie epileptiformného záchvatu u pacienta.",
        performedAt: dAgo(9),
      },
    ]);
    console.log("  ✓ Vytvorených 7 zákonných záznamov v Knihe omamných látok.");
  }

  // Vaccination Records (Kniha besnoty)
  const existingVax = await db.query.vaccinationRecords.findMany({
    where: eq(vaccinationRecords.practiceId, practiceId),
  });

  if (existingVax.length === 0 && blesk) {
    await db.insert(vaccinationRecords).values([
      {
        practiceId,
        patientId: blesk.id,
        vaccineName: "Nobivac DHPPi + L4 (Kombinovaná vakcína)",
        productName: "Nobivac DHPPi / Lepto",
        lotNumber: "B883A01",
        manufacturer: "MSD Animal Health",
        doseType: "booster",
        licensedDurationMonths: 12,
        administeredBy: adminUser.id,
        supervisingVeterinarianId: adminUser.id,
        administeredAt: dAgo(60),
        nextDueDate: new Date(Date.now() + 305 * 86400_000).toISOString().split("T")[0],
      },
      {
        practiceId,
        patientId: blesk.id,
        vaccineName: "Rabisin (Besnota)",
        productName: "Rabisin s.c.",
        lotNumber: "RAB-77402",
        manufacturer: "Boehringer Ingelheim",
        doseType: "booster",
        licensedDurationMonths: 36,
        rabiesTagNumber: "SK-BA-2026-08142",
        administeredBy: adminUser.id,
        supervisingVeterinarianId: adminUser.id,
        administeredAt: dAgo(60),
        nextDueDate: new Date(Date.now() + 1035 * 86400_000).toISOString().split("T")[0],
      },
      {
        practiceId,
        patientId: bella?.id ?? blesk.id,
        vaccineName: "Versican Plus DHPPi/L4R (Vrátane besnoty)",
        productName: "Versican Plus",
        lotNumber: "VER-11209B",
        manufacturer: "Zoetis",
        doseType: "booster",
        licensedDurationMonths: 12,
        rabiesTagNumber: "SK-BA-2026-09255",
        administeredBy: vetUser?.id ?? adminUser.id,
        supervisingVeterinarianId: adminUser.id,
        administeredAt: dAgo(90),
        nextDueDate: new Date(Date.now() + 275 * 86400_000).toISOString().split("T")[0],
      },
      {
        practiceId,
        patientId: felix?.id ?? blesk.id,
        vaccineName: "Purevax RCP (Mačacia trojkombinácia)",
        productName: "Purevax RCP",
        lotNumber: "PUR-4410",
        manufacturer: "Boehringer Ingelheim",
        doseType: "booster",
        licensedDurationMonths: 12,
        administeredBy: vetUser?.id ?? adminUser.id,
        supervisingVeterinarianId: adminUser.id,
        administeredAt: dAgo(120),
        nextDueDate: new Date(Date.now() + 245 * 86400_000).toISOString().split("T")[0],
      },
    ]);
    console.log("  ✓ Vytvorené 4 záznamy o očkovaní s číslami známok besnoty KVL SR.");
  }

  // ---------------------------------------------------------------------------
  // 3. Laboratórne Výsledky (Hematológia & Biochémia)
  // ---------------------------------------------------------------------------
  console.log("🧪 [3/5] Vkladám vzorové laboratórne profily a nálezy...");

  const existingLabs = await db.query.labResults.findMany({
    where: eq(labResults.practiceId, practiceId),
  });

  if (existingLabs.length === 0 && felix && blesk) {
    await db.insert(labResults).values([
      // Felix (CKD Profil)
      {
        practiceId,
        patientId: felix.id,
        testName: "Kreatinín (Sérum)",
        resultValue: "248",
        unit: "umol/l",
        referenceRangeLow: "71.000",
        referenceRangeHigh: "212.000",
        status: "completed",
        resultFlag: "abnormal",
        orderedBy: vetUser?.id ?? adminUser.id,
        completedAt: dAgo(5),
        followUpStatus: "not_required",
      },
      {
        practiceId,
        patientId: felix.id,
        testName: "Urea (Močovina)",
        resultValue: "15.2",
        unit: "mmol/l",
        referenceRangeLow: "5.700",
        referenceRangeHigh: "12.900",
        status: "completed",
        resultFlag: "abnormal",
        orderedBy: vetUser?.id ?? adminUser.id,
        completedAt: dAgo(5),
        followUpStatus: "not_required",
      },
      {
        practiceId,
        patientId: felix.id,
        testName: "SDMA (Symetrický dimetylarginín)",
        resultValue: "19",
        unit: "ug/dl",
        referenceRangeLow: "0.000",
        referenceRangeHigh: "14.000",
        status: "completed",
        resultFlag: "abnormal",
        orderedBy: vetUser?.id ?? adminUser.id,
        completedAt: dAgo(5),
        followUpStatus: "not_required",
      },
      {
        practiceId,
        patientId: felix.id,
        testName: "Anorganický fosfor",
        resultValue: "1.72",
        unit: "mmol/l",
        referenceRangeLow: "1.000",
        referenceRangeHigh: "2.420",
        status: "completed",
        resultFlag: "normal",
        orderedBy: vetUser?.id ?? adminUser.id,
        completedAt: dAgo(5),
        followUpStatus: "not_required",
      },
      {
        practiceId,
        patientId: felix.id,
        testName: "Glukóza v krvi",
        resultValue: "5.3",
        unit: "mmol/l",
        referenceRangeLow: "3.900",
        referenceRangeHigh: "8.300",
        status: "completed",
        resultFlag: "normal",
        orderedBy: vetUser?.id ?? adminUser.id,
        completedAt: dAgo(5),
        followUpStatus: "not_required",
      },

      // Blesk (Pre-anestetický pečeňový panel)
      {
        practiceId,
        patientId: blesk.id,
        testName: "ALT (Alanínaminotransferáza)",
        resultValue: "44",
        unit: "U/L",
        referenceRangeLow: "10.000",
        referenceRangeHigh: "100.000",
        status: "completed",
        resultFlag: "normal",
        orderedBy: vetUser?.id ?? adminUser.id,
        completedAt: dAgo(2),
        followUpStatus: "not_required",
      },
      {
        practiceId,
        patientId: blesk.id,
        testName: "ALP (Alkalická fosfatáza)",
        resultValue: "88",
        unit: "U/L",
        referenceRangeLow: "23.000",
        referenceRangeHigh: "212.000",
        status: "completed",
        resultFlag: "normal",
        orderedBy: vetUser?.id ?? adminUser.id,
        completedAt: dAgo(2),
        followUpStatus: "not_required",
      },
      {
        practiceId,
        patientId: blesk.id,
        testName: "Celkový proteín",
        resultValue: "69",
        unit: "g/l",
        referenceRangeLow: "52.000",
        referenceRangeHigh: "82.000",
        status: "completed",
        resultFlag: "normal",
        orderedBy: vetUser?.id ?? adminUser.id,
        completedAt: dAgo(2),
        followUpStatus: "not_required",
      },

      // Bella (Pooperačný krvný obraz)
      {
        practiceId,
        patientId: bella?.id ?? blesk.id,
        testName: "WBC (Biele krvinky - Leukocyty)",
        resultValue: "14.8",
        unit: "x10^9/l",
        referenceRangeLow: "6.000",
        referenceRangeHigh: "17.000",
        status: "completed",
        resultFlag: "normal",
        orderedBy: vetUser?.id ?? adminUser.id,
        completedAt: dAgo(7),
        followUpStatus: "not_required",
      },
      {
        practiceId,
        patientId: bella?.id ?? blesk.id,
        testName: "RBC (Červené krvinky - Erytrocyty)",
        resultValue: "6.9",
        unit: "x10^12/l",
        referenceRangeLow: "5.500",
        referenceRangeHigh: "8.500",
        status: "completed",
        resultFlag: "normal",
        orderedBy: vetUser?.id ?? adminUser.id,
        completedAt: dAgo(7),
        followUpStatus: "not_required",
      },
      {
        practiceId,
        patientId: bella?.id ?? blesk.id,
        testName: "HCT (Hematokrit)",
        resultValue: "0.45",
        unit: "l/l",
        referenceRangeLow: "0.370",
        referenceRangeHigh: "0.550",
        status: "completed",
        resultFlag: "normal",
        orderedBy: vetUser?.id ?? adminUser.id,
        completedAt: dAgo(7),
        followUpStatus: "not_required",
      },
    ]);
    console.log("  ✓ Vytvorených 11 detailných laboratórnych testov s referenčnými rozsahmi a vlajočkami.");
  }

  // ---------------------------------------------------------------------------
  // 4. e-Kasa & Fiškálne Doklady
  // ---------------------------------------------------------------------------
  console.log("🧾 [4/5] Vkladám vzorové fiškálne e-Kasa doklady a konfiguráciu...");

  const existingEkasaConfig = await db.query.ekasaConfig.findFirst({
    where: eq(ekasaConfig.practiceId, practiceId),
  });

  if (!existingEkasaConfig) {
    await db.insert(ekasaConfig).values({
      practiceId,
      dic: "2020293057",
      icDph: "SK2020293057",
      pokladnicaId: "8881234567890001",
      pokladnicaType: "ORP",
      ekasaApiUrl: "https://ekasa.financnasprava.sk/oto/api",
      offlineModeEnabled: false,
      cashlessEnabled: true,
      isActive: true,
    });
    console.log("  ✓ Vytvorená aktívna konfigurácia e-Kasa pokladnice (ORP/VRP).");
  }

  const existingReceipts = await db.query.ekasaReceipts.findMany({
    where: eq(ekasaReceipts.practiceId, practiceId),
  });

  if (existingReceipts.length === 0) {
    await db.insert(ekasaReceipts).values([
      {
        practiceId,
        receiptNumber: "20260905-0001",
        uid: "O-8881234567890001-20260905-0001-A1B2C3D4",
        okp: "a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d",
        pkp: "MEQCID...base64SignatureFRSR...==",
        amountBase: "40.00",
        amountVat: "8.00",
        amountTotal: "48.00",
        vatRate: "STANDARD_23",
        paymentMethod: "CARD",
        status: "CONFIRMED",
        issuedAt: dAgo(1),
      },
      {
        practiceId,
        receiptNumber: "20260905-0002",
        uid: "O-8881234567890001-20260905-0002-E5F6A7B8",
        okp: "b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e",
        pkp: "MEYCIQ...base64SignatureFRSR...==",
        amountBase: "105.00",
        amountVat: "21.00",
        amountTotal: "126.00",
        vatRate: "STANDARD_23",
        paymentMethod: "CARD",
        status: "CONFIRMED",
        issuedAt: dAgo(2),
      },
      {
        practiceId,
        receiptNumber: "20260905-0003",
        uid: "O-8881234567890001-20260905-0003-C9D0E1F2",
        okp: "c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f",
        pkp: "MEQCID...base64SignatureFRSR...==",
        amountBase: "74.17",
        amountVat: "14.83",
        amountTotal: "89.00",
        vatRate: "STANDARD_23",
        paymentMethod: "CASH",
        status: "CONFIRMED",
        issuedAt: dAgo(3),
      },
    ]);
    console.log("  ✓ Vytvorené 3 fiškálne e-Kasa doklady s QR a UID kódmi.");
  }

  // ---------------------------------------------------------------------------
  // 5. Wellness Balíčky, Konkurenčný Monitoring & Informované Súhlasy
  // ---------------------------------------------------------------------------
  console.log("📋 [5/5] Vkladám Wellness plány, Konkurenciu a Informované súhlasy...");

  // Wellness Plans
  const existingPlans = await db.query.wellnessPlans.findMany({
    where: eq(wellnessPlans.practiceId, practiceId),
  });

  let puppyPlanId: string;
  let seniorPlanId: string;

  if (existingPlans.length === 0) {
    const insertedPlans = await db
      .insert(wellnessPlans)
      .values([
        {
          practiceId,
          name: "Balíček „Zdravé šteňa“",
          description: "Komplexná preventívna starostlivosť počas prvého roka: všetky primovakcinácie, čipovanie, pas, 3x odčervenie a 2x bezplatná poradňa výživy.",
          price: "19.00",
          billingInterval: "monthly",
          active: true,
        },
        {
          practiceId,
          name: "Program „Aktívny senior“ (pre psov od 7 rokov)",
          description: "Ročná geriatrická prevencia: 1x kompletný biochemický a hematologický krvný profil, RTG hrudníka, sono brucha, meranie krvného tlaku a 15% zľava na kĺbovú výživu.",
          price: "24.50",
          billingInterval: "monthly",
          active: true,
        },
        {
          practiceId,
          name: "Dentálny wellness program",
          description: "Pravidelná kontrola chrupu, 1x ročne ultrazvukové čistenie zubného kameňa v inhalačnej anestézii a enzymatická zubná pasta zadarmo.",
          price: "14.00",
          billingInterval: "monthly",
          active: true,
        },
      ])
      .returning();

    puppyPlanId = insertedPlans[0].id;
    seniorPlanId = insertedPlans[1].id;
    console.log("  ✓ Vytvorené 3 preventívne Wellness balíčky.");
  } else {
    puppyPlanId = existingPlans[0].id;
    seniorPlanId = existingPlans[1]?.id ?? existingPlans[0].id;
  }

  // Wellness Enrollments
  const existingEnrollments = await db.query.wellnessEnrollments.findMany({
    where: eq(wellnessEnrollments.practiceId, practiceId),
  });

  if (existingEnrollments.length === 0 && blesk && client1) {
    await db.insert(wellnessEnrollments).values([
      {
        practiceId,
        planId: seniorPlanId,
        clientId: client1.id,
        patientId: blesk.id,
        status: "active",
        startDate: dAgo(180).toISOString().split("T")[0],
        nextBillingDate: new Date(Date.now() + 15 * 86400_000).toISOString().split("T")[0],
      },
      {
        practiceId,
        planId: puppyPlanId,
        clientId: client2.id,
        patientId: bella?.id ?? blesk.id,
        status: "active",
        startDate: dAgo(60).toISOString().split("T")[0],
        nextBillingDate: new Date(Date.now() + 25 * 86400_000).toISOString().split("T")[0],
      },
    ]);
    console.log("  ✓ Vytvorené 2 aktívne registrácie pacientov do Wellness plánov.");
  }

  // Consent Forms (Slovenské šablóny informovaných súhlasov)
  const existingConsents = await db.query.consentForms.findMany({
    where: eq(consentForms.practiceId, practiceId),
  });

  if (existingConsents.length === 0) {
    await db.insert(consentForms).values([
      {
        practiceId,
        slug: "anesthesia-surgery",
        title: "Informovaný súhlas s celkovou anestéziou a chirurgickým zákrokom",
        body: `Podpísaný majiteľ/držiteľ zvieracieho pacienta týmto potvrdzuje, že bol ošetrujúcim veterinárnym lekárom podrobne a zrozumiteľne oboznámený s povahou plánovaného chirurgického zákroku, s postupom pri celkovej anestézii, ako aj s možnými rizikami a komplikáciami, ktoré môžu vzniknúť počas zákroku alebo v pooperačnom období.

Majiteľ bol informovaný o nevyhnutnosti dodržania predoperačnej hladovky a berie na vedomie, že každá anestézia nesie so sebou inherentné riziko, ktoré môže byť ovplyvnené skrytým ochorením pacienta.

Súhlasím s vykonaním všetkých nevyhnutných neodkladných úkonov smerujúcich k záchrane života zvieraťa, pokiaľ by došlo k náhlej zmene jeho zdravotného stavu.`,
        sortOrder: 1,
        isActive: true,
      },
      {
        practiceId,
        slug: "hospitalization",
        title: "Súhlas s hospitalizáciou a intenzívnou terapiou",
        body: `Majiteľ zvieraťa súhlasí s hospitalizáciou svojho zvieraťa na lôžkovom oddelení kliniky za účelom kontinuálnej infúznej terapie, monitorovania životných funkcií a podávania liečiv.

Klinika sa zaväzuje zabezpečiť náležitú odbornú veterinárnu starostlivosť a pravidelne informovať majiteľa o vývoji zdravotného stavu pacienta.`,
        sortOrder: 2,
        isActive: true,
      },
      {
        practiceId,
        slug: "euthanasia-protocol",
        title: "Súhlas s eutanáziou zvieracieho pacienta a asanačným zneškodnením",
        body: `Majiteľ zvieraťa na základe vyčerpania liečebných možností, nepriaznivej prognózy a s cieľom ukončiť pretrvávajúce utrpenie zvieracieho pacienta žiada o vykonanie humánnej eutanázie.

Majiteľ potvrdzuje, že zviera v priebehu posledných 14 dní nepohrýzlo ani neporanilo žiadneho človeka. Ďalej súhlasí s ekologickým odovzdaním tela do kafilérneho zariadenia / krematória pre zvieratá.`,
        sortOrder: 3,
        isActive: true,
      },
    ]);
    console.log("  ✓ Vytvorené 3 štandardizované slovenské informované súhlasy.");
  }

  // Competitor Snapshots (Prieskum trhu a konkurencie)
  const existingSnapshots = await db.query.extMarketingCompetitorSnapshots.findMany({
    where: eq(extMarketingCompetitorSnapshots.practiceId, practiceId),
  });

  if (existingSnapshots.length === 0) {
    await db.insert(extMarketingCompetitorSnapshots).values([
      {
        practiceId,
        query: "Veterinárne kliniky v regióne Bratislava a okolie — porovnanie cien",
        region: "Bratislavský kraj (Bratislava, Pezinok, Senec)",
        model: "gemini-3.8-flash",
        isSample: true,
        clinics: [
          {
            name: "Súkromná vet. klinika MVDr. Martin Sýkora (Naša klinika)",
            distance: "0 km",
            rating: 4.9,
            reviewsCount: 148,
            prices: {
              vaccination_core: 36,
              castration_female_dog: 195,
              dental_cleaning_usg: 105,
              emergency_fee: 45,
            },
            notes: "Fear-Free certifikácia, moderné RTG a USG laboratórium priamo na pracovisku.",
          },
          {
            name: "Veterinárna poliklinika PetVet Ružinov",
            distance: "4.2 km",
            rating: 4.6,
            reviewsCount: 210,
            prices: {
              vaccination_core: 39,
              castration_female_dog: 220,
              dental_cleaning_usg: 125,
              emergency_fee: 60,
            },
            notes: "Veľká klinika s hospitalizáciou, vyššie ceny za pooperačnú starostlivosť.",
          },
          {
            name: "PrimaVet ambulancia Dúbravka",
            distance: "6.8 km",
            rating: 4.7,
            reviewsCount: 89,
            prices: {
              vaccination_core: 34,
              castration_female_dog: 180,
              dental_cleaning_usg: 95,
              emergency_fee: 50,
            },
            notes: "Rodinná ambulancia, obmedzené otváracie hodiny počas víkendov.",
          },
          {
            name: "NonStop Pohotovostná veterinárna klinika",
            distance: "8.5 km",
            rating: 4.3,
            reviewsCount: 340,
            prices: {
              vaccination_core: 44,
              castration_female_dog: 260,
              dental_cleaning_usg: 140,
              emergency_fee: 85,
            },
            notes: "24/7 pohotovosť s vysokým príplatkom za nočné ošetrenie.",
          },
        ],
        recommendations: [
          "Naša klinika má vysoko konkurencieschopné ceny pri kastrácii a dentálnej hygiene pri zachovaní špičkovej kvality a inhalačnej anestézie.",
          "Odporúčame propagovať Wellness balíčky, ktoré znižujú cenovú citlivosť klientov a zvyšujú retenciu.",
          "Pri pohotovostných príplatkoch udržiavame férovú sadzbu 45 € oproti trhovému priemeru 65 €.",
        ],
        sources: [
          "Cenníky veterinárnych pracovísk KVL SR (verejné zdroje)",
          "Google Moja Firma profily kliník",
        ],
      },
    ]);
    console.log("  ✓ Vytvorený komplexný cenový benchmarking konkurencie.");
  }

  console.log("\n🎉 VŠETKY DEMO DÁTA BOLI ÚSPEŠNE VYTVORENÉ A ULOŽENÉ DO DATABÁZY!");
}

if (process.argv[1]?.endsWith("seed-all-demo.ts")) {
  seedAllDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Chyba seedingu:", err);
      process.exit(1);
    });
}
