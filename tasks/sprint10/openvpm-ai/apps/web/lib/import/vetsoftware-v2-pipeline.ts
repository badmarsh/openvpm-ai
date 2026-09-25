import crypto from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  clients,
  patients,
  patientWeights,
  vaccinationRecords,
  soapNotes,
  legacyFinancialDocuments,
  legacyFinancialLineItems,
  legacyFinancialPayments,
  legacyFinancialAllocations,
  externalPrescriptions,
  externalLabReports,
  externalLabObservations,
  historicalAppointments,
  historicalDocuments,
  files,
  users,
} from "@openpims/db";
import { migrationImportFingerprint } from "./fingerprint";
import {
  fbQuery,
  decodeWin1250,
  readTextBlob,
  readBinaryBlob,
  isPatientDeceased,
  parseBankaK,
  loadV2Lookups,
  withFirebird,
} from "./vetsoftware-v2-extractor";
import {
  normalizeSlovakSex,
  normalizeSlovakSpecies,
} from "./vetsoftware-v2-adapter";

export interface ImportOptions {
  importClients?: boolean;
  importPatients?: boolean;
  importWeights?: boolean;
  importVaccinations?: boolean;
  importSoapNotes?: boolean;
  importFinancials?: boolean;
  importLabReports?: boolean;
  importAttachments?: boolean;
  importPrescriptions?: boolean;   // TAB027 + TAB028 → external_prescriptions
  importHospitalizations?: boolean; // TAB052 → historical_appointments
  importReceivables?: boolean;      // TAB077 → legacy_financial_payments + allocations
}

export interface ImportProgressReport {
  success: boolean;
  durationMs: number;
  clients: { total: number; inserted: number; skipped: number };
  patients: { total: number; inserted: number; deceased: number; skipped: number };
  weights: { total: number; inserted: number; skipped: number };
  vaccinations: { total: number; inserted: number; skipped: number };
  soapNotes: { total: number; inserted: number; skipped: number };
  financials: { total: number; inserted: number; skipped: number };
  lineItems: { total: number; inserted: number; skipped: number };
  labReports: { total: number; inserted: number; skipped: number };
  attachments: { total: number; inserted: number; skipped: number };
  prescriptions: { total: number; inserted: number; skipped: number };
  hospitalizations: { total: number; inserted: number; skipped: number };
  receivables: { total: number; inserted: number; skipped: number };
  errors: string[];
}

/**
 * Finds or creates a system migration user for attribution in the practice
 */
export async function getOrCreateMigrationUser(
  db: PostgresJsDatabase<any>,
  practiceId: string,
  fallbackUserId?: string,
): Promise<{ id: string; name: string }> {
  if (fallbackUserId) {
    const user = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.practiceId, practiceId), eq(users.id, fallbackUserId)))
      .limit(1);
    if (user[0]) {
      return { id: user[0].id, name: user[0].name || "Admin" };
    }
  }

  // Find any active practice user
  const practiceUser = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.practiceId, practiceId))
    .limit(1);

  if (practiceUser[0]) {
    return { id: practiceUser[0].id, name: practiceUser[0].name || "MVDr. Sýkora" };
  }

  throw new Error(`Nenašiel sa žiadny používateľ pre prax ${practiceId}.`);
}

/**
 * Builds externalId -> UUID map for clients
 */
export async function getClientExternalIdMap(
  db: PostgresJsDatabase<any>,
  practiceId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: clients.id, externalId: clients.externalId })
    .from(clients)
    .where(
      and(
        eq(clients.practiceId, practiceId),
        eq(clients.externalSource, "vetsoftware_v2"),
      ),
    );
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.externalId) {
      map.set(r.externalId, r.id);
    }
  }
  return map;
}

/**
 * Builds externalId -> UUID map for patients
 */
export async function getPatientExternalIdMap(
  db: PostgresJsDatabase<any>,
  practiceId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: patients.id, externalId: patients.externalId })
    .from(patients)
    .where(
      and(
        eq(patients.practiceId, practiceId),
        eq(patients.externalSource, "vetsoftware_v2"),
      ),
    );
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.externalId) {
      map.set(r.externalId, r.id);
    }
  }
  return map;
}

/**
 * Executes full migration from Firebird 2.5 to PostgreSQL
 */
