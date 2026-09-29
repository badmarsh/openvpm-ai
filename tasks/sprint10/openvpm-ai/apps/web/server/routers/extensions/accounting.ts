import { z } from "zod";
import { eq, and, isNull, gte, lte, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  invoices,
  invoiceItems,
  ekasaReceipts,
  practices,
  clients,
} from "@openpims/db";
import {
  generatePohodaXml,
  generateKrosCsv,
  type AccountingInvoiceItem,
  type AccountingEkasaItem,
} from "@/lib/accounting/export";
import { buildIsdocXml } from "@/lib/accounting/isdoc-export";

const accountingProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian")
);

export const accountingRouter = createRouter({
  /** Exportuje podklady pre účtovníctvo (Pohoda XML alebo KROS CSV) */
  exportData: accountingProcedure
    .input(
      z.object({
        dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Neplatný formát dátumu (RRRR-MM-DD)"),
        dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Neplatný formát dátumu (RRRR-MM-DD)"),
        format: z.enum(["pohoda_xml", "kros_omega"]).default("pohoda_xml"),
        includeInvoices: z.boolean().default(true),
        includeEkasa: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const practice = await ctx.db.query.practices.findFirst({
        where: eq(practices.id, ctx.practiceId),
      });

      // Date filtering uses Slovakia local time (CET/CEST aware)
      const localDateFilter = (col: any, from: string, to: string) =>
        and(
          sql`date_trunc('day', ${col} AT TIME ZONE 'Europe/Bratislava')::text >= ${from}`,
          sql`date_trunc('day', ${col} AT TIME ZONE 'Europe/Bratislava')::text <= ${to}`,
        );

      // 1. Načítaj faktúry
      let formattedInvoices: AccountingInvoiceItem[] = [];
      if (input.includeInvoices) {
        const dbInvoices = await ctx.db.query.invoices.findMany({
          where: and(
            eq(invoices.practiceId, ctx.practiceId),
            isNull(invoices.deletedAt),
            eq(invoices.isEstimate, false),
            localDateFilter(invoices.createdAt, input.dateFrom, input.dateTo)
          ),
          with: {
            client: true,
            items: true,
          },
          orderBy: [desc(invoices.createdAt)],
        });

        formattedInvoices = dbInvoices.map((inv, idx) => {
          const client = inv.client;
          const subtotal = Number(inv.subtotal || 0);
          const total = Number(inv.total || 0);
          const tax = Number(inv.tax || 0);
          const createdYmd = inv.createdAt.toISOString().slice(0, 10);

          return {
            id: inv.id,
            invoiceNumber: `VF-${inv.id.slice(0, 8)}`,
            issueDate: createdYmd,
            taxDate: createdYmd,
            dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : createdYmd,
            clientName: client ? `${client.firstName} ${client.lastName}`.trim() : "Klient",
            clientAddress: client?.address ?? null,
            clientCity: client?.city ?? null,
            clientZip: client?.zip ?? null,
            total,
            subtotal,
            tax,
            vatRate: 23,
            status: inv.status,
            items: (inv.items || []).map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unitPrice: Number(it.unitPrice || 0),
              total: Number(it.total || 0),
            })),
          };
        });
      }

      // 2. Načítaj e-Kasa doklady
      let formattedReceipts: AccountingEkasaItem[] = [];
      if (input.includeEkasa) {
        const dbReceipts = await ctx.db.query.ekasaReceipts.findMany({
          where: and(
            eq(ekasaReceipts.practiceId, ctx.practiceId),
            isNull(ekasaReceipts.deletedAt),
            localDateFilter(ekasaReceipts.issuedAt, input.dateFrom, input.dateTo)
          ),
          orderBy: [desc(ekasaReceipts.issuedAt)],
        });

        formattedReceipts = dbReceipts.map((rc) => ({
          id: rc.id,
          receiptNumber: rc.receiptNumber,
          issuedAt: rc.issuedAt.toISOString(),
          amountBase: Number(rc.amountBase || 0),
          amountVat: Number(rc.amountVat || 0),
          amountTotal: Number(rc.amountTotal || 0),
          vatRate: rc.vatRate,
          paymentMethod: rc.paymentMethod,
          okp: rc.okp,
          uid: rc.uid,
        }));
      }

      // 3. Vypočítaj celkovú sumu
      const invTotal = formattedInvoices.reduce((sum, i) => sum + Math.round(i.total * 100), 0);
      const ekasaTotal = formattedReceipts.reduce((sum, r) => sum + Math.round(r.amountTotal * 100), 0);
      const totalAmount = ((invTotal + ekasaTotal) / 100).toFixed(2);

      // 4. Generuj výstupný formát
      let filename: string;
      let content: string;
      let mimeType: string;

      const dateSuffix = `${input.dateFrom}_do_${input.dateTo}`;
      const practiceIco = (practice as Record<string, unknown>)?.ico as string | undefined ?? "00000000";

      if (input.format === "pohoda_xml") {
        filename = `pohoda_export_${dateSuffix}.xml`;
        content = generatePohodaXml({
          practiceIco,
          clinicName: practice?.name ?? "Veterinárna ambulancia",
          invoices: formattedInvoices,
          ekasaReceipts: formattedReceipts,
        });
        mimeType = "application/xml;charset=utf-8";
      } else {
        filename = `kros_omega_export_${dateSuffix}.csv`;
        content = generateKrosCsv({
          invoices: formattedInvoices,
          ekasaReceipts: formattedReceipts,
        });
        mimeType = "text/csv;charset=utf-8";
      }

      return {
        filename,
        content,
        mimeType,
        invoiceCount: formattedInvoices.length,
        ekasaCount: formattedReceipts.length,
        totalAmount,
      };
    }),

  /** Exportuje faktúry vo formáte ISDOC 6.0.2 (CZ/SK elektronická faktúra) */
  exportIsdoc: accountingProcedure
    .input(
      z.object({
        dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Neplatný formát dátumu (RRRR-MM-DD)"),
        dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Neplatný formát dátumu (RRRR-MM-DD)"),
        invoiceId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const practice = await ctx.db.query.practices.findFirst({
        where: eq(practices.id, ctx.practiceId),
      });

      const conditions = [
        eq(invoices.practiceId, ctx.practiceId),
        isNull(invoices.deletedAt),
        eq(invoices.isEstimate, false),
        and(
          sql`date_trunc('day', ${invoices.createdAt} AT TIME ZONE 'Europe/Bratislava')::text >= ${input.dateFrom}`,
          sql`date_trunc('day', ${invoices.createdAt} AT TIME ZONE 'Europe/Bratislava')::text <= ${input.dateTo}`,
        ),
      ];
      if (input.invoiceId) {
        conditions.push(eq(invoices.id, input.invoiceId));
      }

      const dbInvoices = await ctx.db.query.invoices.findMany({
        where: and(...conditions),
        with: { client: true, items: true },
        orderBy: [desc(invoices.createdAt)],
      });

      if (dbInvoices.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No invoices found for the selected period",
        });
      }

      const practiceIco =
        ((practice as Record<string, unknown>)?.ico as string | undefined) ??
        "00000000";
      const clinicName = practice?.name ?? "Veterinárna ambulancia";
      const clinicAddress = practice?.address ?? "";
      const supplierVatId = practice?.vatNumber ?? undefined;

      const xml = buildIsdocXml({
        invoiceNumber: input.invoiceId
          ? `VF-${dbInvoices[0].id.slice(0, 8)}`
          : `${dbInvoices.length}-invoices`,
        issueDate: new Date(dbInvoices[0].createdAt).toISOString().slice(0, 10),
        dueDate: dbInvoices[0].dueDate
          ? new Date(dbInvoices[0].dueDate).toISOString().slice(0, 10)
          : new Date(dbInvoices[0].createdAt).toISOString().slice(0, 10),
        supplierIco: practiceIco,
        supplierName: clinicName,
        supplierAddress: clinicAddress,
        supplierVatId,
        customerIco: undefined,
        customerName: "Súhrn faktúr za obdobie",
        customerAddress: "",
        items: dbInvoices.flatMap((inv) =>
          (inv.items ?? []).map((it) => {
            const unitPrice = Number(it.unitPrice || 0);
            const totalWithoutVat = Number(it.total || 0);
            const totalWithVat = Math.round(totalWithoutVat * 1.23 * 100) / 100;
            return {
              description: it.description,
              quantity: it.quantity,
              unitPrice,
              vatRate: 23,
              totalWithoutVat,
              totalWithVat,
            };
          })
        ),
        totalWithoutVat: Math.round(
          dbInvoices.reduce((s, inv) => s + Number(inv.subtotal || 0) * 100, 0) / 100
        ),
        totalVat: Math.round(
          dbInvoices.reduce((s, inv) => s + Number(inv.tax || 0) * 100, 0) / 100
        ),
        totalWithVat: Math.round(
          dbInvoices.reduce((s, inv) => s + Number(inv.total || 0) * 100, 0) / 100
        ),
        currencyCode:
          (practice?.currency ?? "").toUpperCase() === "CZK" ? "CZK" : "EUR",
        note: `Súhrn faktúr ${input.dateFrom} – ${input.dateTo}`,
      });

      const dateSuffix = `${input.dateFrom}_do_${input.dateTo}`;
      return {
        filename: `isdoc_export_${dateSuffix}.xml`,
        content: xml,
        mimeType: "application/xml;charset=utf-8",
        invoiceCount: dbInvoices.length,
      };
    }),
});
