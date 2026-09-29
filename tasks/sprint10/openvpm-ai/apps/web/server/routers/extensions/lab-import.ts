import { z } from "zod";
import { eq, and, isNull, desc, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  labAnalyzerReports,
  labResults,
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

  /**
   * Lab report import (text/PDF/image bytes).
   *
   * HONESTY CONTRACT: this is a DETERMINISTIC text parser (regex over the
   * decoded content) — it is NOT an AI/OCR model and must never be labelled as
   * one. It reports no numeric "confidence": a fabricated score inside the
   * clinician confirmation gate destroys the value of that gate. The returned
   * `parseMethod`/`aiGenerated` fields exist so the UI can state the real
   * provenance. Every imported value requires veterinarian review (Act 39/2007).
   */
  parsePdfOrImageReport: staffProcedure
    .input(
      z.object({
        patientId: z.string().uuid().optional(),
        clientId: z.string().uuid().optional(),
        fileName: z.string().default("lab_report.pdf"),
        fileContentBase64: z.string().min(1, "Súbor je prázdny"),
        mimeType: z.string().default("application/pdf"),
        species: z.enum(["canine", "feline", "other"]).default("canine"),
        createDraft: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Decode base64 to extract text
      let textContent = "";
      try {
        let clean = input.fileContentBase64.trim();
        if (clean.includes(",")) {
          clean = clean.split(",")[1] ?? clean;
        }
        const buffer = Buffer.from(clean, "base64");
        textContent = buffer.toString("utf-8");
      } catch {
        textContent = "";
      }

      // 2. Parse using autoDetectAndParse
      const parsed = autoDetectAndParse({
        content: textContent,
        filename: input.fileName,
        species: input.species,
      });

      // 3. Provenance (no fabricated score): a row count is not a probability.
      // The parser either recognised rows or it did not; anything recognised is
      // still transcribed text that the veterinarian must verify.
      const requiresManualReview = true;

      let draftReportId: string | undefined;

      // 4. Optionally create draft in DB for veterinarian diff confirmation
      if (input.createDraft && parsed.results.length > 0) {
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

        const [report] = await ctx.db
          .insert(labAnalyzerReports)
          .values({
            practiceId: ctx.practiceId,
            patientId: input.patientId ?? null,
            clientId: resolvedClientId ?? null,
            analyzerType: parsed.analyzerType,
            deviceModel:
              parsed.deviceModel ?? "Automatické čítanie textu reportu (bez AI)",
            species: input.species,
            fileName: input.fileName,
            rawContent: textContent.slice(0, 10000),
            parsedResults: parsed.results,
            abnormalCount: parsed.abnormalCount,
            criticalCount: parsed.criticalCount,
            status,
            notes:
              "Automatické prepísanie hodnôt z textu reportu (deterministický parser, bez AI modelu). Vyžaduje kontrolu a potvrdenie lekárom pred finalizáciou (Zákon 39/2007 Z. z.).",
          })
          .returning();

        draftReportId = report?.id;
      }

      return {
        ...parsed,
        /** Provenance: deterministic parser, no model involved. */
        parseMethod: "deterministic_text_parser" as const,
        aiGenerated: false,
        parsedRowCount: parsed.results.length,
        requiresManualReview,
        draftReportId,
        requiresVetApproval: true,
      };
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
          "LABTECHNIK",
          "INLAB",
          "QUICKSEAL",
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
          message: "Patient not found",
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

  /**
   * Získa longitudinálnu históriu a trendy kľúčových analytov pacienta
   * (Kreatinín, Močovina, ALT, ALP, Glukóza, Leukocyty).
   */
  getPatientAnalyteHistory: staffProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const TARGET_CONFIGS = [
        {
          code: "CREA",
          name: "Kreatinín (CREA)",
          defaultUnit: "µmol/L",
          category: "Obličkový profil",
          aliases: ["CREA", "CREATININE", "KREATININ", "KREAT"],
        },
        {
          code: "UREA",
          name: "Močovina (Urea / BUN)",
          defaultUnit: "mmol/L",
          category: "Obličkový profil",
          aliases: ["UREA", "BUN", "MOCOVINA", "MOC"],
        },
        {
          code: "ALT",
          name: "ALT (Alanínaminotransferáza)",
          defaultUnit: "U/L",
          category: "Pečeňový profil",
          aliases: ["ALT", "ALAT", "SGPT"],
        },
        {
          code: "ALP",
          name: "ALP (Alkalická fosfatáza)",
          defaultUnit: "U/L",
          category: "Pečeňový profil",
          aliases: ["ALP", "ALKP", "AP"],
        },
        {
          code: "GLU",
          name: "Glukóza (GLU)",
          defaultUnit: "mmol/L",
          category: "Metabolický profil",
          aliases: ["GLU", "GLUCOSE", "GLUKOZA", "GLUK"],
        },
        {
          code: "WBC",
          name: "Leukocyty (WBC)",
          defaultUnit: "10^9/L",
          category: "Hematologický profil",
          aliases: ["WBC", "LEU", "LEUKOCYTES", "LEUKOCYTY", "LEUK"],
        },
      ];

      // 1. Fetch analyzer reports for this patient
      const reports = await ctx.db.query.labAnalyzerReports.findMany({
        where: and(
          eq(labAnalyzerReports.patientId, input.patientId),
          eq(labAnalyzerReports.practiceId, ctx.practiceId),
          isNull(labAnalyzerReports.deletedAt)
        ),
        orderBy: [asc(labAnalyzerReports.createdAt)],
      });

      // 2. Fetch clinical lab results for this patient
      const clinicalRows = await ctx.db.query.labResults.findMany({
        where: and(
          eq(labResults.patientId, input.patientId),
          eq(labResults.practiceId, ctx.practiceId),
          isNull(labResults.deletedAt)
        ),
        orderBy: [asc(labResults.createdAt)],
      });

      // 3. For each target config, collect data points
      const trends = TARGET_CONFIGS.map((cfg) => {
        const datapoints: Array<{
          id: string;
          date: string;
          value: number;
          unit: string;
          refLow: number | null;
          refHigh: number | null;
          flag: "NORMAL" | "HIGH" | "LOW" | "CRITICAL" | "unknown";
          source: string;
        }> = [];

        // From analyzer reports
        for (const report of reports) {
          const reportDate = (report.sampleDate || report.createdAt || new Date()).toISOString();
          const items = (report.parsedResults as LabAnalyteResult[]) || [];
          for (const item of items) {
            const codeUpper = (item.code || "").toUpperCase().trim();
            const nameUpper = (item.name || "").toUpperCase().trim();
            const matched =
              cfg.aliases.includes(codeUpper) ||
              cfg.aliases.some((a) => nameUpper.includes(a));

            if (matched && typeof item.value === "number" && !isNaN(item.value)) {
              datapoints.push({
                id: `${report.id}-${cfg.code}`,
                date: reportDate,
                value: item.value,
                unit: item.unit || cfg.defaultUnit,
                refLow: item.refLow ?? null,
                refHigh: item.refHigh ?? null,
                flag: (item.flag as any) || "NORMAL",
                source: report.fileName || report.analyzerType,
              });
            }
          }
        }

        // From clinical results
        for (const row of clinicalRows) {
          const rowDate = (row.completedAt || row.createdAt || new Date()).toISOString();
          const nameUpper = (row.testName || "").toUpperCase().trim();
          const matched = cfg.aliases.some((a) => nameUpper.includes(a));

          if (matched && row.resultValue) {
            const parsedVal = parseFloat(row.resultValue.replace(",", "."));
            if (!isNaN(parsedVal)) {
              datapoints.push({
                id: `${row.id}-${cfg.code}`,
                date: rowDate,
                value: parsedVal,
                unit: row.unit || cfg.defaultUnit,
                refLow: row.referenceRangeLow ? parseFloat(row.referenceRangeLow) : null,
                refHigh: row.referenceRangeHigh ? parseFloat(row.referenceRangeHigh) : null,
                flag: (row.resultFlag?.toUpperCase() as any) || "NORMAL",
                source: "Klinické vyšetrenie",
              });
            }
          }
        }

        // Sort datapoints chronologically
        datapoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const latest = datapoints.length > 0 ? datapoints[datapoints.length - 1] : null;
        const previous = datapoints.length > 1 ? datapoints[datapoints.length - 2] : null;

        const latestValue = latest ? latest.value : null;
        const previousValue = previous ? previous.value : null;
        const unit = latest?.unit || cfg.defaultUnit;

        let diff: number | null = null;
        let diffPercent: number | null = null;
        let trend: "up" | "down" | "stable" | "none" = "none";

        if (latestValue !== null && previousValue !== null) {
          diff = Number((latestValue - previousValue).toFixed(2));
          diffPercent =
            previousValue !== 0
              ? Number((((latestValue - previousValue) / previousValue) * 100).toFixed(1))
              : 0;

          // Threshold 5% for up/down
          if (latestValue > previousValue * 1.05) {
            trend = "up";
          } else if (latestValue < previousValue * 0.95) {
            trend = "down";
          } else {
            trend = "stable";
          }
        }

        return {
          code: cfg.code,
          name: cfg.name,
          category: cfg.category,
          unit,
          datapoints,
          count: datapoints.length,
          latestValue,
          latestDate: latest?.date ?? null,
          latestFlag: latest?.flag ?? "unknown",
          previousValue,
          previousDate: previous?.date ?? null,
          diff,
          diffPercent,
          trend,
          refLow: latest?.refLow ?? null,
          refHigh: latest?.refHigh ?? null,
        };
      });

      return {
        patientId: input.patientId,
        reportsCount: reports.length,
        clinicalResultsCount: clinicalRows.length,
        trends,
      };
    }),
});
