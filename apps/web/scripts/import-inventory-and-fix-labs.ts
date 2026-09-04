/**
 * import-inventory-and-fix-labs.ts
 *
 * 1. Opraví 9 laboratórnych parametrov v external_lab_observations
 *    (názvy a jednotky z TAB024, referenčné hodnoty z TAB023).
 * 2. Naimportuje dodávateľov z TAB064 do existujúcej tabuľky suppliers v /inventory.
 * 3. Naimportuje katalóg produktov a skladové zásoby z TAB068 do existujúcej tabuľky products v /inventory.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "@openpims/db";
import { products, suppliers, externalLabObservations } from "@openpims/db";
import { fbQuery, decodeWin1250, withFirebird } from "../lib/import/vetsoftware-v2-extractor";
import { migrationImportFingerprint } from "../lib/import/fingerprint";

const PRACTICE_ID = "5c4ebbbc-90e1-457a-87a7-7895f560317d";
const DB_URL = process.env.DATABASE_URL ?? "postgresql://openpims:openpims@localhost:5434/openvpm_ai";

const client = postgres(DB_URL);
const db = drizzle(client, { schema });

function detectCategory(name: string): "medication" | "preventive" | "supplement" | "food" | "supply" {
  const lower = name.toLowerCase();
  if (
    lower.includes("vakc") ||
    lower.includes("biocan") ||
    lower.includes("biofel") ||
    lower.includes("pestorin") ||
    lower.includes("caniquantel") ||
    lower.includes("bravecto") ||
    lower.includes("nexgard") ||
    lower.includes("frontline") ||
    lower.includes("advocate") ||
    lower.includes("drontal") ||
    lower.includes("parazit") ||
    lower.includes("odčerv") ||
    lower.includes("ockov")
  ) {
    return "preventive";
  }
  if (
    lower.includes("acana") ||
    lower.includes("royal") ||
    lower.includes("diet") ||
    lower.includes("granul") ||
    lower.includes("krmiv") ||
    lower.includes("konzerv") ||
    lower.includes("pro plan") ||
    lower.includes("hills") ||
    lower.includes("purina")
  ) {
    return "food";
  }
  if (
    lower.includes("vitamin") ||
    lower.includes("gelacan") ||
    lower.includes("aptus") ||
    lower.includes("pasta") ||
    lower.includes("calcium") ||
    lower.includes("doplnok") ||
    lower.includes("nutri") ||
    lower.includes("chondro")
  ) {
    return "supplement";
  }
  if (
    lower.includes("inj") ||
    lower.includes("tbl") ||
    lower.includes("sol") ||
    lower.includes("ung") ||
    lower.includes("gtt") ||
    lower.includes("sir") ||
    lower.includes("amp") ||
    lower.includes("cps") ||
    lower.includes("roztok") ||
    lower.includes("susp") ||
    lower.includes("antibiot") ||
    lower.includes("spasmo") ||
    lower.includes("atropin") ||
    lower.includes("sedat") ||
    lower.includes("anest") ||
    lower.includes("liek")
  ) {
    return "medication";
  }
  return "supply";
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  IMPORT DO EXISTUJÚCICH MODULOV OpenVPM (Sklad & Laboratórium)  ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  await withFirebird(async (fbDb) => {
    // ══════════════════════════════════════════════════════════════════════
    // KROK 1: Oprava názvov a jednotiek v external_lab_observations
    // ══════════════════════════════════════════════════════════════════════
    console.log("── 1. Oprava laboratórnych parametrov (TAB024 + TAB023) ────────");
    const rawParams = await fbQuery<any>(
      fbDb,
      "SELECT ID_UKAZ, NAZEV, MJ FROM TAB024 WHERE VYMAZ = 0 OR VYMAZ IS NULL"
    );
    const paramMap = new Map<number, { name: string; unit: string }>();
    for (const p of rawParams) {
      paramMap.set(p.ID_UKAZ, {
        name: decodeWin1250(p.NAZEV).trim(),
        unit: decodeWin1250(p.MJ).trim(),
      });
    }

    const rawRanges = await fbQuery<any>(
      fbDb,
      "SELECT ID_UKAZ, ID_ZVIRE, MINH, MAXH FROM TAB023 WHERE VYMAZ = 0 OR VYMAZ IS NULL"
    );
    const rangeMap = new Map<number, { min: number; max: number }>();
    for (const r of rawRanges) {
      if (!rangeMap.has(r.ID_UKAZ)) {
        rangeMap.set(r.ID_UKAZ, { min: Number(r.MINH), max: Number(r.MAXH) });
      }
    }

    const existingObs = await db
      .select({
        id: externalLabObservations.id,
        sortOrder: externalLabObservations.sortOrder,
        value: externalLabObservations.value,
      })
      .from(externalLabObservations)
      .where(eq(externalLabObservations.practiceId, PRACTICE_ID));

    let fixedLabsCount = 0;
    for (const obs of existingObs) {
      const ukazId = obs.sortOrder;
      const paramInfo = paramMap.get(ukazId);
      if (paramInfo) {
        const range = rangeMap.get(ukazId);
        const refRangeStr = range ? `${range.min} – ${range.max} ${paramInfo.unit}`.trim() : null;

        let flag: string | null = null;
        const numVal = obs.value ? parseFloat(obs.value) : NaN;
        if (!isNaN(numVal) && range) {
          if (numVal < range.min) flag = "L";
          else if (numVal > range.max) flag = "H";
          else flag = "N";
        }

        await db
          .update(externalLabObservations)
          .set({
            name: paramInfo.name,
            unit: paramInfo.unit || null,
            referenceRange: refRangeStr,
            flag,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(externalLabObservations.practiceId, PRACTICE_ID),
              eq(externalLabObservations.id, obs.id)
            )
          );
        fixedLabsCount++;
        console.log(
          `  ✓ Parameter ${ukazId}: "${paramInfo.name}" [${paramInfo.unit}] | Hodnota: ${obs.value} | Rozsah: ${refRangeStr ?? "N/A"} | Flag: ${flag ?? "N/A"}`
        );
      }
    }
    console.log(`Hotovo: Opravených ${fixedLabsCount} z ${existingObs.length} lab parametrov.\n`);

    // ══════════════════════════════════════════════════════════════════════
    // KROK 2: Import dodávateľov do tabuľky suppliers v /inventory
    // ══════════════════════════════════════════════════════════════════════
    console.log("── 2. Import dodávateľov z TAB064 do /inventory (suppliers) ───");
    const rawSuppliers = await fbQuery<any>(
      fbDb,
      "SELECT * FROM TAB064 WHERE VYMAZ = 0 OR VYMAZ IS NULL ORDER BY KOD_FIRMY"
    );

    // Get existing suppliers to prevent duplicates
    const existingSuppliers = await db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.practiceId, PRACTICE_ID));
    const existingSupplierNames = new Set(existingSuppliers.map((s) => s.name.toLowerCase()));

    let suppliersInserted = 0;
    let suppliersSkipped = 0;

    for (const s of rawSuppliers) {
      const name = decodeWin1250(s.NAZEV_FIRMY).trim();
      if (!name || name.toLowerCase() === "voľný nákup") {
        suppliersSkipped++;
        continue;
      }

      if (existingSupplierNames.has(name.toLowerCase())) {
        suppliersSkipped++;
        continue;
      }

      const street = decodeWin1250(s.ULICE_FIRMY).trim();
      const city = decodeWin1250(s.MESTO_FIRMY).trim();
      const psc = decodeWin1250(s.PSC_FIRMY).trim();
      const fullAddress = [street, city, psc].filter(Boolean).join(", ") || null;

      const rawPhone = (decodeWin1250(s.TEL_FIRMY) || decodeWin1250(s.MOBIL_FIRMY)).trim();
      const phone = rawPhone ? rawPhone.slice(0, 32) : null;

      const emailRaw = decodeWin1250(s.EMAIL_FIRMY).trim();
      const email = emailRaw.includes("@") ? emailRaw.slice(0, 255) : null;

      const ico = decodeWin1250(s.ICO_FIRMY).trim();
      const dic = decodeWin1250(s.DIC_FIRMY).trim();
      const worker = decodeWin1250(s.PRACOVNIK_FIRMY).trim();
      const notesParts: string[] = [];
      if (ico) notesParts.push(`IČO: ${ico}`);
      if (dic) notesParts.push(`DIČ: ${dic}`);
      if (worker) notesParts.push(`Kontakt: ${worker}`);
      const notes = notesParts.join(" | ") || null;

      await db.insert(suppliers).values({
        practiceId: PRACTICE_ID,
        name: name.slice(0, 255),
        contactEmail: email,
        phone,
        address: fullAddress,
        notes,
      });

      existingSupplierNames.add(name.toLowerCase());
      suppliersInserted++;
      console.log(`  ✓ Pridaný dodávateľ: ${name} (${city || "bez adresy"})`);
    }
    console.log(`Hotovo: Vložených ${suppliersInserted} dodávateľov (preskočených ${suppliersSkipped}).\n`);

    // ══════════════════════════════════════════════════════════════════════
    // KROK 3: Import katalógu produktov a zásob z TAB068 do products
    // ══════════════════════════════════════════════════════════════════════
    console.log("── 3. Import produktov a zásob z TAB068 do /inventory (products) ─");

    // Načítame všetky riadky zoradené podľa ID_SOUPIS ASC (novšie prepíšu staršie)
    const rawProducts = await fbQuery<any>(
      fbDb,
      `SELECT ID_POLOZ, ID_ZBOZI, NAZEV_ZBOZI, PRODEJ, NAKUP, FYZ_ZASOBA, ID_SOUPIS
       FROM TAB068
       WHERE (VYMAZ = 0 OR VYMAZ IS NULL) AND TRIM(NAZEV_ZBOZI) <> ''
       ORDER BY ID_SOUPIS ASC, ID_POLOZ ASC`
    );

    // Zoskupíme podľa ID_ZBOZI (vezmeme najnovší záznam)
    const latestProductMap = new Map<number, any>();
    for (const r of rawProducts) {
      if (r.ID_ZBOZI > 0) {
        latestProductMap.set(r.ID_ZBOZI, r);
      }
    }

    console.log(`Nájdených ${rawProducts.length} záznamov v histórii, z toho ${latestProductMap.size} unikátnych produktov.`);

    let productsInserted = 0;
    let productsSkipped = 0;

    const existingProductRows = await db
      .select({ externalId: products.externalId })
      .from(products)
      .where(
        and(
          eq(products.practiceId, PRACTICE_ID),
          eq(products.externalSource, "vetsoftware_v2")
        )
      );
    const existingExtIds = new Set(existingProductRows.map((r) => r.externalId).filter(Boolean));

    const BATCH_SIZE = 100;
    const items = Array.from(latestProductMap.values());

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      const valuesToInsert: any[] = [];

      for (const p of chunk) {
        const rawName = decodeWin1250(p.NAZEV_ZBOZI).trim();
        if (!rawName) continue;

        const cleanName = rawName.replace(/\s*\[.*?\]\s*$/, "").trim() || rawName;
        const extId = String(p.ID_ZBOZI);

        if (existingExtIds.has(extId)) {
          productsSkipped++;
          continue;
        }

        const unitPriceNum = Math.max(0, Number(p.PRODEJ) || 0);
        const costPriceNum = p.NAKUP != null && Number(p.NAKUP) > 0 ? Number(p.NAKUP) : null;
        const stockQty = Math.max(0, Math.round(Number(p.FYZ_ZASOBA) || 0));

        const category = detectCategory(cleanName);
        const fingerprint = migrationImportFingerprint("products", [PRACTICE_ID, "vetsoftware_v2", extId]);

        valuesToInsert.push({
          practiceId: PRACTICE_ID,
          name: cleanName.slice(0, 255),
          sku: `SKU-${String(p.ID_ZBOZI).padStart(5, "0")}`,
          category,
          unitPrice: unitPriceNum.toFixed(2),
          costPrice: costPriceNum != null ? costPriceNum.toFixed(2) : null,
          stockQuantity: stockQty,
          reorderPoint: 5,
          taxable: true,
          inventoryTracked: true,
          externalSource: "vetsoftware_v2",
          externalId: extId,
          importFingerprint: fingerprint,
        });
      }

      if (valuesToInsert.length > 0) {
        try {
          const inserted = await db
            .insert(products)
            .values(valuesToInsert)
            .returning({ id: products.id });

          for (const v of valuesToInsert) {
            existingExtIds.add(v.externalId);
          }

          productsInserted += inserted.length;
        } catch (err: any) {
          console.error(`Chyba dávky produktov (${i}):`, err.cause?.message || err.message);
        }
      }
    }

    console.log(`Hotovo: Vložených ${productsInserted} nových produktov (preskočených ${productsSkipped}).\n`);
  });

  // ══════════════════════════════════════════════════════════════════════
  // Finálna kontrola databázy
  // ══════════════════════════════════════════════════════════════════════
  const stats = await client`
    SELECT
      (SELECT count(*) FROM suppliers WHERE practice_id = ${PRACTICE_ID})::int AS total_suppliers,
      (SELECT count(*) FROM products WHERE practice_id = ${PRACTICE_ID})::int AS total_products,
      (SELECT count(*) FROM products WHERE practice_id = ${PRACTICE_ID} AND stock_quantity > 0)::int AS in_stock_products,
      (SELECT count(*) FROM external_lab_observations WHERE practice_id = ${PRACTICE_ID} AND name NOT LIKE 'Ukazovateľ%')::int AS named_labs
  `;

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  FINÁLNY STAV PO IMPORTE                                         ║");
  console.log("╠══════════════════════════════════════════════════════════════════╣");
  console.log(`║  Dodávatelia (/inventory):     ${String(stats[0].total_suppliers).padStart(5)}                             ║`);
  console.log(`║  Produkty celkom (/inventory): ${String(stats[0].total_products).padStart(5)}                             ║`);
  console.log(`║  Produkty na sklade (> 0 ks):  ${String(stats[0].in_stock_products).padStart(5)}                             ║`);
  console.log(`║  Pomenované lab parametre:     ${String(stats[0].named_labs).padStart(5)} / 9                          ║`);
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
