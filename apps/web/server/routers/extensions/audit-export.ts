import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { generateReportPdf } from "@/lib/pdf";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  collectTimelineEvents,
  buildAuditCsv,
  buildAuditManifest,
} from "@/lib/audit/export";

/**
 * Inšpekčný protokol ŠVPS SR / KVL SR / Finančná správa SR.
 *
 * Exportuje forenznú históriu kontrolovaných látok, knihy ošetrení alebo knihy
 * besnoty do:
 *   - CSV (semicolon-delimited, UTF-8 BOM),
 *   - JSON,
 *   - PDF reportu (tlačiteľný inšpekčný protokol),
 *   - SHA-256 podpisového sumára (manifest) potvrdzujúceho integritu exportu.
 *
 * Export je dostupný len pre roly admin / veterinarian.
 */
export const auditExportRouter = createRouter({
  exportInspectionProtocol: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        entityType: z.string().optional(),
        entityId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(5000).default(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.entityId && !input.entityType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "entityId vyžaduje aj entityType",
        });
      }

      const events = await collectTimelineEvents(ctx.db, ctx.practiceId, {
        entityType: input.entityType,
        entityId: input.entityId,
        limit: input.limit,
      });

      const csv = buildAuditCsv(events);
      const json = JSON.stringify(events, null, 2);
      const manifest = buildAuditManifest({ events, csv, json });

      const pdf = generateReportPdf({
        title: "Inšpekčný protokol — Audit Trail",
        subtitle:
          `ŠVPS SR / KVL SR · Počet udalostí: ${events.length} · ` +
          `SHA-256 (CSV): ${manifest.sha256Csv.slice(0, 16)}… · ` +
          `Vygenerované: ${new Date(manifest.generatedAt).toLocaleString("sk-SK")}`,
        columns: [
          "Kedy",
          "Kto",
          "Rola",
          "Akcia",
          "Typ",
          "Dôvod",
          "IP",
          "Pečať",
        ],
        rows: events.map((e) => [
          new Date(e.occurredAt).toLocaleString("sk-SK"),
          e.actorName ?? "—",
          e.actorRole ?? "—",
          e.action,
          e.entityType ?? "—",
          e.reason ?? "—",
          e.ipAddress ?? "—",
          e.eventHash ? `${e.eventHash.slice(0, 16)}…` : "—",
        ]),
        emptyMessage: "Pre zvolený filter neexistujú žiadne audit udalosti.",
        locale: "sk",
      });

      pdf.setProperties({
        title: "Inšpekčný protokol — Audit Trail (OpenVPM)",
        subject: "Forenzná história záznamu — ŠVPS SR / KVL SR",
        author: "OpenVPM",
        creator: "OpenVPM Audit Export",
      });

      const pdfBase64 = Buffer.from(pdf.output("arraybuffer")).toString(
        "base64"
      );

      return {
        csv,
        json,
        pdfBase64,
        manifest,
      };
    }),
});
