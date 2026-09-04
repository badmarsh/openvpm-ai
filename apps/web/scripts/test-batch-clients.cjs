const { drizzle } = require('drizzle-orm/postgres-js');
const { sql } = require('drizzle-orm');
const postgres = require('postgres');
const schema = require('@openpims/db');
const { fbQuery, decodeWin1250, parseBankaK, withFirebird } = require('../lib/import/vetsoftware-v2-extractor');
const { migrationImportFingerprint } = require('../lib/import/fingerprint');

const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const client = postgres('postgresql://openpims:openpims@localhost:5434/openvpm_ai');
const db = drizzle(client, { schema });

async function main() {
  console.log('Testing client batch insert...');
  await withFirebird(async (fbDb) => {
    const rawClients = await fbQuery(fbDb, "SELECT FIRST 10 KOD_KADO, TITUL, NAZEV_KADO, POZNAMKA_KADO, MESTO_K, BANKA_K, TELEFON, MOBIL, EMAIL FROM TAB005 WHERE KOD_KADO > 0 ORDER BY KOD_KADO");
    console.log('Fetched raw clients:', rawClients.length);
    const valuesToInsert = rawClients.map((r) => {
      const extId = String(r.KOD_KADO);
      const priezvisko = decodeWin1250(r.NAZEV_KADO);
      const meno = decodeWin1250(r.POZNAMKA_KADO);
      const ulica = decodeWin1250(r.MESTO_K);
      const bankaK = decodeWin1250(r.BANKA_K);
      const { city, zip } = parseBankaK(bankaK);
      const mobil = decodeWin1250(r.MOBIL);
      const tel = decodeWin1250(r.TELEFON);
      const email = decodeWin1250(r.EMAIL) || null;
      const primaryPhone = mobil || tel || null;

      return {
        practiceId: PRACTICE_ID,
        firstName: meno || (priezvisko ? "" : "Neznáme"),
        lastName: priezvisko || meno || "Klient",
        phone: primaryPhone,
        email: email && email.includes("@") ? email : null,
        address: ulica || null,
        city: city || null,
        zip: zip || null,
        externalSource: "vetsoftware_v2",
        externalId: extId,
        importFingerprint: migrationImportFingerprint("clients", [PRACTICE_ID, "vetsoftware_v2", extId]),
      };
    });

    console.log('Sample client to insert:', valuesToInsert[0]);
    try {
      const inserted = await db
        .insert(schema.clients)
        .values(valuesToInsert)
        .onConflictDoNothing({
          target: [schema.clients.practiceId, schema.clients.externalSource, schema.clients.externalId],
          where: sql`external_source is not null and external_id is not null`,
        })
        .returning({ id: schema.clients.id });
      console.log('Successfully inserted clients count:', inserted.length);
    } catch(e) {
      console.error('Insert error details:', e.message, e);
    }
  });
  await client.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
