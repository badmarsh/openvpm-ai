import { z } from "zod";
import { eq, and, isNull, or, ilike, sql } from "drizzle-orm";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import { clients, patients } from "@openpims/db";
import { normalizeE164 } from "@/lib/messaging/phone";

const staffProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician", "front_desk")
);

function extractDigits(value?: string | null): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export const duplicateShieldRouter = createRouter({
  /**
   * Realtime Anti-Duplicate Shield for Client Intake.
   * Checks for duplicate owners by normalized phone or email in the practice.
   */
  checkClient: staffProcedure
    .input(
      z.object({
        email: z.string().optional(),
        phone: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const email = input.email?.trim();
      const phone = input.phone?.trim();

      if (!email && !phone) {
        return { found: false, client: null };
      }

      const conditions = [];

      if (email && email.includes("@")) {
        conditions.push(ilike(clients.email, email));
      }

      const phoneDigits = extractDigits(phone);
      if (phoneDigits.length >= 7) {
        const normalizedE164 = normalizeE164(phone);
        if (normalizedE164) {
          conditions.push(eq(clients.phone, normalizedE164));
        }
        // Also fallback to search if stored phone has different formatting
        conditions.push(
          sql`regexp_replace(${clients.phone}, '\\D', '', 'g') LIKE ${`%${phoneDigits.slice(-9)}%`}`
        );
      }

      if (conditions.length === 0) {
        return { found: false, client: null };
      }

      const [existingClient] = await ctx.db
        .select({
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          email: clients.email,
          phone: clients.phone,
        })
        .from(clients)
        .where(
          and(
            eq(clients.practiceId, ctx.practiceId),
            isNull(clients.deletedAt),
            or(...conditions)
          )
        )
        .limit(1);

      if (existingClient) {
        return {
          found: true,
          client: existingClient,
        };
      }

      return {
        found: false,
        client: null,
      };
    }),

  /**
   * Realtime Anti-Duplicate Shield for Patient Intake.
   * Checks for duplicate animals by microchip number in the practice.
   */
  checkPatient: staffProcedure
    .input(
      z.object({
        microchipNumber: z.string().min(5, "Zadajte aspoň 5 znakov čísla mikročipu"),
      })
    )
    .query(async ({ ctx, input }) => {
      const chip = input.microchipNumber.trim();
      if (!chip) {
        return { found: false, patient: null };
      }

      const [existingPatient] = await ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
          breed: patients.breed,
          microchipNumber: patients.microchipNumber,
          clientId: patients.clientId,
          ownerFirstName: clients.firstName,
          ownerLastName: clients.lastName,
        })
        .from(patients)
        .leftJoin(clients, eq(patients.clientId, clients.id))
        .where(
          and(
            eq(patients.practiceId, ctx.practiceId),
            isNull(patients.deletedAt),
            eq(patients.microchipNumber, chip)
          )
        )
        .limit(1);

      if (existingPatient) {
        const ownerName =
          existingPatient.ownerFirstName && existingPatient.ownerLastName
            ? `${existingPatient.ownerFirstName} ${existingPatient.ownerLastName}`
            : undefined;

        return {
          found: true,
          patient: {
            id: existingPatient.id,
            name: existingPatient.name,
            species: existingPatient.species,
            breed: existingPatient.breed,
            microchipNumber: existingPatient.microchipNumber,
            clientId: existingPatient.clientId,
            ownerName,
          },
        };
      }

      return {
        found: false,
        patient: null,
      };
    }),
});