export async function runFullV2Migration(
  db: PostgresJsDatabase<any>,
  practiceId: string,
  adminUserId: string,
  options: ImportOptions = {
    importClients: true,
    importPatients: true,
    importWeights: true,
    importVaccinations: true,
    importSoapNotes: true,
    importFinancials: true,
    importLabReports: true,
    importAttachments: true,
    importPrescriptions: true,
    importHospitalizations: true,
    importReceivables: true,
  },
): Promise<ImportProgressReport> {
  const start = Date.now();
  const report: ImportProgressReport = {
    success: true,
    durationMs: 0,
    clients: { total: 0, inserted: 0, skipped: 0 },
    patients: { total: 0, inserted: 0, deceased: 0, skipped: 0 },
    weights: { total: 0, inserted: 0, skipped: 0 },
    vaccinations: { total: 0, inserted: 0, skipped: 0 },
    soapNotes: { total: 0, inserted: 0, skipped: 0 },
    financials: { total: 0, inserted: 0, skipped: 0 },
    lineItems: { total: 0, inserted: 0, skipped: 0 },
    labReports: { total: 0, inserted: 0, skipped: 0 },
    attachments: { total: 0, inserted: 0, skipped: 0 },
    prescriptions: { total: 0, inserted: 0, skipped: 0 },
    hospitalizations: { total: 0, inserted: 0, skipped: 0 },
    receivables: { total: 0, inserted: 0, skipped: 0 },
    errors: [],
  };

  const migrationUser = await getOrCreateMigrationUser(db, practiceId, adminUserId);

  await withFirebird(async (fbDb) => {
    const lookups = await loadV2Lookups(fbDb);

    // =========================================================================
    // FÁZA 1: Majitelia (Klienti)
    // =========================================================================
    if (options.importClients !== false) {
      try {
        const rawClients = await fbQuery(
          fbDb,
          "SELECT KOD_KADO, TITUL, NAZEV_KADO, POZNAMKA_KADO, MESTO_K, BANKA_K, TELEFON, MOBIL, EMAIL, VYMAZ FROM TAB005 WHERE KOD_KADO > 0 ORDER BY KOD_KADO",
        );
        report.clients.total = rawClients.length;

        const BATCH_SIZE = 500;
        for (let i = 0; i < rawClients.length; i += BATCH_SIZE) {
          const chunk = rawClients.slice(i, i + BATCH_SIZE);
          const valuesToInsert = chunk.map((r) => {
            const extId = String(r.KOD_KADO);
            const priezvisko = decodeWin1250(r.NAZEV_KADO);
            const meno = decodeWin1250(r.POZNAMKA_KADO);
            const titul = decodeWin1250(r.TITUL);
            const ulica = decodeWin1250(r.MESTO_K);
            const bankaK = decodeWin1250(r.BANKA_K);
            const { city, zip } = parseBankaK(bankaK);
            const mobil = decodeWin1250(r.MOBIL);
            const tel = decodeWin1250(r.TELEFON);
            const email = decodeWin1250(r.EMAIL) || null;

            const rawPhone = mobil || tel || null;
            let primaryPhone: string | null = null;
            let phoneNote: string | null = null;

            if (rawPhone) {
              if (rawPhone.length > 32) {
                const match = rawPhone.match(/^[\d\s\+\-\/\(\)]{7,25}/);
                if (match) {
                  primaryPhone = match[0].trim().slice(0, 32);
                  phoneNote = `Telefón: ${rawPhone}`;
                } else {
                  primaryPhone = rawPhone.slice(0, 32);
                  phoneNote = `Telefón: ${rawPhone}`;
                }
              } else {
                primaryPhone = rawPhone;
              }
            }

            const extraNote = tel && mobil && mobil !== tel ? `Pevná linka: ${tel}` : null;
            const notes = [
              titul ? `Titul: ${titul}` : null,
              phoneNote,
              extraNote,
            ].filter(Boolean).join("\n") || null;

            return {
              practiceId,
              firstName: (meno || (priezvisko ? "" : "Neznáme")).slice(0, 128),
              lastName: (priezvisko || meno || "Klient").slice(0, 128),
              phone: primaryPhone,
              email: email && email.includes("@") ? email.slice(0, 255) : null,
              address: ulica || null,
              city: city ? city.slice(0, 128) : null,
              zip: zip ? zip.slice(0, 16) : null,
              notes,
              deletedAt: r.VYMAZ === 1 ? new Date() : null,
              externalSource: "vetsoftware_v2",
              externalId: extId,
              importFingerprint: migrationImportFingerprint("clients", [practiceId, "vetsoftware_v2", extId]),
            };
          });

          try {
            const inserted = await db
              .insert(clients)
              .values(valuesToInsert)
              .onConflictDoNothing({
                target: [clients.practiceId, clients.externalSource, clients.externalId],
                where: sql`external_source is not null and external_id is not null`,
              })
              .returning({ id: clients.id });

            report.clients.inserted += inserted.length;
            report.clients.skipped += valuesToInsert.length - inserted.length;
          } catch (chunkErr: any) {
            report.errors.push(`Chyba pri vkladaní dávky klientov (${i}-${i + chunk.length}): ${chunkErr.cause?.message || chunkErr.message}`);
          }
        }
      } catch (err: any) {
        report.errors.push(`Chyba pri importe klientov: ${err.cause?.message || err.message}`);
      }
    }

    // Načítaj mapu klientov pre väzby pacientov
    const clientMap = await getClientExternalIdMap(db, practiceId);

    // Hoisted so FÁZA 2b (patient_weights) can reuse the already-fetched rows
    // without an extra Firebird round-trip.
    let rawPatients: any[] = [];

    // =========================================================================
    // FÁZA 2: Pacienti (Zvieratá + Sympathy Gate)
    // =========================================================================
    if (options.importPatients !== false) {
      try {
        // Načítaj väzbový mostík TAB050 (ID_PACIENT -> ID_KLIENT)
        const rawBridge = await fbQuery<{ ID_PACIENT: number; ID_KLIENT: number }>(
          fbDb,
          "SELECT ID_PACIENT, ID_KLIENT FROM TAB050 WHERE ID_PACIENT > 0 AND ID_KLIENT > 0 AND (VYMAZP = 0 OR VYMAZP IS NULL)",
        );
        const bridgeMap = new Map<string, string>();
        for (const b of rawBridge) {
          bridgeMap.set(String(b.ID_PACIENT), String(b.ID_KLIENT));
        }

        // Záložné doplnenie z TAB060 pre prípad chýbajúcich väzieb
        const rawFinLinks = await fbQuery<{ ID_PAC: number; ID_MAJITELE: number }>(
          fbDb,
          "SELECT ID_PAC, ID_MAJITELE FROM TAB060 WHERE ID_PAC > 0 AND ID_MAJITELE > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL)",
        );
        for (const fl of rawFinLinks) {
          const pKey = String(fl.ID_PAC);
          if (!bridgeMap.has(pKey)) {
            bridgeMap.set(pKey, String(fl.ID_MAJITELE));
          }
        }

        rawPatients = await fbQuery(
          fbDb,
          "SELECT ID_PACIENTA, JMENOP, ID_MAJITELE, ID_ZVIRE, ID_POHLAVI, ID_RASA, NAROZEN, ZEMREL, VYRAZEN, VYRAZEN_KDY, CIP, VA, POZ FROM TAB006 WHERE ID_PACIENTA > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY ID_PACIENTA",
        );
        report.patients.total = rawPatients.length;

        const BATCH_SIZE = 500;
        for (let i = 0; i < rawPatients.length; i += BATCH_SIZE) {
          const chunk = rawPatients.slice(i, i + BATCH_SIZE);
          const valuesToInsert = chunk
            .map((r) => {
              const extId = String(r.ID_PACIENTA);
              // Priorita: TAB050 mostík -> TAB006.ID_MAJITELE
              const extClientId = bridgeMap.get(extId) || (r.ID_MAJITELE > 0 ? String(r.ID_MAJITELE) : null);
              const clientId = extClientId ? clientMap.get(extClientId) : undefined;

              if (!clientId) {
                // Preskoč pacienta bez identifikovateľného majiteľa
                return null;
              }

              const meno = decodeWin1250(r.JMENOP) || "Pacient";
              const rawSpecies = lookups.speciesMap.get(r.ID_ZVIRE);
              const species = normalizeSlovakSpecies(rawSpecies);
              const rawSex = lookups.sexMap.get(r.ID_POHLAVI);
              const sex = normalizeSlovakSex(rawSex);
              const breed = lookups.breedMap.get(r.ID_RASA) || null;
              const cip = decodeWin1250(r.CIP) || null;

              const isDeceased = isPatientDeceased({
                ZEMREL: r.ZEMREL,
                VYRAZEN: r.VYRAZEN,
              });

              if (isDeceased) {
                report.patients.deceased += 1;
              }

              let dob: string | null = null;
              if (r.NAROZEN) {
                const d = new Date(r.NAROZEN);
                if (!isNaN(d.getTime()) && d.getFullYear() > 1990 && d.getFullYear() <= new Date().getFullYear()) {
                  dob = d.toISOString().slice(0, 10);
                }
              }

              return {
                practiceId,
                clientId,
                name: meno.slice(0, 128),
                species,
                breed: breed ? breed.slice(0, 128) : null,
                sex,
                dob,
                microchipNumber: cip ? cip.slice(0, 64) : null,
                status: isDeceased ? ("deceased" as const) : ("active" as const),
                externalSource: "vetsoftware_v2",
                externalId: extId,
                importFingerprint: migrationImportFingerprint("patients", [practiceId, "vetsoftware_v2", extId]),
              };
            })
            .filter((v): v is NonNullable<typeof v> => v !== null);

          if (valuesToInsert.length > 0) {
            try {
              const inserted = await db
                .insert(patients)
                .values(valuesToInsert)
                .onConflictDoNothing({
                  target: [patients.practiceId, patients.externalSource, patients.externalId],
                  where: sql`external_source is not null and external_id is not null`,
                })
                .returning({ id: patients.id });

              report.patients.inserted += inserted.length;
              report.patients.skipped += valuesToInsert.length - inserted.length;
            } catch (chunkErr: any) {
              report.errors.push(`Chyba pri vkladaní dávky pacientov (${i}-${i + chunk.length}): ${chunkErr.cause?.message || chunkErr.message}`);
            }
          }
        }
      } catch (err: any) {
        report.errors.push(`Chyba pri importe pacientov: ${err.cause?.message || err.message}`);
      }
    }

    // Načítaj mapu pacientov pre väzby očkovaní, návštev a súborov
    const patientMap = await getPatientExternalIdMap(db, practiceId);

    // =========================================================================
    // FÁZA 2b: Váhy pacientov (TAB006.VA)
    // =========================================================================
    if (options.importWeights !== false) {
      try {
        // rawPatients already fetched above – reuse to avoid second query
        const weightRows = rawPatients.filter((r: any) => {
          const v = parseFloat(String(r.VA));
          return !isNaN(v) && v > 0 && v < 1000;
        });
        report.weights.total = weightRows.length;

        const BATCH_SIZE = 500;
        for (let i = 0; i < weightRows.length; i += BATCH_SIZE) {
          const chunk = weightRows.slice(i, i + BATCH_SIZE);
          const valuesToInsert = chunk
            .map((r: any) => {
              const extPatId = String(r.ID_PACIENTA);
              const patientId = patientMap.get(extPatId);
              if (!patientId) return null;
              const weightKg = parseFloat(String(r.VA)).toFixed(3);
              return {
                patientId,
                weightKg,
                recordedAt: new Date(),
                recordedBy: migrationUser.id,
              };
            })
            .filter(
            (
              v: { patientId: string; weightKg: string; recordedAt: Date; recordedBy: string } | null,
            ): v is NonNullable<typeof v> => v !== null,
          );

          if (valuesToInsert.length > 0) {
            try {
              const inserted = await db
                .insert(patientWeights)
                .values(valuesToInsert)
                .returning({ id: patientWeights.id });
              report.weights.inserted += inserted.length;
              report.weights.skipped += valuesToInsert.length - inserted.length;
            } catch (chunkErr: any) {
              report.errors.push(`Chyba pri vkladaní dávky váh (${i}-${i + chunk.length}): ${chunkErr.cause?.message || chunkErr.message}`);
            }
          }
        }
      } catch (err: any) {
        report.errors.push(`Chyba pri importe váh: ${err.cause?.message || err.message}`);
      }
    }

    // =========================================================================
    // FÁZA 3: Očkovania
    // =========================================================================
    if (options.importVaccinations !== false) {
      try {
        const rawVacs = await fbQuery(
          fbDb,
          "SELECT ID_ZAZN, KP42, ID_KLIENT, DNE42, VAKCI, P_OCKOV, LYSS, POZ42, KDO, TYP FROM TAB018 WHERE KP42 > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY ID_ZAZN",
        );
        report.vaccinations.total = rawVacs.length;

        const BATCH_SIZE = 500;
        for (let i = 0; i < rawVacs.length; i += BATCH_SIZE) {
          const chunk = rawVacs.slice(i, i + BATCH_SIZE);
          const valuesToInsert = [];

          for (const r of chunk) {
            const extPatId = String(r.KP42);
            const patientId = patientMap.get(extPatId);
            if (!patientId) continue;

            const extId = String(r.ID_ZAZN);
            const lyss = decodeWin1250(r.LYSS);
            const typeName = lookups.vacTypeMap.get(r.TYP);
            const vaccineName = lyss || typeName || "Vakcinácia";

            const rawAdminDate = r.VAKCI || r.DNE42;
            const adminDate = rawAdminDate ? new Date(rawAdminDate) : new Date();

            let nextDue: string | null = null;
            if (r.P_OCKOV) {
              const nd = new Date(r.P_OCKOV);
              if (!isNaN(nd.getTime()) && nd.getFullYear() > 2000 && nd.getFullYear() < 2100) {
                nextDue = nd.toISOString().slice(0, 10);
              }
            }

            const note = await readTextBlob(r.POZ42, 3000);

            valuesToInsert.push({
              practiceId,
              patientId,
              vaccineName: vaccineName.slice(0, 255),
              administeredAt: adminDate,
              nextDueDate: nextDue,
              lotNumber: note ? note.slice(0, 64) : null,
              administeredBy: migrationUser.id,
              importFingerprint: migrationImportFingerprint("vaccinations", [practiceId, "vetsoftware_v2", extId]),
            });
          }

          if (valuesToInsert.length > 0) {
            try {
              const inserted = await db
                .insert(vaccinationRecords)
                .values(valuesToInsert)
                .onConflictDoNothing({
                  target: [vaccinationRecords.practiceId, vaccinationRecords.importFingerprint],
                  where: sql`import_fingerprint is not null and deleted_at is null`,
                })
                .returning({ id: vaccinationRecords.id });

              report.vaccinations.inserted += inserted.length;
              report.vaccinations.skipped += valuesToInsert.length - inserted.length;
            } catch (chunkErr: any) {
              report.errors.push(`Chyba pri vkladaní dávky očkovaní (${i}-${i + chunk.length}): ${chunkErr.cause?.message || chunkErr.message}`);
            }
          }
        }
      } catch (err: any) {
        report.errors.push(`Chyba pri importe očkovaní: ${err.cause?.message || err.message}`);
      }
    }

    // =========================================================================
    // FÁZA 4: Klinické návštevy & SOAP poznámky (Batch 100, streaming BLOB)
    // =========================================================================
    if (options.importSoapNotes !== false) {
      try {
        const rawVisits = await fbQuery(
          fbDb,
          "SELECT ID_KARTY, KP, ID_KLIENT, DT, C, KDO, A, KV, POZN FROM TAB010 WHERE KP > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY ID_KARTY",
        );
        report.soapNotes.total = rawVisits.length;

        // Načítaj diagnózy z TAB016 + TAB015
        const diagRows = await fbQuery<{ ID_KARTY: number; NAZEV: any }>(
          fbDb,
          "SELECT d.ID_KARTY, g.NAZEV FROM TAB016 d JOIN TAB015 g ON d.ID_DG = g.ID_DG WHERE (d.VYMAZ = 0 OR d.VYMAZ IS NULL)",
        );
        const diagMap = new Map<number, string[]>();
        diagRows.forEach((dr) => {
          const list = diagMap.get(dr.ID_KARTY) || [];
          const name = decodeWin1250(dr.NAZEV);
          if (name) list.push(name);
          diagMap.set(dr.ID_KARTY, list);
        });

        // Načítaj úkony z TAB017
        const itemRows = await fbQuery<{ ID_KARTY: number; ZBOZI: any; DAVKA: any; KUSU: number }>(
          fbDb,
          "SELECT ID_KARTY, ZBOZI, DAVKA, KUSU FROM TAB017 WHERE (VYMAZ = 0 OR VYMAZ IS NULL)",
        );
        const itemMap = new Map<number, string[]>();
        itemRows.forEach((ir) => {
          const list = itemMap.get(ir.ID_KARTY) || [];
          const zb = decodeWin1250(ir.ZBOZI);
          const davka = decodeWin1250(ir.DAVKA);
          const itemText = `${zb} ${davka ? `(${davka})` : ""} ${ir.KUSU ? `${ir.KUSU}x` : ""}`.trim();
          if (itemText) list.push(itemText);
          itemMap.set(ir.ID_KARTY, list);
        });

        const BLOB_BATCH_SIZE = 100;
        for (let i = 0; i < rawVisits.length; i += BLOB_BATCH_SIZE) {
          const chunk = rawVisits.slice(i, i + BLOB_BATCH_SIZE);
          const valuesToInsert = [];

          for (const r of chunk) {
            const extPatId = String(r.KP);
            const patientId = patientMap.get(extPatId);
            if (!patientId) continue;

            const extId = String(r.ID_KARTY);
            const subjective = await readTextBlob(r.A, 3000);
            const objective = await readTextBlob(r.KV, 3000);
            const noteText = await readTextBlob(r.POZN, 3000);

            const diagnoses = diagMap.get(r.ID_KARTY) || [];
            const assessment = diagnoses.length > 0 ? diagnoses.join(", ") : null;

            const treatments = itemMap.get(r.ID_KARTY) || [];
            const planParts = [treatments.length > 0 ? treatments.join("\n") : null, noteText || null].filter(Boolean);
            const plan = planParts.length > 0 ? planParts.join("\n\n") : null;

            // Ak je celý záznam prázdny, preskoč
            if (!subjective && !objective && !assessment && !plan) {
              continue;
            }

            const dt = r.DT ? new Date(r.DT) : new Date();
            const doctorName = decodeWin1250(r.KDO) || "MVDr. Zdeněk Drotár";

            valuesToInsert.push({
              practiceId,
              patientId,
              authorId: migrationUser.id,
              authorName: doctorName.slice(0, 255),
              status: "finalized" as const,
              finalizedAt: dt,
              subjective: subjective || null,
              objective: objective || null,
              assessment: assessment || null,
              plan: plan || null,
              imported: true,
              importFingerprint: migrationImportFingerprint("soap_notes", [practiceId, "vetsoftware_v2", extId]),
            });
          }

          if (valuesToInsert.length > 0) {
            try {
              const inserted = await db
                .insert(soapNotes)
                .values(valuesToInsert)
                .onConflictDoNothing({
                  target: [soapNotes.practiceId, soapNotes.importFingerprint],
                  where: sql`import_fingerprint is not null and deleted_at is null`,
                })
                .returning({ id: soapNotes.id });

              report.soapNotes.inserted += inserted.length;
              report.soapNotes.skipped += valuesToInsert.length - inserted.length;
            } catch (chunkErr: any) {
              report.errors.push(`Chyba pri vkladaní dávky vyšetrení (${i}-${i + chunk.length}): ${chunkErr.cause?.message || chunkErr.message}`);
            }
          }
        }
      } catch (err: any) {
        report.errors.push(`Chyba pri importe vyšetrení: ${err.cause?.message || err.message}`);
      }
    }

    // =========================================================================
    // FÁZA 5: Historické faktúry a účty (TAB060) - Mena EUR
    // =========================================================================
    if (options.importFinancials !== false) {
      try {
        const rawInvoices = await fbQuery(
          fbDb,
          "SELECT ID_UCET, ID_PAC, ID_MAJITELE, DAT_VYSTAV, C_CE, CELSDPH, CELDPH, DOK_CIS, POZNAMKA FROM TAB060 WHERE (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY ID_UCET",
        );
        report.financials.total = rawInvoices.length;

        const BATCH_SIZE = 200;
        for (let i = 0; i < rawInvoices.length; i += BATCH_SIZE) {
          const chunk = rawInvoices.slice(i, i + BATCH_SIZE);
          const valuesToInsert = chunk
            .map((r) => {
              const extClientId = String(r.ID_MAJITELE);
              const clientId = clientMap.get(extClientId);
              if (!clientId) return null;

              const extId = String(r.ID_UCET);
              const extPatId = r.ID_PAC ? String(r.ID_PAC) : null;
              const patientId = extPatId ? patientMap.get(extPatId) || null : null;

              const totalNum = Number(r.CELSDPH) || 0;
              const taxNum = Number(r.CELDPH) || 0;
              const subtotalNum = totalNum >= taxNum ? totalNum - taxNum : totalNum;

              const docNum = decodeWin1250(r.DOK_CIS) || `FA-${extId}`;
              const issuedAt = r.DAT_VYSTAV ? new Date(r.DAT_VYSTAV) : new Date();
              const note = decodeWin1250(r.POZNAMKA) || null;

              return {
                practiceId,
                clientId,
                patientId,
                documentType: "invoice" as const,
                documentNumber: docNum.slice(0, 160),
                issuedAt,
                status: "paid" as const,
                currency: "EUR", // STRICTLY EUR
                subtotal: subtotalNum.toFixed(2),
                tax: taxNum.toFixed(2),
                discount: "0",
                total: totalNum.toFixed(2),
                paidAmount: totalNum.toFixed(2),
                balance: "0",
                note,
                externalSource: "vetsoftware_v2",
                externalId: extId,
                importFingerprint: migrationImportFingerprint("legacy_financial_documents", [
                  practiceId,
                  "vetsoftware_v2",
                  extId,
                ]),
              };
            })
            .filter((v): v is NonNullable<typeof v> => v !== null);

          if (valuesToInsert.length > 0) {
            try {
              const inserted = await db
                .insert(legacyFinancialDocuments)
                .values(valuesToInsert)
                .onConflictDoNothing({
                  target: [
                    legacyFinancialDocuments.practiceId,
                    legacyFinancialDocuments.externalSource,
                    legacyFinancialDocuments.externalId,
                  ],
                })
                .returning({ id: legacyFinancialDocuments.id });

              report.financials.inserted += inserted.length;
              report.financials.skipped += valuesToInsert.length - inserted.length;
            } catch (chunkErr: any) {
              report.errors.push(`Chyba pri vkladaní dávky faktúr (${i}-${i + chunk.length}): ${chunkErr.cause?.message || chunkErr.message}`);
            }
          }
        }
      } catch (err: any) {
        report.errors.push(`Chyba pri importe faktúr: ${err.cause?.message || err.message}`);
      }
    }

    // Načítaj mapu faktúr pre väzby položiek
    const invoiceMap = new Map<string, string>();
    try {
      const invoiceRows = await db
        .select({ id: legacyFinancialDocuments.id, externalId: legacyFinancialDocuments.externalId })
        .from(legacyFinancialDocuments)
        .where(
          and(
            eq(legacyFinancialDocuments.practiceId, practiceId),
            eq(legacyFinancialDocuments.externalSource, "vetsoftware_v2"),
          ),
        );
      for (const row of invoiceRows) {
        if (row.externalId) invoiceMap.set(row.externalId, row.id);
      }
    } catch (mapErr: any) {
      report.errors.push(`Chyba pri načítaní mapy faktúr: ${mapErr.cause?.message || mapErr.message}`);
    }

    // =========================================================================
    // FÁZA 5b: Položky faktúr (TAB066)
    // =========================================================================
    if (options.importFinancials !== false && invoiceMap.size > 0) {
      try {
        const rawLineItems = await fbQuery(
          fbDb,
          "SELECT KOD_RADKU, CIS_UCTU, N_Z, POCET, KUSSDPH, C_KUS, CELSDPH, CELDPH, DAN FROM TAB066 WHERE (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY CIS_UCTU, KOD_RADKU",
        );
        report.lineItems.total = rawLineItems.length;

        const BATCH_SIZE = 200;
        for (let i = 0; i < rawLineItems.length; i += BATCH_SIZE) {
          const chunk = rawLineItems.slice(i, i + BATCH_SIZE);
          const valuesToInsert = chunk
            .map((r: any) => {
              const extDocId = String(r.CIS_UCTU);
              const documentId = invoiceMap.get(extDocId);
              if (!documentId) return null;

              const extId = String(r.KOD_RADKU);
              // TAB066 has no patient FK column
              const description = decodeWin1250(r.N_Z) || "Položka";
              const quantity = Math.max(0, Number(r.POCET) || 1);
              // KUSSDPH = unit price with VAT; C_KUS = unit price without VAT
              const unitPrice = Math.max(0, Number(r.KUSSDPH) || Number(r.C_KUS) || 0);
              // CELSDPH = line total with VAT; CELDPH = line total without VAT
              const total = Math.max(0, Number(r.CELSDPH) || 0);
              const totalNoVat = Math.max(0, Number(r.CELDPH) || 0);
              const tax = Math.max(0, total - totalNoVat);
              const subtotal = totalNoVat;

              return {
                practiceId,
                documentId,
                patientId: null,
                sortOrder: Number(r.KOD_RADKU) || 0,
                description: description.slice(0, 500),
                quantity: quantity.toFixed(3),
                unitPrice: unitPrice.toFixed(2),
                subtotal: subtotal.toFixed(2),
                tax: tax.toFixed(2),
                discount: "0.00",
                total: total.toFixed(2),
                externalSource: "vetsoftware_v2",
                externalId: extId,
                importFingerprint: migrationImportFingerprint("legacy_financial_line_items", [
                  practiceId,
                  "vetsoftware_v2",
                  extId,
                ]),
              };
            })
            .filter((v): v is NonNullable<typeof v> => v !== null);

          if (valuesToInsert.length > 0) {
            try {
              const inserted = await db
                .insert(legacyFinancialLineItems)
                .values(valuesToInsert)
                .onConflictDoNothing({
                  target: [
                    legacyFinancialLineItems.practiceId,
                    legacyFinancialLineItems.externalSource,
                    legacyFinancialLineItems.externalId,
                  ],
                })
                .returning({ id: legacyFinancialLineItems.id });

              report.lineItems.inserted += inserted.length;
              report.lineItems.skipped += valuesToInsert.length - inserted.length;
            } catch (chunkErr: any) {
              report.errors.push(`Chyba pri vkladaní dávky položiek faktúr (${i}-${i + chunk.length}): ${chunkErr.cause?.message || chunkErr.message}`);
            }
          }
        }
      } catch (err: any) {
        report.errors.push(`Chyba pri importe položiek faktúr: ${err.cause?.message || err.message}`);
      }
    }

    // =========================================================================
    // FÁZA 5c: Laboratórne správy + parametre (TAB045, TAB047)
    // =========================================================================
    if (options.importLabReports !== false) {
      try {
        // TAB045: C_PROTOK=reportID, ID_PACI=patient, DATO=sample date, DATVYSLEDKU=result date,
        //         UZX=vet name, PROTOKOL=accession number, POZNAMKA=notes (text, not BLOB)
        const rawLabReports = await fbQuery(
          fbDb,
          "SELECT C_PROTOK, ID_PACI, DATO, DATVYSLEDKU, UZX, PROTOKOL, POZNAMKA FROM TAB045 WHERE (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY C_PROTOK",
        );
        report.labReports.total = rawLabReports.length;

        // TAB047: ID_VETY=rowID, C_PROTOK=report FK, ID_PACI=patient, NHODN=numeric value,
        //         ROZDIL=flag (deviation), ID_UKAZ=parameter ID (lookup in TAB023/TAB024)
        const rawObservations = await fbQuery(
          fbDb,
          "SELECT ID_VETY, C_PROTOK, ID_PACI, NHODN, ROZDIL, ID_UKAZ FROM TAB047 WHERE (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY C_PROTOK, ID_VETY",
        );
        const obsMap = new Map<number, typeof rawObservations>();
        for (const obs of rawObservations) {
          const list = obsMap.get(obs.C_PROTOK) || [];
          list.push(obs);
          obsMap.set(obs.C_PROTOK, list);
        }

        // labReportExtId → newly inserted UUID (pre väzby observations)
        const labReportIdMap = new Map<string, string>();

        const BATCH_SIZE = 100;
        for (let i = 0; i < rawLabReports.length; i += BATCH_SIZE) {
          const chunk = rawLabReports.slice(i, i + BATCH_SIZE);
          const reportValues = [];

          for (const r of chunk) {
            const extId = String(r.C_PROTOK);
            const extPatId = r.ID_PACI ? String(r.ID_PACI) : null;
            const patientId = extPatId ? patientMap.get(extPatId) || null : null;

            const attributionStatus = patientId ? ("matched" as const) : ("needs_review" as const);

            const orderedAt = r.DATO ? new Date(r.DATO) : null;
            const resultedAt = r.DATVYSLEDKU ? new Date(r.DATVYSLEDKU) : null;
            // date_check: resultedAt >= orderedAt
            const safeOrderedAt =
              orderedAt && resultedAt && resultedAt < orderedAt ? null : orderedAt;

            const vetName = decodeWin1250(r.UZX) || null;
            const accession = r.PROTOKOL ? String(r.PROTOKOL) : null;
            const notes = decodeWin1250(r.POZNAMKA) || null;

            reportValues.push({
              extId,
              value: {
                practiceId,
                patientId,
                attributionStatus,
                orderedAt: safeOrderedAt,
                resultedAt,
                status: "unknown" as const,
                labName: vetName ? vetName.slice(0, 255) : "VetSoftware V2",
                orderName: "Hematológia / Lab. protokol",
                accessionNumber: accession ? accession.slice(0, 160) : null,
                summary: notes ? notes.slice(0, 12000) : null,
                interpretation: null,
                reviewStatus: "unreviewed" as const,
                externalSource: "vetsoftware_v2",
                externalId: extId,
                importFingerprint: migrationImportFingerprint("external_lab_reports", [
                  practiceId,
                  "vetsoftware_v2",
                  extId,
                ]),
              },
            });
          }

          if (reportValues.length > 0) {
            try {
              const inserted = await db
                .insert(externalLabReports)
                .values(reportValues.map((rv) => rv.value))
                .onConflictDoNothing({
                  target: [
                    externalLabReports.practiceId,
                    externalLabReports.externalSource,
                    externalLabReports.externalId,
                  ],
                })
                .returning({ id: externalLabReports.id, externalId: externalLabReports.externalId });

              report.labReports.inserted += inserted.length;
              report.labReports.skipped += reportValues.length - inserted.length;

              for (const ins of inserted) {
                labReportIdMap.set(ins.externalId, ins.id);
              }

              // Insert TAB047 observations for newly inserted reports
              const obsToInsert = [];
              for (const rv of reportValues) {
                const reportId = labReportIdMap.get(rv.extId);
                if (!reportId) continue;
                const obsRows = obsMap.get(Number(rv.extId)) || [];
                for (const obs of obsRows) {
                  // ID_UKAZ is a numeric FK – use it as parameter identifier
                  const paramName = `Ukazovateľ ${obs.ID_UKAZ}`;
                  obsToInsert.push({
                    practiceId,
                    reportId,
                    sortOrder: Math.max(0, Number(obs.ID_VETY) || 0),
                    name: paramName.slice(0, 255),
                    // NHODN is numeric – store as string
                    value: obs.NHODN != null ? String(obs.NHODN) : null,
                    unit: null,
                    referenceRange: null,
                    // ROZDIL: 0=normal, 1=abnormal
                    flag: obs.ROZDIL === 1 ? "abnormal" : null,
                    externalSource: "vetsoftware_v2",
                    externalId: String(obs.ID_VETY),
                    importFingerprint: migrationImportFingerprint("external_lab_observations", [
                      practiceId,
                      "vetsoftware_v2",
                      String(obs.ID_VETY),
                    ]),
                  });
                }
              }

              if (obsToInsert.length > 0) {
                await db
                  .insert(externalLabObservations)
                  .values(obsToInsert)
                  .onConflictDoNothing({
                    target: [
                      externalLabObservations.practiceId,
                      externalLabObservations.externalSource,
                      externalLabObservations.externalId,
                    ],
                  });
              }
            } catch (chunkErr: any) {
              report.errors.push(`Chyba pri vkladaní dávky lab. správ (${i}-${i + chunk.length}): ${chunkErr.cause?.message || chunkErr.message}`);
            }
          }
        }
      } catch (err: any) {
        if (err.message?.includes("Table unknown") || err.message?.includes("TAB045") || err.message?.includes("TAB047")) {
          report.errors.push(`Lab. tabuľky TAB045/TAB047 nie sú dostupné v tejto verzii databázy – preskočené.`);
        } else {
          report.errors.push(`Chyba pri importe lab. správ: ${err.cause?.message || err.message}`);
        }
      }
    }

    // =========================================================================
    // FÁZA 6: RTG snímky a obrazové prílohy (TAB058 + TAB059)
    // =========================================================================
    if (options.importAttachments !== false) {
      try {
        const rawDocs = await fbQuery(
          fbDb,
          "SELECT o.ID_OBR, o.ID_PAC, o.NAZEV, o.POPIS, o.DNE, p.FILE_NAME, p.IMAGE_DATA FROM TAB058 o LEFT JOIN TAB059 p ON o.ID_OBR = p.ID_RADKU WHERE (o.VYMAZ = 0 OR o.VYMAZ IS NULL)",
        );
        report.attachments.total = rawDocs.length;

        for (const r of rawDocs) {
          const extPatId = r.ID_PAC ? String(r.ID_PAC) : null;
          const patientId = extPatId ? patientMap.get(extPatId) || null : null;
          if (!patientId) {
            report.attachments.skipped += 1;
            continue;
          }

          const extId = String(r.ID_OBR);
          // FILE_NAME is a BLOB in TAB059; NAZEV and POPIS are plain text in TAB058
          const rawFileName = await readTextBlob(r.FILE_NAME, 3000);
          const cleanBaseName = rawFileName ? rawFileName.split(/[\\/]/).pop()?.trim() : null;
          const origName = cleanBaseName || `rtg_${extId}.jpg`;

          // TAB058 NAZEV and POPIS are plain VARCHAR/text fields, not BLOBs
          const nazev = decodeWin1250(r.NAZEV);
          const popis = decodeWin1250(r.POPIS);
          const title = nazev || popis || "RTG / Obrazová príloha";

          // Sanitize filename: remove path separators and problematic chars so
          // the primaryNamespaceCheck regex (/[^/]+$/) always passes.
          const safeBaseName = origName.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
          const fileKey = `${practiceId}/documents/v2_${extId}_${safeBaseName}`.replace(/\s+/g, "_");
          const fileUrl = `/api/files/${fileKey}`;

          const buf = await readBinaryBlob(r.IMAGE_DATA, 5000);
          // Treat empty Buffer (size 0) the same as null — no actual data was
          // stored in the legacy BLOB column, so we cannot mark this as available.
          const hasData = buf !== null && buf.length > 0;
          const sizeBytes = hasData ? buf!.length : null;
          const sha256 = hasData ? crypto.createHash("sha256").update(buf!).digest("hex") : null;

          // IMPORTANT: We never upload to MinIO in this pipeline, so storageStatus
          // must be "unverified" regardless. The constraint files_available_evidence_check
          // requires that status="available" ↔ checksumSha256 + fileSizeBytes +
          // storageVerifiedAt are all non-null. Since we are not uploading to MinIO
          // here, always use "unverified". A separate reconciliation job can later
          // verify/upload and flip the status to "available".
          const storageStatus = "unverified" as const;

          try {
            const inserted = await db
              .insert(files)
              .values({
                practiceId,
                uploadedBy: migrationUser.id,
                fileName: safeBaseName.slice(0, 255),
                fileKey,
                fileUrl,
                mimeType: origName.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
                fileSizeBytes: sizeBytes,
                checksumSha256: sha256,
                category: "documents",
                title: title.slice(0, 255),
                patientId,
                storageStatus,
                storageVerifiedAt: null,
              })
              .onConflictDoNothing({
                target: [files.practiceId, files.fileKey],
              })
              .returning({ id: files.id });

            // Resolve fileId – either newly inserted or already-existing row.
            // This ensures historical_documents get populated on every run (idempotent).
            let fileId: string | null = inserted.length > 0 ? inserted[0].id : null;
            if (!fileId) {
              const existing = await db
                .select({ id: files.id })
                .from(files)
                .where(and(eq(files.practiceId, practiceId), eq(files.fileKey, fileKey)))
                .limit(1);
              fileId = existing[0]?.id ?? null;
            }

            if (inserted.length > 0) {
              report.attachments.inserted += 1;
            } else {
              report.attachments.skipped += 1;
            }

            // Always insert historical_document if we have a valid fileId
            if (fileId) {
              const dne = r.DNE ? new Date(r.DNE) : null;
              const documentDate = dne && !isNaN(dne.getTime()) ? dne.toISOString().slice(0, 10) : null;
              try {
                await db
                  .insert(historicalDocuments)
                  .values({
                    practiceId,
                    fileId,
                    patientId: patientId!,
                    kind: "other",
                    linkStatus: "linked",
                    title: title.slice(0, 255),
                    documentDate,
                    externalSource: "vetsoftware_v2",
                    externalId: extId,
                    importFingerprint: migrationImportFingerprint("historical_documents", [
                      practiceId,
                      "vetsoftware_v2",
                      extId,
                    ]),
                  })
                  .onConflictDoNothing({
                    target: [
                      historicalDocuments.practiceId,
                      historicalDocuments.externalSource,
                      historicalDocuments.externalId,
                    ],
                  });
              } catch (hdErr: any) {
                report.errors.push(`Chyba pri ukladaní historical_document ${extId}: ${hdErr.cause?.message || hdErr.message}`);
              }
            }
          } catch (fileErr: any) {
            report.errors.push(`Chyba pri ukladaní prílohy ${extId}: ${fileErr.cause?.message || fileErr.message}`);
          }
        }
      } catch (err: any) {
        report.errors.push(`Chyba pri importe súborov: ${err.message}`);
      }
    }

    // =========================================================================
    // FÁZA 7: Lieky a úkony ku kartám (TAB027 + TAB028 → external_prescriptions)
    // =========================================================================
    if (options.importPrescriptions !== false) {
      try {
        // TAB027: lieky ku kartám | TAB028: ďalší typ predpisov – rovnaká štruktúra
        // ID_KARTY=cardFk, ZBOZI=name, DAVKA=dose, KUSU=qty, ID_PACIENTA=patientFk, KOD=rowId
        const rawRx27 = await fbQuery(fbDb,
          "SELECT KOD, ID_KARTY, ZBOZI, DAVKA, KUSU, ID_PACIENTA FROM TAB027 WHERE ID_PACIENTA > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY ID_KARTY, KOD",
        );
        const rawRx28 = await fbQuery(fbDb,
          "SELECT KOD, ID_KARTY, ZBOZI, DAVKA, KUSU, ID_PACIENTA FROM TAB028 WHERE ID_PACIENTA > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY ID_KARTY, KOD",
        );
        const allRx = [
          ...rawRx27.map((r: any) => ({ ...r, _src: "tab027" })),
          ...rawRx28.map((r: any) => ({ ...r, _src: "tab028" })),
        ];
        report.prescriptions.total = allRx.length;

        // Build soap note date map: ID_KARTY → DT from TAB010
        const soapDateRows = await fbQuery<any>(fbDb,
          "SELECT ID_KARTY, DT FROM TAB010 WHERE KP > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL)",
        );
        const soapDateMap = new Map<number, Date>();
        for (const s of soapDateRows) {
          if (s.DT) soapDateMap.set(s.ID_KARTY, new Date(s.DT));
        }

        const BATCH_SIZE = 200;
        for (let i = 0; i < allRx.length; i += BATCH_SIZE) {
          const chunk = allRx.slice(i, i + BATCH_SIZE);
          const valuesToInsert: any[] = [];

          for (const r of chunk) {
            const extPatId = String(r.ID_PACIENTA);
            const patientId = patientMap.get(extPatId);
            if (!patientId) continue;

            const extId = `${r._src}_${r.KOD}`;
            const medName = decodeWin1250(r.ZBOZI) || "Neznámy liek";
            const directions = decodeWin1250(r.DAVKA) || null;
            const qty = Number(r.KUSU) || null;
            const prescribedAt = soapDateMap.get(r.ID_KARTY) ?? null;

            valuesToInsert.push({
              practiceId,
              patientId,
              medicationName: medName.slice(0, 255),
              directions: directions ? directions.slice(0, 12000) : null,
              quantity: qty != null ? qty.toFixed(3) : null,
              prescribedAt,
              status: "unknown" as const,
              reviewStatus: "unreviewed" as const,
              prescriberDisplayName: migrationUser.name.slice(0, 255),
              externalSource: "vetsoftware_v2",
              externalId: extId,
              importFingerprint: migrationImportFingerprint("external_prescriptions", [
                practiceId, "vetsoftware_v2", extId,
              ]),
            });
          }

          if (valuesToInsert.length > 0) {
            try {
              const inserted = await db
                .insert(externalPrescriptions)
                .values(valuesToInsert)
                .onConflictDoNothing({
                  target: [externalPrescriptions.practiceId, externalPrescriptions.externalSource, externalPrescriptions.externalId],
                })
                .returning({ id: externalPrescriptions.id });
              report.prescriptions.inserted += inserted.length;
              report.prescriptions.skipped += valuesToInsert.length - inserted.length;
            } catch (chunkErr: any) {
              report.errors.push(`Chyba predpis batch (${i}): ${chunkErr.cause?.message || chunkErr.message}`);
            }
          }
        }
      } catch (err: any) {
        report.errors.push(`Chyba TAB027/028: ${err.cause?.message || err.message}`);
      }
    }

    // =========================================================================
    // FÁZA 8: Hospitalizácie (TAB052 → historical_appointments)
    // =========================================================================
    if (options.importHospitalizations !== false) {
      try {
        const rawHosp = await fbQuery(fbDb,
          "SELECT ID_HOSP, ID_PAC, ID_KLI, DNE, CAS, DNE1, CAS1, UZX FROM TAB052 WHERE ID_PAC > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY ID_HOSP",
        );
        report.hospitalizations.total = rawHosp.length;

        for (const r of rawHosp) {
          const extPatId = String(r.ID_PAC);
          const extCliId = r.ID_KLI ? String(r.ID_KLI) : null;
          const patientId = patientMap.get(extPatId);
          const clientId = extCliId ? clientMap.get(extCliId) : undefined;

          if (!patientId || !clientId) {
            report.hospitalizations.skipped += 1;
            continue;
          }

          const extId = String(r.ID_HOSP);
          const startDate = r.DNE ? new Date(r.DNE) : new Date();
          // DNE1 = prepustenie; ak null → startDate + 1 deň
          const endDate = r.DNE1 ? new Date(r.DNE1) : new Date(startDate.getTime() + 86400000);
          // historical_appointments requires started_at < ended_at
          const safeEnd = endDate > startDate ? endDate : new Date(startDate.getTime() + 3600000);
          const vetName = decodeWin1250(r.UZX) || migrationUser.name;

          try {
            const inserted = await db
              .insert(historicalAppointments)
              .values({
                practiceId,
                patientId,
                clientId,
                startedAt: startDate,
                endedAt: safeEnd,
                status: "unknown" as const,
                appointmentType: "Hospitalizácia",
                providerDisplayName: vetName.slice(0, 255),
                externalSource: "vetsoftware_v2",
                externalId: extId,
                importFingerprint: migrationImportFingerprint("historical_appointments", [
                  practiceId, "vetsoftware_v2", extId,
                ]),
              })
              .onConflictDoNothing({
                target: [historicalAppointments.practiceId, historicalAppointments.externalSource, historicalAppointments.externalId],
              })
              .returning({ id: historicalAppointments.id });
            report.hospitalizations.inserted += inserted.length;
            report.hospitalizations.skipped += inserted.length === 0 ? 1 : 0;
          } catch (hospErr: any) {
            report.errors.push(`Chyba hospitalizácia ${extId}: ${hospErr.cause?.message || hospErr.message}`);
          }
        }
      } catch (err: any) {
        report.errors.push(`Chyba TAB052: ${err.cause?.message || err.message}`);
      }
    }

    // =========================================================================
    // FÁZA 9: Pohľadávky (TAB077 → legacy_financial_payments + allocations)
    // =========================================================================
    if (options.importReceivables !== false && invoiceMap.size > 0) {
      try {
        const rawDebt = await fbQuery(fbDb,
          // ID_DLUH=ID, ID_UCET=invoiceFk, ID_MAJITELE=clientFk,
          // DAT_VYSTAV=date, CELSDPH=totalAmount, UHRAZENO=paid, ZBYVA=balance, UHRADITDO=dueDate
          "SELECT ID_DLUH, ID_UCET, ID_MAJITELE, DAT_VYSTAV, CELSDPH, UHRAZENO, ZBYVA, UHRADITDO, JM_VYSTAV FROM TAB077 WHERE VYMAZ = 0 OR VYMAZ IS NULL ORDER BY ID_DLUH",
        );
        report.receivables.total = rawDebt.length;

        for (const r of rawDebt) {
          const extId = String(r.ID_DLUH);
          const extCliId = r.ID_MAJITELE ? String(r.ID_MAJITELE) : null;
          const documentId = r.ID_UCET ? invoiceMap.get(String(r.ID_UCET)) : null;

          const receivedAt = r.DAT_VYSTAV ? new Date(r.DAT_VYSTAV) : new Date();
          const amount = Math.max(0, Number(r.CELSDPH) || 0);
          const paid = Math.max(0, Number(r.UHRAZENO) || 0);
          const vetName = decodeWin1250(r.JM_VYSTAV) || migrationUser.name;

          try {
            // Insert payment record
            const clientUuid = extCliId ? clientMap.get(extCliId) || null : null;
            const inserted = await db
              .insert(legacyFinancialPayments)
              .values({
                practiceId,
                receivedAt,
                amount: amount.toFixed(2),
                method: "hotovosť",
                attributionStatus: clientUuid ? ("matched" as const) : ("needs_review" as const),
                clientId: clientUuid,
                note: vetName ? vetName.slice(0, 255) : null,
                externalSource: "vetsoftware_v2",
                externalId: extId,
                importFingerprint: migrationImportFingerprint("legacy_financial_payments", [
                  practiceId, "vetsoftware_v2", extId,
                ]),
              })
              .onConflictDoNothing({
                target: [legacyFinancialPayments.practiceId, legacyFinancialPayments.externalSource, legacyFinancialPayments.externalId],
              })
              .returning({ id: legacyFinancialPayments.id });

            report.receivables.inserted += inserted.length;
            report.receivables.skipped += inserted.length === 0 ? 1 : 0;

            // If we have a linked invoice and a paid amount, create allocation
            if (inserted.length > 0 && documentId && paid > 0) {
              const paymentId = inserted[0].id;
              await db
                .insert(legacyFinancialAllocations)
                .values({
                  practiceId,
                  paymentId,
                  documentId,
                  amount: paid.toFixed(2),
                  allocatedAt: receivedAt,
                  externalSource: "vetsoftware_v2",
                  externalId: `alloc_${extId}`,
                  importFingerprint: migrationImportFingerprint("legacy_financial_allocations", [
                    practiceId, "vetsoftware_v2", `alloc_${extId}`,
                  ]),
                })
                .onConflictDoNothing({
                  target: [legacyFinancialAllocations.practiceId, legacyFinancialAllocations.externalSource, legacyFinancialAllocations.externalId],
                });
            }
          } catch (debtErr: any) {
            report.errors.push(`Chyba pohľadávka ${extId}: ${debtErr.cause?.message || debtErr.message}`);
          }
        }
      } catch (err: any) {
        report.errors.push(`Chyba TAB077: ${err.cause?.message || err.message}`);
      }
    }
  });

  report.durationMs = Date.now() - start;
  report.success = report.errors.length === 0;
  return report;
}
