/**
 * import-final-entities.ts
 *
 * 1. TAB065 -> purchase_orders (1 393 nákupných faktúr s väzbou na suppliers)
 * 2. TAB029 -> historical_appointments (3 ambulantné objednávky z r. 2026 pre Ella, Viliam, Merle)
 * 3. TAB026 -> treatment_templates (195 diagnóz a klinických nálezov v /settings)
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and } from "drizzle-orm";
import * as schema from "@openpims/db";
import {
  suppliers,
  purchaseOrders,
  historicalAppointments,
  treatmentTemplates,
  patients,
  clients,
} from "@openpims/db";
import {
  fbQuery,
  decodeWin1250,
  readTextBlob,
  withFirebird,
} from "../lib/import/vetsoftware-v2-extractor";
import { migrationImportFingerprint } from "../lib/import/fingerprint";

const PRACTICE_ID = "5c4ebbbc-90e1-457a-87a7-7895f560317d";
const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://openpims:openpims@localhost:5434/openvpm_ai";

const client = postgres(DB_URL);
const db = drizzle(client, { schema });

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  IMPORT ZÁVEREČNÝCH ENTÍT (Nákupy, Objednávky, Diagnózy)         ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  await withFirebird(async (fbDb) => {
    // ══════════════════════════════════════════════════════════════════════
    // FÁZA 1: Nákupné faktúry (TAB065 -> purchase_orders)
    // ══════════════════════════════════════════════════════════════════════
    console.log("── 1. Nákupné faktúry od dodávateľov (TAB065 -> purchase_orders) ──");

    // Zabezpečíme dodávateľa pre "Voľný nákup" (KOD_FIRMY = 0)
    let directSupplier = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.practiceId, PRACTICE_ID),
          eq(suppliers.name, "Voľný nákup / Priamy nákup")
        )
      )
      .limit(1);

    if (!directSupplier[0]) {
      const inserted = await db
        .insert(suppliers)
        .values({
          practiceId: PRACTICE_ID,
          name: "Voľný nákup / Priamy nákup",
          notes: "Nákupy v hotovosti bez viazanosti na zmluvného distribútora",
        })
        .returning({ id: suppliers.id });
      directSupplier = inserted;
    }
    const directSupplierId = directSupplier[0].id;

    // Načítame existujúcich dodávateľov do mapy
    const allSuppliers = await db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.practiceId, PRACTICE_ID));

    // Načítame TAB064 pre mapovanie KOD_FIRMY -> NAZEV_FIRMY
    const rawFirms = await fbQuery<any>(fbDb, "SELECT KOD_FIRMY, NAZEV_FIRMY FROM TAB064");
    const firmIdToSupplierId = new Map<number, string>();
    for (const f of rawFirms) {
      const name = decodeWin1250(f.NAZEV_FIRMY).trim().toLowerCase();
      if (f.KOD_FIRMY === 0 || name === "voľný nákup") {
        firmIdToSupplierId.set(f.KOD_FIRMY, directSupplierId);
        continue;
      }
      const matched = allSuppliers.find(
        (s) => s.name.toLowerCase() === name || s.name.toLowerCase().startsWith(name.slice(0, 10))
      );
      if (matched) {
        firmIdToSupplierId.set(f.KOD_FIRMY, matched.id);
      }
    }

    // Načítame faktúry z TAB065
    const rawInvoices = await fbQuery<any>(
      fbDb,
      `SELECT ID_UCET, ID_FIRMY, DAT_VYSTAV, CAS_VYSTAV, CELSDPH, C_CE, CIS_DOK, POZNAMKA
       FROM TAB065
       WHERE (VYMAZ = 0 OR VYMAZ IS NULL)
       ORDER BY ID_UCET ASC`
    );

    // Zistíme koľko už máme v DB (idempotentnosť)
    const existingPOs = await client`SELECT count(*) FROM purchase_orders WHERE practice_id = ${PRACTICE_ID}`;
    const poCount = Number(existingPOs[0].count);

    let poInserted = 0;
    let poSkipped = 0;

    if (poCount > 0) {
      console.log(`V tabuľke purchase_orders už existuje ${poCount} záznamov. Preskakujem vkladanie.`);
      poSkipped = rawInvoices.length;
    } else {
      const BATCH_SIZE = 200;
      for (let i = 0; i < rawInvoices.length; i += BATCH_SIZE) {
        const chunk = rawInvoices.slice(i, i + BATCH_SIZE);
        const toInsert: any[] = [];

        for (const inv of chunk) {
          const supplierId = firmIdToSupplierId.get(inv.ID_FIRMY) || directSupplierId;
          const totalAmount = Math.max(0, Number(inv.CELSDPH) || Number(inv.C_CE) || 0);

          let createdAt = new Date();
          if (inv.DAT_VYSTAV) {
            createdAt = new Date(inv.DAT_VYSTAV);
            if (inv.CAS_VYSTAV && typeof inv.CAS_VYSTAV === "string") {
              const [h, m] = inv.CAS_VYSTAV.split(":").map(Number);
              if (!isNaN(h) && !isNaN(m)) {
                createdAt.setHours(h, m);
              }
            }
          }

          toInsert.push({
            practiceId: PRACTICE_ID,
            supplierId,
            status: "received" as const,
            total: totalAmount.toFixed(2),
            createdAt,
            updatedAt: createdAt,
          });
        }

        if (toInsert.length > 0) {
          await db.insert(purchaseOrders).values(toInsert);
          poInserted += toInsert.length;
        }
      }
      console.log(`Hotovo: Úspešne vložených ${poInserted} nákupných faktúr.\n`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // FÁZA 2: Objednávky / Termíny (TAB029 -> historical_appointments)
    // ══════════════════════════════════════════════════════════════════════
    console.log("── 2. Objednávky a termíny (TAB029 -> historical_appointments) ──");
    const rawOrders = await fbQuery<any>(
      fbDb,
      "SELECT ID_OBJ, ID_PACIENTA, ID_KLIENT, DATUMO, CASO, CASD, ORDINOVAL, POZNAMKA, VYMAZ FROM TAB029 WHERE VYMAZ = 0 OR VYMAZ IS NULL ORDER BY ID_OBJ"
    );

    // Map pacientov a klientov
    const patientMap = new Map<string, string>();
    const patRows = await db
      .select({ id: patients.id, externalId: patients.externalId })
      .from(patients)
      .where(eq(patients.practiceId, PRACTICE_ID));
    for (const p of patRows) {
      if (p.externalId) patientMap.set(p.externalId, p.id);
    }

    const clientMap = new Map<string, string>();
    const cliRows = await db
      .select({ id: clients.id, externalId: clients.externalId })
      .from(clients)
      .where(eq(clients.practiceId, PRACTICE_ID));
    for (const c of cliRows) {
      if (c.externalId) clientMap.set(c.externalId, c.id);
    }

    let ordersInserted = 0;
    let ordersSkipped = 0;

    for (const ord of rawOrders) {
      const extId = `tab029_${ord.ID_OBJ}`;
      const patId = patientMap.get(String(ord.ID_PACIENTA));
      const cliId = clientMap.get(String(ord.ID_KLIENT));

      if (!patId || !cliId) {
        ordersSkipped++;
        continue;
      }

      let startDate = ord.DATUMO ? new Date(ord.DATUMO) : new Date();
      if (ord.CASO && typeof ord.CASO === "string") {
        const [h, m] = ord.CASO.split(":").map(Number);
        if (!isNaN(h) && !isNaN(m)) startDate.setHours(h, m, 0, 0);
      }

      let endDate = ord.DATUMO ? new Date(ord.DATUMO) : new Date(startDate.getTime() + 3600000);
      if (ord.CASD && typeof ord.CASD === "string") {
        const [h, m] = ord.CASD.split(":").map(Number);
        if (!isNaN(h) && !isNaN(m)) endDate.setHours(h, m, 0, 0);
      }
      if (endDate <= startDate) {
        endDate = new Date(startDate.getTime() + 3600000);
      }

      const doctor = decodeWin1250(ord.ORDINOVAL).trim() || "MVDr. Zdeněk Drotár";
      const fingerprint = migrationImportFingerprint("historical_appointments", [
        PRACTICE_ID,
        "vetsoftware_v2",
        extId,
      ]);

      const inserted = await db
        .insert(historicalAppointments)
        .values({
          practiceId: PRACTICE_ID,
          patientId: patId,
          clientId: cliId,
          startedAt: startDate,
          endedAt: endDate,
          status: "completed" as const,
          appointmentType: "Ambulantná objednávka",
          providerDisplayName: doctor.slice(0, 255),
          reason: "Objednané vyšetrenie",
          externalSource: "vetsoftware_v2",
          externalId: extId,
          importFingerprint: fingerprint,
        })
        .onConflictDoNothing({
          target: [
            historicalAppointments.practiceId,
            historicalAppointments.externalSource,
            historicalAppointments.externalId,
          ],
        })
        .returning({ id: historicalAppointments.id });

      if (inserted.length > 0) {
        ordersInserted++;
        console.log(`  ✓ Objednávka #${ord.ID_OBJ}: Pacient ID ${ord.ID_PACIENTA}, Dátum: ${startDate.toISOString().slice(0, 10)} ${ord.CASO}–${ord.CASD} (${doctor})`);
      } else {
        ordersSkipped++;
      }
    }
    console.log(`Hotovo: Vložených ${ordersInserted} objednávok (preskočených ${ordersSkipped}).\n`);

    // ══════════════════════════════════════════════════════════════════════
    // FÁZA 3: Diagnózy a klinické nálezy (TAB026 -> treatment_templates)
    // ══════════════════════════════════════════════════════════════════════
    console.log("── 3. Diagnózy a klinické nálezy (TAB026 -> treatment_templates) ──");
    const rawDiagnoses = await fbQuery<any>(
      fbDb,
      "SELECT KOD_PROBLEMU, NAZEV_PROBLEMU FROM TAB026 WHERE (VYMAZ = 0 OR VYMAZ IS NULL) AND TRIM(NAZEV_PROBLEMU) <> '' ORDER BY KOD_PROBLEMU"
    );

    // Načítame existujúce šablóny pre prax
    const existingTemplates = await db
      .select({ name: treatmentTemplates.name })
      .from(treatmentTemplates)
      .where(eq(treatmentTemplates.practiceId, PRACTICE_ID));
    const existingNames = new Set(existingTemplates.map((t) => t.name.toLowerCase()));

    let diagInserted = 0;
    let diagSkipped = 0;

    for (const d of rawDiagnoses) {
      const diagName = decodeWin1250(d.NAZEV_PROBLEMU).trim();
      if (!diagName || existingNames.has(diagName.toLowerCase())) {
        diagSkipped++;
        continue;
      }

      await db.insert(treatmentTemplates).values({
        practiceId: PRACTICE_ID,
        name: diagName.slice(0, 255),
        category: "Klinický nález / Diagnóza",
        description: `Klinická diagnóza / problém z číselníka praxe (kód ${d.KOD_PROBLEMU})`,
        isActive: true,
      });

      existingNames.add(diagName.toLowerCase());
      diagInserted++;
    }
    console.log(`Hotovo: Vložených ${diagInserted} diagnóz do šablón (preskočených ${diagSkipped}).\n`);
  });

  // ══════════════════════════════════════════════════════════════════════
  // Finálna bilancia
  // ══════════════════════════════════════════════════════════════════════
  const stats = await client`
    SELECT
      (SELECT count(*) FROM purchase_orders WHERE practice_id = ${PRACTICE_ID})::int AS total_pos,
      (SELECT count(*) FROM historical_appointments WHERE practice_id = ${PRACTICE_ID})::int AS total_appointments,
      (SELECT count(*) FROM treatment_templates WHERE practice_id = ${PRACTICE_ID})::int AS total_templates,
      (SELECT count(*) FROM suppliers WHERE practice_id = ${PRACTICE_ID})::int AS total_suppliers
  `;

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  STAV PO DOKONČENÍ                                               ║");
  console.log("╠══════════════════════════════════════════════════════════════════╣");
  console.log(`║  Nákupné faktúry (purchase_orders):   ${String(stats[0].total_pos).padStart(5)}                  ║`);
  console.log(`║  Historické objednávky/termíny:       ${String(stats[0].total_appointments).padStart(5)}                  ║`);
  console.log(`║  Šablóny diagnóz (treatment_templates):${String(stats[0].total_templates).padStart(5)}                  ║`);
  console.log(`║  Dodávatelia (suppliers):             ${String(stats[0].total_suppliers).padStart(5)}                  ║`);
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
