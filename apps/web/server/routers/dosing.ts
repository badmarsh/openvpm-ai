import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure } from "../trpc";
import { FORMULARY, DOSING_DISCLAIMER, calculateDose } from "@/lib/dosing";

export const dosingRouter = createRouter({
  /** List the formulary for a drug picker. */
  formulary: protectedProcedure.query(() => {
    return {
      disclaimer: DOSING_DISCLAIMER,
      drugs: FORMULARY.map((d) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        species: d.doses.map((dose) => dose.species),
        concentrationsMgPerMl: d.concentrationsMgPerMl ?? [],
        tabletStrengthsMg: d.tabletStrengthsMg ?? [],
      })),
    };
  }),

  /** Calculate a weight-based dose range. */
  calculate: protectedProcedure
    .input(
      z.object({
        drugId: z.string().min(1),
        species: z.enum(["canine", "feline"]),
        weightKg: z.number().positive(),
        concentrationMgPerMl: z.number().positive().optional(),
      })
    )
    .query(({ input }) => {
      try {
        return calculateDose(input);
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : "Unable to calculate dose",
        });
      }
    }),
});
