import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  getV2DatabaseStats,
  fbQuery,
  decodeWin1250,
  isPatientDeceased,
  loadV2Lookups,
  withFirebird,
} from "@/lib/import/vetsoftware-v2-extractor";
import {
  runFullV2Migration,
  type ImportOptions,
} from "@/lib/import/vetsoftware-v2-pipeline";
import { normalizeSlovakSpecies, normalizeSlovakSex } from "@/lib/import/vetsoftware-v2-adapter";

const runMigrationInput = z.object({
  importClients: z.boolean().default(true),
  importPatients: z.boolean().default(true),
  importVaccinations: z.boolean().default(true),
  importSoapNotes: z.boolean().default(true),
  importFinancials: z.boolean().default(true),
  importAttachments: z.boolean().default(true),
});

export const v2ImportRouter = createRouter({
  /**
   * Retrieves live database stats from V2DATA.FDB
   */
  getSourceStats: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .query(async () => {
      return await getV2DatabaseStats();
    }),

  /**
   * Returns a preview sample of records across all categories
   */
  getImportPreview: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .query(async () => {
      try {
        return await withFirebird(async (fbDb) => {
          const lookups = await loadV2Lookups(fbDb);

          // Preview 5 Clients
          const rawClients = await fbQuery(
            fbDb,
            "SELECT FIRST 5 KOD_KADO, TITUL, NAZEV_KADO, POZNAMKA_KADO, MESTO_K, BANKA_K, TELEFON, MOBIL, EMAIL FROM TAB005 WHERE KOD_KADO > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY KOD_KADO",
          );
          const sampleClients = rawClients.map((r) => ({
            id: r.KOD_KADO,
            name: `${decodeWin1250(r.POZNAMKA_KADO)} ${decodeWin1250(r.NAZEV_KADO)}`.trim(),
            address: `${decodeWin1250(r.MESTO_K)}, ${decodeWin1250(r.BANKA_K)}`.trim(),
            phone: decodeWin1250(r.MOBIL) || decodeWin1250(r.TELEFON) || "–",
            email: decodeWin1250(r.EMAIL) || "–",
          }));

          // Preview 5 Patients
          const rawPatients = await fbQuery(
            fbDb,
            "SELECT FIRST 5 ID_PACIENTA, JMENOP, ID_MAJITELE, ID_ZVIRE, ID_POHLAVI, ID_RASA, NAROZEN, ZEMREL, VYRAZEN, CIP FROM TAB006 WHERE ID_PACIENTA > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY ID_PACIENTA",
          );
          const samplePatients = rawPatients.map((r) => {
            const isDeceased = isPatientDeceased({ ZEMREL: r.ZEMREL, VYRAZEN: r.VYRAZEN });
            return {
              id: r.ID_PACIENTA,
              clientId: r.ID_MAJITELE,
              name: decodeWin1250(r.JMENOP) || "Pacient",
              species: normalizeSlovakSpecies(lookups.speciesMap.get(r.ID_ZVIRE)),
              breed: lookups.breedMap.get(r.ID_RASA) || "–",
              sex: normalizeSlovakSex(lookups.sexMap.get(r.ID_POHLAVI)) || "–",
              status: isDeceased ? "deceased" : "active",
              microchip: decodeWin1250(r.CIP) || "–",
            };
          });

          // Preview 5 Vaccinations
          const rawVacs = await fbQuery(
            fbDb,
            "SELECT FIRST 5 ID_ZAZN, KP42, DNE42, VAKCI, P_OCKOV, LYSS, TYP FROM TAB018 WHERE KP42 > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY ID_ZAZN",
          );
          const sampleVaccinations = rawVacs.map((r) => ({
            id: r.ID_ZAZN,
            patientId: r.KP42,
            vaccine: decodeWin1250(r.LYSS) || lookups.vacTypeMap.get(r.TYP) || "Vakcinácia",
            administeredAt: r.VAKCI || r.DNE42,
            nextDue: r.P_OCKOV || "–",
          }));

          // Preview 5 SOAP Notes
          const rawVisits = await fbQuery(
            fbDb,
            "SELECT FIRST 5 ID_KARTY, KP, DT, KDO FROM TAB010 WHERE KP > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY ID_KARTY",
          );
          const sampleVisits = rawVisits.map((r) => ({
            id: r.ID_KARTY,
            patientId: r.KP,
            date: r.DT,
            doctor: decodeWin1250(r.KDO) || "MVDr. Zdeněk Drotár",
          }));

          return {
            clients: sampleClients,
            patients: samplePatients,
            vaccinations: sampleVaccinations,
            visits: sampleVisits,
          };
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Nepodarilo sa načítať náhľad z V2DATA.FDB: ${err.message}`,
        });
      }
    }),

  /**
   * Executes the full batch migration into OpenVPM PostgreSQL
   */
  runMigration: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(runMigrationInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const report = await runFullV2Migration(
          ctx.db,
          ctx.practiceId,
          ctx.session.user.id,
          input as ImportOptions,
        );
        return report;
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Migrácia zlyhala: ${err.message}`,
        });
      }
    }),
});
