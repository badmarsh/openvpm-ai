import "dotenv/config";
import crypto from "crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and } from "drizzle-orm";
import * as schema from "./schema";
import {
  practices,
  patients,
  clients,
  users,
  labResults,
  labAnalyzerReports,
  labResultEvents,
} from "./schema";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai";

async function main() {
  console.log("🧪 Spúšťam generovanie komplexných demo laboratórnych dát pre /lab-results...");

  const client = postgres(DB_URL);
  const db = drizzle(client, { schema });

  try {
    const allPractices = await db.select().from(practices);
    console.log(`Nájdené praxe (${allPractices.length}):`, allPractices.map((p) => `${p.name} [${p.id}]`));

    for (const practice of allPractices) {
      const practiceId = practice.id;
      console.log(`\n========================================`);
      console.log(`🏥 Spracovávam prax: ${practice.name} (${practiceId})`);

      // 1. Získaj lekárov a personál
      const staffList = await db
        .select()
        .from(users)
        .where(eq(users.practiceId, practiceId));

      const adminUser = staffList.find((u) => u.role === "admin") ?? staffList[0];
      const vetUser = staffList.find((u) => u.role === "veterinarian") ?? adminUser;
      const techUser = staffList.find((u) => u.role === "technician") ?? vetUser;
      const frontDeskUser = staffList.find((u) => u.role === "front_desk") ?? techUser;

      if (!adminUser) {
        console.warn(`⚠️ Žiadny používateľ pre prax ${practice.name}, preskakujem.`);
        continue;
      }

      // 2. Získaj pacientov danej praxe
      const patientList = await db
        .select()
        .from(patients)
        .where(eq(patients.practiceId, practiceId))
        .limit(10);

      if (patientList.length === 0) {
        console.warn(`⚠️ Žiadni pacienti pre prax ${practice.name}, preskakujem.`);
        continue;
      }

      const p1 = patientList[0]; // napr. Felix / Bella
      const p2 = patientList[1] ?? p1;
      const p3 = patientList[2] ?? p1;
      const p4 = patientList[3] ?? p2;

      console.log(`  🐾 Vybraní pacienti: ${patientList.map((p) => p.name).join(", ")}`);

      // Pomocné časy
      const now = new Date();
      const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000);
      const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000);

      // Vyčisti staré demo lab_results a lab_analyzer_reports ak chceme čistý stav, alebo doplň
      console.log("  🧹 Pripravujem záznamy v lab_results...");

      // Zoznam nových realistických demo parametrov
      const newLabItems = [
        // 1. KRITICKÉ NÁLEZY (Critical Flag - vyžaduje okamžitú pozornosť)
        {
          practiceId,
          patientId: p3.id,
          testName: "cPL (Kvantitatívna pankreatická lipáza)",
          resultValue: "1050",
          unit: "ug/l",
          referenceRangeLow: "0.000",
          referenceRangeHigh: "200.000",
          status: "completed" as const,
          resultFlag: "critical" as const,
          orderedBy: vetUser.id,
          completedAt: hoursAgo(2),
          followUpStatus: "open" as const,
          followUpAssignedTo: vetUser.id,
          followUpDueAt: hoursAgo(-2), // do 2 hodín
          followUpNote: "URGENT: Ťažká akútna pankreatitída! Zahájiť okamžitú analgéziu (Fentanyl/Buprenorfín), i.v. kryštaloidy, maropitant a hospitalizáciu s monitoringom!",
        },
        {
          practiceId,
          patientId: p3.id,
          testName: "Draslík (K+ Sérum)",
          resultValue: "2.8",
          unit: "mmol/l",
          referenceRangeLow: "3.800",
          referenceRangeHigh: "5.500",
          status: "completed" as const,
          resultFlag: "critical" as const,
          orderedBy: vetUser.id,
          completedAt: hoursAgo(2),
          followUpStatus: "open" as const,
          followUpAssignedTo: techUser.id,
          followUpDueAt: hoursAgo(-1),
          followUpNote: "Ťažká hypokaliémia pri vracaní - doplniť KCl do infúzie podľa protokolu (max 0.5 mmol/kg/h).",
        },
        {
          practiceId,
          patientId: p2.id,
          testName: "Trombocyty (PLT)",
          resultValue: "28",
          unit: "x10^9/l",
          referenceRangeLow: "175.000",
          referenceRangeHigh: "500.000",
          status: "completed" as const,
          resultFlag: "critical" as const,
          orderedBy: vetUser.id,
          completedAt: hoursAgo(5),
          followUpStatus: "open" as const,
          followUpAssignedTo: vetUser.id,
          followUpDueAt: hoursAgo(-4),
          followUpNote: "Ťažká trombocytopénia (podozrenie na IMTP alebo otravu brodifakumom). Skontrolovať hematómy a sliznice.",
        },

        // 2. ČAKÁ NA VÝSLEDKY (Awaiting Values / Pending)
        {
          practiceId,
          patientId: p1.id,
          testName: "Kompletný geriatrický profil (Synlab)",
          resultValue: null,
          unit: null,
          referenceRangeLow: null,
          referenceRangeHigh: null,
          status: "pending" as const,
          resultFlag: "unknown" as const,
          orderedBy: vetUser.id,
          completedAt: null,
          followUpStatus: "not_required" as const,
          followUpAssignedTo: null,
          followUpDueAt: null,
          followUpNote: null,
        },
        {
          practiceId,
          patientId: p2.id,
          testName: "FIV / FeLV konfirmačné PCR (Laboklin)",
          resultValue: null,
          unit: null,
          referenceRangeLow: null,
          referenceRangeHigh: null,
          status: "pending" as const,
          resultFlag: "unknown" as const,
          orderedBy: vetUser.id,
          completedAt: null,
          followUpStatus: "not_required" as const,
          followUpAssignedTo: null,
          followUpDueAt: null,
          followUpNote: null,
        },
        {
          practiceId,
          patientId: p4.id,
          testName: "Kultivácia a citlivosť z moču (Uricult)",
          resultValue: null,
          unit: null,
          referenceRangeLow: null,
          referenceRangeHigh: null,
          status: "pending" as const,
          resultFlag: "unknown" as const,
          orderedBy: vetUser.id,
          completedAt: null,
          followUpStatus: "not_required" as const,
          followUpAssignedTo: null,
          followUpDueAt: null,
          followUpNote: null,
        },

        // 3. ABNORMÁLNE VÝSLEDKY ČAKAJÚCE NA REVIEW VETERINÁROM (Awaiting Review)
        {
          practiceId,
          patientId: p1.id,
          testName: "Kreatinín (Sérum)",
          resultValue: "286",
          unit: "umol/l",
          referenceRangeLow: "71.000",
          referenceRangeHigh: "212.000",
          status: "completed" as const,
          resultFlag: "abnormal" as const,
          orderedBy: vetUser.id,
          completedAt: hoursAgo(4),
          followUpStatus: "open" as const,
          followUpAssignedTo: frontDeskUser.id,
          followUpDueAt: hoursAgo(-24),
          followUpNote: "Zavolať majiteľovi: Nasadiť obličkovú diétu (Royal Canin Renal), Semintra sirup a kontrolný odber o 14 dní.",
        },
        {
          practiceId,
          patientId: p1.id,
          testName: "Urea (Močovina)",
          resultValue: "18.2",
          unit: "mmol/l",
          referenceRangeLow: "5.700",
          referenceRangeHigh: "12.900",
          status: "completed" as const,
          resultFlag: "abnormal" as const,
          orderedBy: vetUser.id,
          completedAt: hoursAgo(4),
          followUpStatus: "not_required" as const,
          followUpAssignedTo: null,
          followUpDueAt: null,
          followUpNote: null,
        },
        {
          practiceId,
          patientId: p1.id,
          testName: "SDMA (Symetrický dimetylarginín)",
          resultValue: "22",
          unit: "ug/dl",
          referenceRangeLow: "0.000",
          referenceRangeHigh: "14.000",
          status: "completed" as const,
          resultFlag: "abnormal" as const,
          orderedBy: vetUser.id,
          completedAt: hoursAgo(4),
          followUpStatus: "not_required" as const,
          followUpAssignedTo: null,
          followUpDueAt: null,
          followUpNote: null,
        },
        {
          practiceId,
          patientId: p4.id,
          testName: "ALT (Alanínaminotransferáza)",
          resultValue: "188",
          unit: "U/L",
          referenceRangeLow: "10.000",
          referenceRangeHigh: "100.000",
          status: "completed" as const,
          resultFlag: "abnormal" as const,
          orderedBy: vetUser.id,
          completedAt: hoursAgo(6),
          followUpStatus: "open" as const,
          followUpAssignedTo: vetUser.id,
          followUpDueAt: hoursAgo(-12),
          followUpNote: "Zvýšené pečeňové enzýmy po medikácii. Odporúčané doplniť USG dutiny brušnej a nasadiť hepatoprotektíva (Hepato Force).",
        },

        // 4. FYZIOLOGICKÉ VÝSLEDKY SCHVÁLENÉ A UZAVRETÉ (Reviewed / Closed)
        {
          practiceId,
          patientId: p2.id,
          testName: "WBC (Biele krvinky - Leukocyty)",
          resultValue: "11.2",
          unit: "x10^9/l",
          referenceRangeLow: "6.000",
          referenceRangeHigh: "17.000",
          status: "reviewed" as const,
          resultFlag: "normal" as const,
          orderedBy: vetUser.id,
          completedAt: daysAgo(2),
          reviewedBy: vetUser.id,
          reviewedAt: daysAgo(2),
          followUpStatus: "completed" as const,
          followUpAssignedTo: vetUser.id,
          followUpCompletedBy: vetUser.id,
          followUpCompletedAt: daysAgo(2),
          followUpOutcome: "Krvný obraz v norme, zápalové parametre negatívne. Zviera prepustené do domáceho ošetrenia.",
        },
        {
          practiceId,
          patientId: p2.id,
          testName: "Glukóza v krvi (Fasting GLU)",
          resultValue: "5.1",
          unit: "mmol/l",
          referenceRangeLow: "3.900",
          referenceRangeHigh: "8.300",
          status: "reviewed" as const,
          resultFlag: "normal" as const,
          orderedBy: vetUser.id,
          completedAt: daysAgo(3),
          reviewedBy: vetUser.id,
          reviewedAt: daysAgo(3),
          followUpStatus: "not_required" as const,
          followUpAssignedTo: null,
          followUpDueAt: null,
          followUpNote: null,
        },
      ];

      // Vlož labResults
      const insertedLabs = await db.insert(labResults).values(newLabItems).returning();
      console.log(`  ✓ Úspešne vložených ${insertedLabs.length} laboratórnych výsledkov do schránky.`);

      // ───────────────────────────────────────────────────────────────────────
      // 5. Vloženie vzorových reportov z analyzátorov (lab_analyzer_reports)
      // ───────────────────────────────────────────────────────────────────────
      console.log("  🔬 Pripravujem reporty z analyzátorov (IDEXX, Fuji, Mindray)...");

      const analyzerReports = [
        // A. IDEXX Catalyst Dx (Biochemický profil) - Priradený k pacientovi, čaká na schválenie lekárom
        {
          practiceId,
          patientId: p1.id,
          clientId: p1.clientId,
          analyzerType: "IDEXX" as const,
          deviceModel: "Catalyst One Vet",
          sampleId: `CAT-${Math.floor(10000 + Math.random() * 90000)}`,
          sampleDate: hoursAgo(3),
          species: p1.species,
          fileName: "catalyst_one_run_senior_profile.xml",
          rawContent: "IDEXX Catalyst One Export v3.4\nSampleType: Serum\nPatient: " + p1.name,
          status: "ATTACHED" as const,
          abnormalCount: 3,
          criticalCount: 0,
          parsedResults: [
            { code: "ALB", name: "Albumín", value: 31, unit: "g/l", refLow: 25, refHigh: 44, flag: "NORMAL" as const, category: "BIOCHEMISTRY" as const },
            { code: "ALKP", name: "Alkalická fosfatáza", value: 85, unit: "U/l", refLow: 20, refHigh: 150, flag: "NORMAL" as const, category: "BIOCHEMISTRY" as const },
            { code: "ALT", name: "Alanínaminotransferáza", value: 145, unit: "U/l", refLow: 10, refHigh: 100, flag: "HIGH" as const, category: "BIOCHEMISTRY" as const },
            { code: "BUN", name: "Močovina (Urea)", value: 18.2, unit: "mmol/l", refLow: 5.7, refHigh: 12.9, flag: "HIGH" as const, category: "BIOCHEMISTRY" as const },
            { code: "CREA", name: "Kreatinín", value: 286, unit: "umol/l", refLow: 71, refHigh: 212, flag: "HIGH" as const, category: "BIOCHEMISTRY" as const },
            { code: "GLU", name: "Glukóza", value: 5.6, unit: "mmol/l", refLow: 3.9, refHigh: 8.3, flag: "NORMAL" as const, category: "BIOCHEMISTRY" as const },
            { code: "PHOS", name: "Anorganický fosfor", value: 1.82, unit: "mmol/l", refLow: 1.0, refHigh: 2.42, flag: "NORMAL" as const, category: "BIOCHEMISTRY" as const },
            { code: "TBIL", name: "Celkový bilirubín", value: 4.2, unit: "umol/l", refLow: 0.0, refHigh: 15.0, flag: "NORMAL" as const, category: "BIOCHEMISTRY" as const },
            { code: "TP", name: "Celkový proteín", value: 72, unit: "g/l", refLow: 52, refHigh: 82, flag: "NORMAL" as const, category: "BIOCHEMISTRY" as const },
            { code: "GLOB", name: "Globulín", value: 41, unit: "g/l", refLow: 23, refHigh: 52, flag: "NORMAL" as const, category: "BIOCHEMISTRY" as const },
          ],
          notes: "Kompletný biochemický profil seniora. Zvýšená močovina, kreatinín a mierna elevácia ALT.",
        },

        // B. IDEXX ProCyte Dx (Plný krvný obraz) - Priradený s kritickým nálezom
        {
          practiceId,
          patientId: p3.id,
          clientId: p3.clientId,
          analyzerType: "IDEXX" as const,
          deviceModel: "ProCyte Dx Hematology",
          sampleId: `PCY-${Math.floor(10000 + Math.random() * 90000)}`,
          sampleDate: hoursAgo(2),
          species: p3.species,
          fileName: "procyte_hematology_stat.xml",
          rawContent: "IDEXX ProCyte Dx Laser Flow Cytometry Export\nSampleType: Whole Blood (EDTA)",
          status: "ATTACHED" as const,
          abnormalCount: 4,
          criticalCount: 2,
          parsedResults: [
            { code: "RBC", name: "Erytrocyty", value: 2.85, unit: "x10^12/l", refLow: 5.5, refHigh: 8.5, flag: "CRITICAL" as const, category: "HEMATOLOGY" as const },
            { code: "HCT", name: "Hematokrit", value: 0.18, unit: "l/l", refLow: 0.37, refHigh: 0.55, flag: "CRITICAL" as const, category: "HEMATOLOGY" as const },
            { code: "HGB", name: "Hemoglobín", value: 62, unit: "g/l", refLow: 120, refHigh: 180, flag: "LOW" as const, category: "HEMATOLOGY" as const },
            { code: "MCV", name: "Stredný objem erytrocytu", value: 68.2, unit: "fl", refLow: 60, refHigh: 77, flag: "NORMAL" as const, category: "HEMATOLOGY" as const },
            { code: "WBC", name: "Leukocyty", value: 28.4, unit: "x10^9/l", refLow: 6.0, refHigh: 17.0, flag: "HIGH" as const, category: "HEMATOLOGY" as const },
            { code: "NEU", name: "Neutrofily", value: 22.1, unit: "x10^9/l", refLow: 3.0, refHigh: 11.5, flag: "HIGH" as const, category: "HEMATOLOGY" as const },
            { code: "LYM", name: "Lymfocyty", value: 3.2, unit: "x10^9/l", refLow: 1.0, refHigh: 4.8, flag: "NORMAL" as const, category: "HEMATOLOGY" as const },
            { code: "PLT", name: "Trombocyty", value: 32, unit: "x10^9/l", refLow: 175, refHigh: 500, flag: "CRITICAL" as const, category: "HEMATOLOGY" as const },
            { code: "RETIC", name: "Retikulocyty", value: 145, unit: "K/ul", refLow: 10, refHigh: 110, flag: "HIGH" as const, category: "HEMATOLOGY" as const },
          ],
          notes: "Ťažká regeneratívna anémia a trombocytopénia. Podozrenie na akútnu hemolýzu / stratu krvi.",
        },

        // C. Mindray BC-5000Vet - Nezaradený protokol (UNASSIGNED) z nočnej pohotovosti
        {
          practiceId,
          patientId: null,
          clientId: null,
          analyzerType: "MINDRAY" as const,
          deviceModel: "BC-5000 Vet",
          sampleId: `MR-${Math.floor(10000 + Math.random() * 90000)}`,
          sampleDate: hoursAgo(8),
          species: "canine",
          fileName: "MINDRAY_BC5000_RUN_0842.csv",
          rawContent: "MINDRAY BC-5000Vet Auto Hematology Analyzer Export\nID: 0842\nDate: 2026-09-05",
          status: "UNASSIGNED" as const,
          abnormalCount: 1,
          criticalCount: 0,
          parsedResults: [
            { code: "WBC", name: "Biele krvinky", value: 9.8, unit: "10^9/L", refLow: 6.0, refHigh: 17.0, flag: "NORMAL" as const, category: "HEMATOLOGY" as const },
            { code: "RBC", name: "Červené krvinky", value: 6.4, unit: "10^12/L", refLow: 5.5, refHigh: 8.5, flag: "NORMAL" as const, category: "HEMATOLOGY" as const },
            { code: "HGB", name: "Hemoglobín", value: 152, unit: "g/L", refLow: 120, refHigh: 180, flag: "NORMAL" as const, category: "HEMATOLOGY" as const },
            { code: "HCT", name: "Hematokrit", value: 0.44, unit: "L/L", refLow: 0.37, refHigh: 0.55, flag: "NORMAL" as const, category: "HEMATOLOGY" as const },
            { code: "PLT", name: "Krvné doštičky", value: 165, unit: "10^9/L", refLow: 175, refHigh: 500, flag: "LOW" as const, category: "HEMATOLOGY" as const },
          ],
          notes: "Vzorka z urgentného príjmu. Čaká na priradenie k pacientovi personálom ambulancie.",
        },

        // D. Fuji Dri-Chem 4000 - Schválený a uzavretý protokol (REVIEWED)
        {
          practiceId,
          patientId: p2.id,
          clientId: p2.clientId,
          analyzerType: "FUJI_DRI_CHEM" as const,
          deviceModel: "Dri-Chem NX500",
          sampleId: `FDC-${Math.floor(10000 + Math.random() * 90000)}`,
          sampleDate: daysAgo(2),
          species: p2.species,
          fileName: "fuji_nx500_preop.csv",
          rawContent: "FUJI DRI-CHEM NX500 DATA\nPatient: " + p2.name,
          status: "REVIEWED" as const,
          reviewedById: vetUser.id,
          reviewedAt: daysAgo(2),
          abnormalCount: 0,
          criticalCount: 0,
          parsedResults: [
            { code: "GPT/ALT", name: "ALT Pečeň", value: 38, unit: "U/L", refLow: 10, refHigh: 100, flag: "NORMAL" as const, category: "BIOCHEMISTRY" as const },
            { code: "GOT/AST", name: "AST", value: 29, unit: "U/L", refLow: 15, refHigh: 55, flag: "NORMAL" as const, category: "BIOCHEMISTRY" as const },
            { code: "ALP", name: "Alkalická fosfatáza", value: 65, unit: "U/L", refLow: 23, refHigh: 212, flag: "NORMAL" as const, category: "BIOCHEMISTRY" as const },
            { code: "GLU", name: "Glukóza", value: 5.2, unit: "mmol/L", refLow: 3.9, refHigh: 8.3, flag: "NORMAL" as const, category: "BIOCHEMISTRY" as const },
            { code: "CRE", name: "Kreatinín", value: 88, unit: "umol/L", refLow: 44, refHigh: 159, flag: "NORMAL" as const, category: "BIOCHEMISTRY" as const },
          ],
          notes: "Predoperačný skríning pred stomatológiou. Nález fyziologický, lekár schválil zákrok.",
        },
      ];

      await db.insert(labAnalyzerReports).values(analyzerReports);
      console.log(`  ✓ Úspešne vložené ${analyzerReports.length} protokoly analyzátorov (IDEXX, Fuji, Mindray).`);
    }

    console.log("\n🎉 Všetky demo laboratórne dáta boli úspešne vygenerované!");
  } catch (error) {
    console.error("❌ Chyba pri generovaní demo lab dát:", error);
  } finally {
    await client.end();
  }
}

main();
