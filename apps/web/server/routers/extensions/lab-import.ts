import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  labAnalyzerReports,
  patients,
  clients,
  users,
} from "@openpims/db";
import {
  autoDetectAndParse,
  type LabAnalyteResult,
} from "@/lib/lab/analyzer-parser";

const staffProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician", "front_desk")
);

export const labImportRouter = createRouter({
  /** Parsuje surový obsah súboru z analyzátora (IDEXX, Fuji, Mindray, CSV) */
  parseFile: staffProcedure
    .input(
      z.object({
        content: z.string().min(1, "Obsah súboru je prázdny").max(10_485_760, "Súbor je príliš veľký (max 10 MB)"),
        fileName: z.string().optional(),
        species: z.enum(["canine", "feline", "other"]).default("canine"),
      })
    )
    .mutation(({ input }) => {
      const parsed = autoDetectAndParse({
        content: input.content,
        filename: input.fileName,
        species: input.species,
      });

      return parsed;
    }),

  /** Uloží naimportovaný laboratórny protokol */
  saveReport: staffProcedure
    .input(
      z.object({
        patientId: z.string().uuid().optional(),
        clientId: z.string().uuid().optional(),
        analyzerType: z.enum([
          "IDEXX",
          "FUJI_DRI_CHEM",
          "MINDRAY",
          "GENERIC_CSV",
          "MANUAL",
        ]),
        deviceModel: z.string().optional(),
        sampleId: z.string().optional(),
        sampleDate: z.string().optional(),
        species: z.string().optional(),
        fileName: z.string().optional(),
        rawContent: z.string().optional(),
        parsedResults: z.array(
          z.object({
            code: z.string(),
            name: z.string(),
            value: z.number(),
            valueString: z.string().optional(),
            unit: z.string(),
            refLow: z.number().nullable().optional(),
            refHigh: z.number().nullable().optional(),
            flag: z.enum(["NORMAL", "LOW", "HIGH", "CRITICAL"]),
            category: z
              .enum(["BIOCHEMISTRY", "HEMATOLOGY", "ELECTROLYTES", "URINALYSIS", "OTHER"])
              .optional(),
          })
        ),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let resolvedClientId = input.clientId;
      let status: "UNASSIGNED" | "ATTACHED" = "UNASSIGNED";

      if (input.patientId) {
        status = "ATTACHED";
        if (!resolvedClientId) {
          const patient = await ctx.db.query.patients.findFirst({
            where: and(
              eq(patients.id, input.patientId),
              eq(patients.practiceId, ctx.practiceId)
            ),
          });
          if (patient) {
            resolvedClientId = patient.clientId;
          }
        }
      }

      const abnormalCount = input.parsedResults.filter(
        (r) => r.flag === "HIGH" || r.flag === "LOW" || r.flag === "CRITICAL"
      ).length;
      const criticalCount = input.parsedResults.filter(
        (r) => r.flag === "CRITICAL"
      ).length;

      const [report] = await ctx.db
        .insert(labAnalyzerReports)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId ?? null,
          clientId: resolvedClientId ?? null,
          analyzerType: input.analyzerType,
          deviceModel: input.deviceModel ?? null,
          sampleId: input.sampleId ?? null,
          sampleDate: input.sampleDate ? new Date(input.sampleDate) : null,
          species: input.species ?? "canine",
          fileName: input.fileName ?? "lab_export.csv",
          rawContent: input.rawContent ?? null,
          parsedResults: input.parsedResults,
          abnormalCount,
          criticalCount,
          status,
          notes: input.notes ?? null,
        })
        .returning();

      return report;
    }),

  /** Zoznam laboratórnych protokolov v inboxe */
  listReports: staffProcedure
    .input(
      z
        .object({
          patientId: z.string().uuid().optional(),
          status: z.enum(["UNASSIGNED", "ATTACHED", "REVIEWED"]).optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(labAnalyzerReports.practiceId, ctx.practiceId),
        isNull(labAnalyzerReports.deletedAt),
      ];

      if (input?.patientId) {
        conditions.push(eq(labAnalyzerReports.patientId, input.patientId));
      }
      if (input?.status) {
        conditions.push(eq(labAnalyzerReports.status, input.status));
      }

      const items = await ctx.db.query.labAnalyzerReports.findMany({
        where: and(...conditions),
        orderBy: [desc(labAnalyzerReports.createdAt)],
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
        with: {
          patient: true,
          client: true,
          reviewer: true,
        },
      });

      return items;
    }),

  /** Detail protokolu */
  getReport: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const report = await ctx.db.query.labAnalyzerReports.findFirst({
        where: and(
          eq(labAnalyzerReports.id, input.id),
          eq(labAnalyzerReports.practiceId, ctx.practiceId)
        ),
        with: {
          patient: true,
          client: true,
          reviewer: true,
        },
      });

      if (!report) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Laboratórny protokol nebol nájdený",
        });
      }

      return report;
    }),

  /** Priradí nezaradený protokol pacientovi */
  assignReport: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        patientId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.db.query.labAnalyzerReports.findFirst({
        where: and(
          eq(labAnalyzerReports.id, input.id),
          eq(labAnalyzerReports.practiceId, ctx.practiceId),
        ),
      });

      if (!report) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Laboratórny protokol nebol nájdený",
        });
      }

      if (report.status === "REVIEWED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Schválený protokol nie je možné priradiť",
        });
      }

      const patient = await ctx.db.query.patients.findFirst({
        where: and(
          eq(patients.id, input.patientId),
          eq(patients.practiceId, ctx.practiceId)
        ),
      });

      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pacient nebol nájdený",
        });
      }

      const [updated] = await ctx.db
        .update(labAnalyzerReports)
        .set({
          patientId: input.patientId,
          clientId: patient.clientId,
          status: "ATTACHED",
          updatedAt: new Date(),
        })
        .where(eq(labAnalyzerReports.id, input.id))
        .returning();

      return updated;
    }),

  /** Schváli a uzavrie laboratórny nález lekárom */
  reviewReport: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.labAnalyzerReports.findFirst({
        where: and(
          eq(labAnalyzerReports.id, input.id),
          eq(labAnalyzerReports.practiceId, ctx.practiceId),
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Laboratórny protokol nebol nájdený",
        });
      }

      if (existing.status === "REVIEWED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Protokol už bol schválený a nie je možné ho znova potvrdiť",
        });
      }

      const [updated] = await ctx.db
        .update(labAnalyzerReports)
        .set({
          status: "REVIEWED",
          reviewedById: ctx.user.id,
          reviewedAt: new Date(),
          notes: input.notes ?? undefined,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(labAnalyzerReports.id, input.id),
            eq(labAnalyzerReports.practiceId, ctx.practiceId)
          )
        )
        .returning();

      return updated;
    }),
});
