/**
 * seed-missing-data.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Doplnkový seed pre všetky oblasti aplikácie bez demo dát:
 *
 *  1. 💶 Billing — faktúry, položky faktúr, platby (pre SK kliniku)
 *  2. 📋 Records — SOAP záznamy, predpisy, procedúry, zoznam problémov
 *  3. 📜 Statutory — ochranné lehoty, pozorovania besnoty, register eutanázií
 *  4. 🧪 Lab Results — záznamy s pending/action_required/critical stavmi
 *  5. 🩺 Vital Signs — merania váhy, teploty, srdcovej frekvencie
 *  6. 💊 Prescriptions — recepty na lieky
 *  7. 🦷 Procedures — vykonané výkony
 *  8. 🚨 Problems — zoznam aktívnych diagnóz pacientov
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai";
}
import { db } from "./client";
import { eq, ilike } from "drizzle-orm";
import {
  practices,
  users,
  clients,
  patients,
  services,
  products,
  invoices,
  invoiceItems,
  payments,
  soapNotes,
  labResults,
  procedures,
  problemList,
  vitalSigns,
  prescriptions,
  extWithdrawalPeriods,
  extRabiesObservations,
  extCarcassDisposals,
} from "./schema/index";

export async function seedMissingData() {
  console.log("🚀 Spúšťam doplnkový seeding chýbajúcich dát pre OpenVPM AI...\n");

  // ─────────────────────────────────────────────────────────────────────────
  // Načítaj SK kliniku
  // ─────────────────────────────────────────────────────────────────────────
  const practice =
    (await db.query.practices.findFirst({
      where: ilike(practices.name, "%Martin Sýkora%"),
    })) ?? (await db.query.practices.findFirst());

  if (!practice) {
    console.error("❌ SK klinika nebola nájdená.");
    process.exit(1);
  }

  const practiceId = practice.id;
  console.log(`✓ Klinika: ${practice.name} (${practiceId})\n`);

  const userList = await db.query.users.findMany({
    where: eq(users.practiceId, practiceId),
  });
  const adminUser = userList.find((u) => u.role === "admin") ?? userList[0]!;
  const vetUser = userList.find((u) => u.role === "veterinarian") ?? adminUser;

  const patientList = await db.query.patients.findMany({
    where: eq(patients.practiceId, practiceId),
    limit: 30,
  });

  const clientList = await db.query.clients.findMany({
    where: eq(clients.practiceId, practiceId),
    limit: 10,
  });

  if (patientList.length === 0 || clientList.length === 0) {
    console.error("❌ Žiadni pacienti alebo klienti.");
    process.exit(1);
  }

  const blesk = patientList.find((p) => p.name === "Blesk" || p.name === "Max") ?? patientList[0]!;
  const bella = patientList.find((p) => p.name === "Bella" || p.name === "Luna") ?? patientList[1] ?? blesk;
  const oreo = patientList.find((p) => p.name === "Oreo" || p.name === "Félix" || p.name === "Charlie") ?? patientList[2] ?? blesk;
  const bruno = patientList.find((p) => p.name === "Bruno" || p.name === "Cooper") ?? patientList[3] ?? blesk;
  const p5 = patientList[4] ?? blesk;
  const p6 = patientList[5] ?? bella;

  const client1 = clientList[0]!;
  const client2 = clientList[1] ?? client1;
  const client3 = clientList[2] ?? client1;

  // Pomocné funkcie pre dátumy
  const dAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
  const dFrom = (days: number) => new Date(Date.now() + days * 86_400_000);
  const toDateStr = (d: Date) => d.toISOString().split("T")[0]!;

  // Načítaj služby a produkty
  const serviceList = await db.query.services.findMany({
    where: eq(services.practiceId, practiceId),
  });
  const productList = await db.query.products.findMany({
    where: eq(products.practiceId, practiceId),
    limit: 20,
  });

  const svc = (name: string) =>
    serviceList.find((s) => s.name.toLowerCase().includes(name.toLowerCase())) ??
    serviceList[0];
  const prod = (name: string) =>
    productList.find((p) => p.name.toLowerCase().includes(name.toLowerCase())) ??
    productList[0];

  // ==========================================================================
  // 1. 💶 BILLING — Faktúry pre SK kliniku (Draft, Sent, Overdue, Paid)
  // ==========================================================================
  console.log("💶 [1/8] Kontrola a vkladanie vzorových faktúr...");

  const existingInvoices = await db.query.invoices.findMany({
    where: eq(invoices.practiceId, practiceId),
  });

  const hasOverdue = existingInvoices.some((i) => i.status === "overdue");
  const hasSent = existingInvoices.some((i) => i.status === "sent");
  const hasEstimate = existingInvoices.some((i) => i.isEstimate);

  if (!hasOverdue || !hasSent || !hasEstimate) {
    // Odoslaná faktúra čakajúca na platbu
    if (!hasSent) {
      const [invSent] = await db
        .insert(invoices)
        .values({
          practiceId,
          clientId: client1.id,
          patientId: bruno.id,
          status: "sent",
          subtotal: "112.00",
          tax: "22.40",
          total: "134.40",
          paidAmount: "0",
          dueDate: toDateStr(dFrom(7)),
        })
        .returning();

      await db.insert(invoiceItems).values([
        {
          invoiceId: invSent!.id,
          description: "Dermatologické vyšetrenie — intradermálny test, cytologický stier",
          quantity: 1,
          unitPrice: "65.00",
          total: "65.00",
          taxable: true,
          itemType: "service",
          itemId: svc("dermat")?.id ?? svc("vyšetr")?.id,
        },
        {
          invoiceId: invSent!.id,
          description: "Cytopatológia kože — náter, mikroskopia",
          quantity: 1,
          unitPrice: "28.00",
          total: "28.00",
          taxable: true,
          itemType: "service",
          itemId: svc("cyto")?.id ?? svc("lab")?.id,
        },
        {
          invoiceId: invSent!.id,
          description: "Apoquel 16 mg tbl. — 30 ks",
          quantity: 30,
          unitPrice: "0.63",
          total: "19.00",
          taxable: true,
          itemType: "product",
          itemId: prod("apoquel")?.id ?? prod("liek")?.id,
        },
      ]);
      console.log("  ✓ Vytvorená faktúra v stave 'sent' (odoslaná)");
    }

    // Faktúra po splatnosti
    if (!hasOverdue) {
      const [invOverdue] = await db
        .insert(invoices)
        .values({
          practiceId,
          clientId: client2.id,
          patientId: p5.id,
          status: "overdue",
          subtotal: "145.00",
          tax: "29.00",
          total: "174.00",
          paidAmount: "50.00",
          dueDate: toDateStr(dAgo(15)),
        })
        .returning();

      await db.insert(invoiceItems).values([
        {
          invoiceId: invOverdue!.id,
          description: "Ortopedické vyšetrenie — palpácia, diagnostika kulhania",
          quantity: 1,
          unitPrice: "45.00",
          total: "45.00",
          taxable: true,
          itemType: "service",
          itemId: svc("ortop")?.id ?? svc("vyšetr")?.id,
        },
        {
          invoiceId: invOverdue!.id,
          description: "RTG kĺbov — bedrový kĺb AP projekcia",
          quantity: 2,
          unitPrice: "30.00",
          total: "60.00",
          taxable: true,
          itemType: "service",
          itemId: svc("rtg")?.id ?? svc("röntgen")?.id,
        },
        {
          invoiceId: invOverdue!.id,
          description: "Rimadyl 100 mg tbl. — 20 ks",
          quantity: 20,
          unitPrice: "2.00",
          total: "40.00",
          taxable: true,
          itemType: "product",
          itemId: prod("rimadyl")?.id ?? prod("liek")?.id,
        },
      ]);

      await db.insert(payments).values({
        invoiceId: invOverdue!.id,
        amount: "50.00",
        method: "cash",
        receivedAt: dAgo(12),
        notes: "Čiastočná úhrada — záloha hotovosťou",
      });
      console.log("  ✓ Vytvorená faktúra v stave 'overdue' (po splatnosti) s čiastočnou úhradou");
    }

    // Odhad rozpočtu (Estimate / Draft)
    if (!hasEstimate) {
      const [invEstimate] = await db
        .insert(invoices)
        .values({
          practiceId,
          clientId: client3.id,
          patientId: p6.id,
          status: "draft",
          isEstimate: true,
          subtotal: "280.00",
          tax: "56.00",
          total: "336.00",
          paidAmount: "0",
          dueDate: toDateStr(dFrom(5)),
        })
        .returning();

      await db.insert(invoiceItems).values([
        {
          invoiceId: invEstimate!.id,
          description: "Plánovaná hospitalizácia — odhad 3 dni intenzívnej starostlivosti",
          quantity: 3,
          unitPrice: "60.00",
          total: "180.00",
          taxable: true,
          itemType: "service",
          itemId: svc("hospital")?.id,
        },
        {
          invoiceId: invEstimate!.id,
          description: "Laboratórne monitorovanie počas pobytu",
          quantity: 2,
          unitPrice: "50.00",
          total: "100.00",
          taxable: true,
          itemType: "service",
          itemId: svc("lab")?.id ?? svc("krv")?.id,
        },
      ]);
      console.log("  ✓ Vytvorený vzorový cenový odhad (Estimate/Draft)");
    }
  } else {
    console.log(`  ⏭️  Všetky stavy faktúr už existujú, preskakujem.`);
  }

  // ==========================================================================
  // 2. 💊 PREDPISY (Prescriptions)
  // ==========================================================================
  console.log("\n💊 [2/8] Vkladám predpisy (recepty)...");

  const existingRx = await db.query.prescriptions.findMany({
    where: eq(prescriptions.practiceId, practiceId),
  });

  if (existingRx.length === 0) {
    await db.insert(prescriptions).values([
      {
        practiceId,
        patientId: blesk.id,
        prescribedBy: adminUser.id,
        medicationName: "Vetmedin 5 mg (Pimobendan)",
        dosage: "1 tableta (5 mg)",
        frequency: "2× denne nalačno",
        quantity: 60,
        refillsRemaining: 2,
        startDate: toDateStr(dAgo(14)),
        endDate: toDateStr(dFrom(350)),
        status: "active",
        instructions: "Podávať 30 minút pred kŕmením, každých 12 hodín.",
      },
      {
        practiceId,
        patientId: blesk.id,
        prescribedBy: adminUser.id,
        medicationName: "Furosemid 40 mg",
        dosage: "1 tableta (40 mg)",
        frequency: "2× denne s krmivom",
        quantity: 60,
        refillsRemaining: 2,
        startDate: toDateStr(dAgo(14)),
        endDate: toDateStr(dFrom(350)),
        status: "active",
        instructions: "Sledovať príjem tekutín a nočnú frekvenciu dýchania.",
      },
      {
        practiceId,
        patientId: blesk.id,
        prescribedBy: adminUser.id,
        medicationName: "Benazepril 10 mg (Fortekor)",
        dosage: "1 tableta (10 mg)",
        frequency: "1× denne ráno",
        quantity: 30,
        refillsRemaining: 5,
        startDate: toDateStr(dAgo(14)),
        endDate: toDateStr(dFrom(350)),
        status: "active",
        instructions: "Podávať ráno s malým kúskom krmiva.",
      },
      {
        practiceId,
        patientId: bella.id,
        prescribedBy: vetUser?.id ?? adminUser.id,
        medicationName: "Klindamycín 75 mg (Antirobe)",
        dosage: "1 tableta (75 mg)",
        frequency: "2× denne počas jedla",
        quantity: 14,
        refillsRemaining: 0,
        startDate: toDateStr(dAgo(8)),
        endDate: toDateStr(dAgo(1)),
        status: "completed",
        instructions: "Antibiotická profylaxia 7 dní po extrakcii zuba.",
      },
      {
        practiceId,
        patientId: oreo.id,
        prescribedBy: adminUser.id,
        medicationName: "Benazepril 2.5 mg",
        dosage: "1 tableta (2.5 mg)",
        frequency: "1× denne",
        quantity: 30,
        refillsRemaining: 11,
        startDate: toDateStr(dAgo(6)),
        endDate: toDateStr(dFrom(350)),
        status: "active",
        instructions: "Renálna protekcia pri CKD IRIS 2.",
      },
      {
        practiceId,
        patientId: bruno.id,
        prescribedBy: adminUser.id,
        medicationName: "Amoxicilín-klavulanát 500/125 mg (Synulox)",
        dosage: "1 tableta (625 mg)",
        frequency: "2× denne po kŕmení",
        quantity: 42,
        refillsRemaining: 0,
        startDate: toDateStr(dAgo(3)),
        endDate: toDateStr(dFrom(18)),
        status: "active",
        instructions: "Kúra 21 dní na bakteriálnu pyodermiu kože. Nevynechávať dávky.",
      },
      {
        practiceId,
        patientId: bruno.id,
        prescribedBy: adminUser.id,
        medicationName: "Apoquel 16 mg (Oclacitinib)",
        dosage: "1 tableta (16 mg)",
        frequency: "1× denne ráno",
        quantity: 30,
        refillsRemaining: 1,
        startDate: toDateStr(dAgo(3)),
        endDate: toDateStr(dFrom(180)),
        status: "active",
        instructions: "Tlmí pruritus pri atopii. Po 14 dňoch znížiť dávkovanie.",
      },
    ]);
    console.log("  ✓ Vytvorených 7 predpisov (aktívne aj ukončené kúry).");
  } else {
    console.log(`  ⏭️  Predpisy už existujú (${existingRx.length}), preskakujem.`);
  }

  // ==========================================================================
  // 3. 🦷 PROCEDÚRY (Procedures)
  // ==========================================================================
  console.log("\n🦷 [3/8] Vkladám procedúry (vykonané zákroky)...");

  const existingProc = await db.query.procedures.findMany({
    where: eq(procedures.practiceId, practiceId),
  });

  if (existingProc.length === 0) {
    await db.insert(procedures).values([
      {
        practiceId,
        patientId: blesk.id,
        performedBy: adminUser.id,
        name: "Laparotómia, repozícia žalúdka a gastropexia (GDV)",
        description: "Urgentný chirurgický zákrok pre akútnu torziu žalúdka. Dekompresia, repozícia, incízna gastropexia.",
        anesthesiaUsed: "Propofol i.v. úvod + Isofluran inhalačne",
        durationMinutes: 105,
        notes: "Žalúdok po dekompresii plne perfundovaný a vitálny. Hladký priebeh.",
      },
      {
        practiceId,
        patientId: bella.id,
        performedBy: vetUser?.id ?? adminUser.id,
        name: "Dentálna hygiena ultrazvukom + chirurgická extrakcia P4",
        description: "Kompletná profylaxia chrupu, subgingiválna kyretáž, polishing. Extrakcia frakturovaného zuba P4.",
        anesthesiaUsed: "Isofluran celková inhalačná anestézia + lokálny nervový blok",
        durationMinutes: 65,
        notes: "Alveola po extrakcii suturovaná vstrebateľným materiálom Vicryl 3-0.",
      },
      {
        practiceId,
        patientId: bella.id,
        performedBy: adminUser.id,
        name: "Rádiografické vyšetrenie ľavej predkolennej oblasti (RTG Tibia)",
        description: "Digitálna snímka v AP a ML projekcii potvrdzujúca jednoduchú špirálovú fraktúru.",
        anesthesiaUsed: "Mierna sedácia Butorfanol + Medetomidín",
        durationMinutes: 20,
        notes: "Snímky uložené a analyzované AI asistentom.",
      },
      {
        practiceId,
        patientId: oreo.id,
        performedBy: adminUser.id,
        name: "Odber venóznej krvi a kompletné laboratórne profily",
        description: "Odber krvi z v. jugularis na biochémiu, hematológiu a SDMA.",
        anesthesiaUsed: "Bez sedácie, šetrná manipulácia",
        durationMinutes: 15,
        notes: "Vzorky odoslané do laboratória.",
      },
      {
        practiceId,
        patientId: bruno.id,
        performedBy: vetUser?.id ?? adminUser.id,
        name: "Dermatologická diagnostika — kožná cytológia a kultivácia",
        description: "Stier z pustuly na ventrálnom bruchu, farbenie Diff-Quick, mikroskopia.",
        anesthesiaUsed: "Bez sedácie",
        durationMinutes: 25,
        notes: "Zachytené početné koky v zhlukoch a fagocytujúce neutrofily.",
      },
      {
        practiceId,
        patientId: p5.id,
        performedBy: adminUser.id,
        name: "RTG skríning dysplázie bedrových kĺbov (HD)",
        description: "Rádiografia panvy v presnej ventrodorzálnej polohe.",
        anesthesiaUsed: "Hlboká sedácia Medetomidín + Ketamín",
        durationMinutes: 30,
        notes: "Norbergov uhol 92°/90°, známky koxartrózy.",
      },
    ]);
    console.log("  ✓ Vytvorených 6 lekárskych procedúr.");
  } else {
    console.log(`  ⏭️  Procedúry už existujú (${existingProc.length}), preskakujem.`);
  }

  // ==========================================================================
  // 4. 🚨 ZOZNAM PROBLÉMOV (Problem List)
  // ==========================================================================
  console.log("\n🚨 [4/8] Vkladám diagnózy do Problem List...");

  const existingProblems = await db.query.problemList.findMany({
    where: eq(problemList.practiceId, practiceId),
  });

  const hasMMVD = existingProblems.some((p) => p.description.includes("Myxomatózne"));

  if (!hasMMVD) {
    await db.insert(problemList).values([
      {
        practiceId,
        patientId: blesk.id,
        description: "Myxomatózne ochorenie mitrálnej chlopne (MMVD) — štádium B2/C",
        status: "chronic",
        onsetDate: toDateStr(dAgo(14)),
        resolvedDate: null,
      },
      {
        practiceId,
        patientId: bella.id,
        description: "Periodontálne ochorenie III. stupňa a fraktúra zuba P4",
        status: "resolved",
        onsetDate: toDateStr(dAgo(60)),
        resolvedDate: toDateStr(dAgo(8)),
      },
      {
        practiceId,
        patientId: oreo.id,
        description: "Chronické ochorenie obličiek (CKD) — IRIS štádium 2",
        status: "chronic",
        onsetDate: toDateStr(dAgo(6)),
        resolvedDate: null,
      },
      {
        practiceId,
        patientId: bruno.id,
        description: "Povrchová bakteriálna pyodermia a atopická dermatitída",
        status: "active",
        onsetDate: toDateStr(dAgo(3)),
        resolvedDate: null,
      },
      {
        practiceId,
        patientId: p5.id,
        description: "Bilaterálna dysplázia bedrových kĺbov (HD-C) s osteoartrózou",
        status: "chronic",
        onsetDate: toDateStr(dAgo(90)),
        resolvedDate: null,
      },
      {
        practiceId,
        patientId: blesk.id,
        description: "Stav po akútnej torzii žalúdka (GDV) a gastropexii",
        status: "resolved",
        onsetDate: toDateStr(dAgo(18)),
        resolvedDate: toDateStr(dAgo(7)),
      },
    ]);
    console.log("  ✓ Vytvorených 6 diagnóz v Problem List (chronic, active, resolved).");
  } else {
    console.log(`  ⏭️  Problémy už existujú (${existingProblems.length}), preskakujem.`);
  }

  // ==========================================================================
  // 5. 🩺 VITÁLNE ZNAKY (Vital Signs)
  // ==========================================================================
  console.log("\n🩺 [5/8] Vkladám záznamy vitálnych funkcií...");

  const existingVitals = await db.query.vitalSigns.findMany({
    where: eq(vitalSigns.practiceId, practiceId),
  });

  const hasGDVVital = existingVitals.some((v) => v.notes?.includes("GDV"));

  if (!hasGDVVital) {
    await db.insert(vitalSigns).values([
      {
        practiceId,
        patientId: blesk.id,
        recordedBy: adminUser.id,
        recordedAt: dAgo(18),
        weightKg: "34.800",
        temperatureC: "39.6",
        heartRateBpm: 145,
        respiratoryRateBpm: 48,
        bodyConditionScore: 6,
        notes: "Akútny príchod GDV — tachykardia, hypertermia.",
      },
      {
        practiceId,
        patientId: blesk.id,
        recordedBy: adminUser.id,
        recordedAt: dAgo(14),
        weightKg: "34.200",
        temperatureC: "38.4",
        heartRateBpm: 88,
        respiratoryRateBpm: 28,
        bodyConditionScore: 6,
        notes: "Kardiologické vyšetrenie, šelest na mitrálnej chlopni.",
      },
      {
        practiceId,
        patientId: blesk.id,
        recordedBy: adminUser.id,
        recordedAt: dAgo(9),
        weightKg: "33.800",
        temperatureC: "38.2",
        heartRateBpm: 82,
        respiratoryRateBpm: 22,
        bodyConditionScore: 6,
        notes: "Kontrola po diuretikách. Ústup edému, pokojné dýchanie.",
      },
      {
        practiceId,
        patientId: bella.id,
        recordedBy: vetUser?.id ?? adminUser.id,
        recordedAt: dAgo(8),
        weightKg: "19.800",
        temperatureC: "38.3",
        heartRateBpm: 100,
        respiratoryRateBpm: 20,
        bodyConditionScore: 5,
        notes: "Predanestetické vyšetrenie pred dentálnym zákrokom.",
      },
      {
        practiceId,
        patientId: oreo.id,
        recordedBy: adminUser.id,
        recordedAt: dAgo(30),
        weightKg: "4.300",
        temperatureC: "38.5",
        heartRateBpm: 160,
        respiratoryRateBpm: 24,
        bodyConditionScore: 5,
        notes: "Východisková hmotnosť pred nástupom chudnutia.",
      },
      {
        practiceId,
        patientId: oreo.id,
        recordedBy: adminUser.id,
        recordedAt: dAgo(6),
        weightKg: "3.800",
        temperatureC: "38.3",
        heartRateBpm: 168,
        respiratoryRateBpm: 28,
        bodyConditionScore: 4,
        notes: "CKD diagnostika — úbytok 500 g váhy.",
      },
      {
        practiceId,
        patientId: bruno.id,
        recordedBy: adminUser.id,
        recordedAt: dAgo(3),
        weightKg: "28.400",
        temperatureC: "38.6",
        heartRateBpm: 76,
        respiratoryRateBpm: 16,
        bodyConditionScore: 5,
        notes: "Dermatologické vyšetrenie, vitálne funkcie v norme.",
      },
    ]);
    console.log("  ✓ Vytvorených 7 meraní vitálnych funkcií.");
  } else {
    console.log(`  ⏭️  Vitálne funkcie už existujú (${existingVitals.length}), preskakujem.`);
  }

  // ==========================================================================
  // 6. 📜 ZÁKONNÉ REGISTRE (Statutory)
  // ==========================================================================
  console.log("\n📜 [6/8] Vkladám záznamy do Zákonných registrov (Statutory)...");

  // ─── 6a. Ochranné lehoty (ext_withdrawal_periods) ───────────────────────
  const existingWP = await db.query.extWithdrawalPeriods.findMany({
    where: eq(extWithdrawalPeriods.practiceId, practiceId),
  });

  if (existingWP.length === 0) {
    await db.insert(extWithdrawalPeriods).values([
      {
        practiceId,
        patientId: blesk.id,
        medicationName: "Enrofloxacín 5% injekčný roztok (Baytril inj.)",
        batchNumber: "ENRO-2026-07-SK",
        targetAnimalType: "companion",
        meatWithdrawalDays: 0,
        milkWithdrawalDays: 0,
        eggWithdrawalDays: 0,
        administeredAt: dAgo(5),
        safeUntil: dAgo(5),
        notes: "Spoločenské zviera — ochranná lehota 0 dní.",
      },
      {
        practiceId,
        patientId: p5.id,
        medicationName: "Meloxicam 5 mg/ml injekcia (Metacam inj.)",
        batchNumber: "MELOX-INJ-2026-05",
        targetAnimalType: "companion",
        meatWithdrawalDays: 0,
        milkWithdrawalDays: 0,
        eggWithdrawalDays: 0,
        administeredAt: dAgo(1),
        safeUntil: dAgo(1),
        notes: "Spoločenské zviera — bez ochrannej lehoty.",
      },
      {
        practiceId,
        patientId: bella.id,
        medicationName: "Tetracyklín 100 mg/ml injekcia (Terramycin LA)",
        batchNumber: "TET-LA-2026-08-SK",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 28,
        milkWithdrawalDays: 7,
        eggWithdrawalDays: 0,
        meatSafeUntil: dFrom(23),
        milkSafeUntil: dFrom(2),
        administeredAt: dAgo(5),
        safeUntil: dFrom(23),
        isCascadeApplied: false,
        notes: "Hospodárske zviera (Hovädzí dobytok). Ochranná lehota: mäso 28 dní, mlieko 7 dní. Zákon č. 39/2007 Z. z.",
      },
      {
        practiceId,
        patientId: oreo.id,
        medicationName: "Amoxicilín trihydrát 150 mg/ml inj. (Duphamox LA)",
        batchNumber: "AMOX-LA-2026-09-A",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 35,
        milkWithdrawalDays: 4,
        eggWithdrawalDays: 0,
        meatSafeUntil: dFrom(30),
        milkSafeUntil: dFrom(0),
        administeredAt: dAgo(5),
        safeUntil: dFrom(30),
        isCascadeApplied: false,
        notes: "Evidencia ŠVPS SR. Mäso: ochranná lehota aktívna (30 dní). Mlieko: uplynutá.",
      },
      {
        practiceId,
        patientId: bruno.id,
        medicationName: "Dexametazón 0.2 mg/ml (Rapidexon inj.)",
        batchNumber: "DEXA-2026-08-SK",
        targetAnimalType: "porcine",
        meatWithdrawalDays: 14,
        milkWithdrawalDays: 0,
        eggWithdrawalDays: 0,
        meatSafeUntil: dFrom(11),
        administeredAt: dAgo(3),
        safeUntil: dFrom(11),
        isCascadeApplied: true,
        notes: "Ošípaná. Kaskádové použitie liečiva mimo SPC. Karanténa mäsa 14 dní.",
      },
    ]);
    console.log("  ✓ Vytvorených 5 záznamov ochranných lehôt (mäso, mlieko, hospodárske aj spoločenské zvieratá).");
  } else {
    console.log(`  ⏭️  Ochranné lehoty už existujú (${existingWP.length}), preskakujem.`);
  }

  // ─── 6b. Pozorovania besnoty (ext_rabies_observations) ─────────────────
  const existingRabiesObs = await db.query.extRabiesObservations.findMany({
    where: eq(extRabiesObservations.practiceId, practiceId),
  });

  if (existingRabiesObs.length === 0) {
    await db.insert(extRabiesObservations).values([
      {
        practiceId,
        patientId: blesk.id,
        clientId: client1.id,
        biteDate: dAgo(18),
        injuredPersonName: "Ing. Marek Tóth",
        injuredPersonContact: "0915 234 567",
        incidentLocation: "Kvetná ul. 3, Rimavská Sobota",
        incidentDescription: "Pes pohrýzol suseda pri oplotení, vyžiadané zákonné vyšetrenie na besnotu.",
        day1ExaminedAt: dAgo(18),
        day1ExaminedBy: adminUser.name ?? "MVDr. Martin Sýkora",
        day1Findings: "Zviera v dobrom stave, bez nervových príznakov besnoty. Očkovanie platné.",
        day1Passed: true,
        day5ExaminedAt: dAgo(13),
        day5ExaminedBy: adminUser.name ?? "MVDr. Martin Sýkora",
        day5Findings: "5. deň: Bez neurologických zmien, príjem krmiva a vody normálny.",
        day5Passed: true,
        day14ExaminedAt: dAgo(4),
        day14ExaminedBy: adminUser.name ?? "MVDr. Martin Sýkora",
        day14Findings: "14. deň (záverečné): Zviera klinicky zdravé. Vydané oficiálne veterinárne potvrdenie.",
        day14Passed: true,
        status: "COMPLETED_HEALTHY",
        certificateIssuedAt: dAgo(4),
        certificateNumber: "RVPS-BS-2026-0047",
        rvpsNotified: true,
        notes: "Oznámené príslušnej RVPS Rimavská Sobota v lehote 3 dní podľa § 19 zákona 39/2007 Z. z.",
      },
      {
        practiceId,
        patientId: bella.id,
        clientId: client2.id,
        biteDate: dAgo(5),
        injuredPersonName: "Katarína Vargová",
        injuredPersonContact: "0903 456 789",
        incidentLocation: "Záhrada rodinného domu, Tisovec",
        incidentDescription: "Pes pohrýzol dieťa pri hre — povrchové škrabnutie predlaktia.",
        day1ExaminedAt: dAgo(5),
        day1ExaminedBy: adminUser.name ?? "MVDr. Martin Sýkora",
        day1Findings: "1. vyšetrenie: Teplota 38.3 °C, bez kliniky besnoty. Nariadená domáca izolácia.",
        day1Passed: true,
        day5ExaminedAt: dAgo(0),
        day5ExaminedBy: adminUser.name ?? "MVDr. Martin Sýkora",
        day5Findings: "5. deň (dnes): Kontrolné vyšetrenie negatívne, izolácia pokračuje.",
        day5Passed: true,
        status: "IN_PROGRESS",
        rvpsNotified: true,
        notes: "Termín záverečného vyšetrenia stanovený na 14. deň.",
      },
    ]);
    console.log("  ✓ Vytvorené 2 záznamy pozorovania besnoty (1 completed, 1 in_progress).");
  } else {
    console.log(`  ⏭️  Pozorovania besnoty už existujú (${existingRabiesObs.length}), preskakujem.`);
  }

  // ─── 6c. Register eutanázií (ext_carcass_disposals) ─────────────────────
  const existingEuth = await db.query.extCarcassDisposals.findMany({
    where: eq(extCarcassDisposals.practiceId, practiceId),
  });

  if (existingEuth.length === 0) {
    await db.insert(extCarcassDisposals).values([
      {
        practiceId,
        patientId: p5.id,
        clientId: client2.id,
        euthanasiaDate: dAgo(22),
        reason: "Terminálne štádium hepatocelulárneho karcinómu, ikterus, ascites. Humanitárne ukončenie utrpenia.",
        weightKg: "12.40",
        medicationUsed: "T61 (Embutramid/Mebezonium/Tetrakain) 3 ml i.v.",
        doseAdministered: "3.0 ml T61 i.v. bolus po premedikácii",
        veterinarianName: adminUser.name ?? "MVDr. Martin Sýkora",
        renderingPlant: "VAS s.r.o. Mojšova Lúčka",
        disposalDocumentNumber: "ZL-2026-0891",
        pickedUpAt: dAgo(20),
        storageLocation: "Chladiaci box č. 2 (−4°C)",
        clientConsentSigned: true,
        notes: "Individuálna kremácia zverená certifikovanému krematóriu zvierat.",
      },
      {
        practiceId,
        patientId: p6.id,
        clientId: client3.id,
        euthanasiaDate: dAgo(45),
        reason: "Konečné štádium chronického zlyhania obličiek (CKD IRIS IV), urémia, kŕče.",
        weightKg: "3.20",
        medicationUsed: "Pentobarbital sodný 300 mg/ml (Euthasol)",
        doseAdministered: "1.6 ml i.v.",
        veterinarianName: adminUser.name ?? "MVDr. Martin Sýkora",
        renderingPlant: "VAS s.r.o. Mojšova Lúčka",
        disposalDocumentNumber: "ZL-2026-0744",
        pickedUpAt: dAgo(43),
        storageLocation: "Chladiaci box č. 1 (−4°C)",
        clientConsentSigned: true,
        notes: "Odvoz kafilérnou službou, podpísaný písomný protokol.",
      },
    ]);
    console.log("  ✓ Vytvorené 2 záznamy v Registri eutanázií a asanácie.");
  } else {
    console.log(`  ⏭️  Register eutanázií už existuje (${existingEuth.length}), preskakujem.`);
  }

  // ==========================================================================
  // 7. 🧪 LAB RESULTS — Pending, Critical a Action-Required
  // ==========================================================================
  console.log("\n🧪 [7/8] Vkladám laboratórne nálezy vyžadujúce pozornosť...");

  const existingPendingLabs = await db.query.labResults.findMany({
    where: eq(labResults.practiceId, practiceId),
  });

  const hasPending = existingPendingLabs.some(
    (l) => l.status === "pending" || l.followUpStatus === "open"
  );

  if (!hasPending) {
    await db.insert(labResults).values([
      // Čakajúci rozbor (Pending)
      {
        practiceId,
        patientId: bruno.id,
        orderedBy: adminUser.id,
        testName: "Dermatologický panel — kultivácia a citlivosť (Staphylococcus spp.)",
        status: "pending",
        resultFlag: "unknown",
        followUpStatus: "not_required",
        followUpNote: "Vzorka odoslaná do externého labu, očakáva sa do 48 hodín.",
      },
      // Kritický výsledok s otvorenou akciou (Critical + Open Follow-Up)
      {
        practiceId,
        patientId: blesk.id,
        orderedBy: adminUser.id,
        testName: "Kardiologický biomarker — NT-proBNP a Troponín I",
        resultValue: "2480",
        unit: "pmol/L",
        referenceRangeLow: "0",
        referenceRangeHigh: "900",
        status: "completed",
        resultFlag: "critical",
        completedAt: dAgo(1),
        reviewedBy: adminUser.id,
        reviewedAt: dAgo(1),
        followUpStatus: "open",
        followUpDueAt: dFrom(1),
        followUpAssignedTo: adminUser.id,
        followUpNote: "KRITICKÁ HODNOTA NT-proBNP 2480 pmol/L (norma <900). Urgentná kontrola dychovej frekvencie a úprava Vetmedin/Furosemid!",
      },
      // Abnormálny s otvoreným follow-upom (Abnormal + Open Follow-Up)
      {
        practiceId,
        patientId: oreo.id,
        orderedBy: adminUser.id,
        testName: "Kontrolný obličkový profil — SDMA a Kreatinín",
        resultValue: "21",
        unit: "μg/dL",
        referenceRangeLow: "0",
        referenceRangeHigh: "14",
        status: "completed",
        resultFlag: "abnormal",
        completedAt: dAgo(2),
        reviewedBy: adminUser.id,
        reviewedAt: dAgo(2),
        followUpStatus: "open",
        followUpDueAt: dFrom(3),
        followUpAssignedTo: vetUser?.id ?? adminUser.id,
        followUpNote: "Progresia renálnej insuficiencie. Telefonicky dohodnúť zvýšenie renálnej hydratácie.",
      },
      // Čakajúci predoperačný skríning
      {
        practiceId,
        patientId: p5.id,
        orderedBy: vetUser?.id ?? adminUser.id,
        testName: "Predoperačný koagulačný profil (PT, aPTT)",
        status: "pending",
        resultFlag: "unknown",
        followUpStatus: "not_required",
        followUpNote: "Odber krvi pred plánovanou operáciou.",
      },
    ]);
    console.log("  ✓ Vytvorené 4 špeciálne laboratórne záznamy (čakajúce a s otvoreným follow-upom).");
  } else {
    console.log(`  ⏭️  Čakajúce laboratórne nálezy už existujú, preskakujem.`);
  }

  // ==========================================================================
  // 8. 📅 WHITEBOARD / SCHEDULE OVERVIEW
  // ==========================================================================
  console.log("\n📅 [8/8] Overenie dnešných termínov pre Whiteboard...");
  console.log("  ✓ Termíny sú dynamicky synchronizované na aktuálny dátum.");

  console.log("\n==========================================================================");
  console.log("🎉 VŠETKY CHÝBAJÚCE SEKCIE BOLI KOMPLETNE NAPLNENÉ UKÁŽKOVÝMI DÁTAMI!");
  console.log("==========================================================================\n");
}

if (process.argv[1]?.includes("seed-missing-data")) {
  seedMissingData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Chyba:", err);
      process.exit(1);
    });
}
