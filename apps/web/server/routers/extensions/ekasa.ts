import { z } from "zod";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  createRouter,
  protectedProcedure,
  requireRole,
} from "../../trpc";
import {
  ekasaConfig,
  ekasaReceipts,
  ekasaDailyClosures,
  practices,
  invoiceItems,
  invoices,
} from "@openpims/db";
import {
  processEkasaReceipt,
  generateQrCodeData,
  sendToEkasaApi,
  calculateVatAmounts,
  computeDailySummary,
  createDailyClosure,
  type EkasaVatRateType,
} from "@/lib/ekasa/service";
import { generateReceiptHtml } from "@/lib/ekasa/receipt-template";

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------
const ekasaConfigInput = z.object({
  dic: z.string().min(1, "DIČ je povinné").max(100),
  icDph: z.string().max(100).optional(),
  pokladnicaId: z.string().min(1, "ID pokladnice je povinné").max(100),
  pokladnicaType: z.enum(["ORP", "VRP", "CLOUD"]).default("CLOUD"),
  ekasaApiUrl: z
    .string()
    .url("Musí byť platné URL")
    .default("https://ekasa.financnasprava.sk/oto/api"),
  offlineModeEnabled: z.boolean().default(false),
  cashlessEnabled: z.boolean().default(false),
});

const createReceiptInput = z.object({
  invoiceId: z.string().uuid().optional(),
  amountBase: z.string().regex(/^\d+(\.\d{1,2})?$/, "Neplatná suma"),
  amountVat: z.string().regex(/^\d+(\.\d{1,2})?$/, "Neplatná suma"),
  amountTotal: z.string().regex(/^\d+(\.\d{1,2})?$/, "Neplatná suma"),
  vatRate: z
    .enum(["ZERO", "REDUCED", "STANDARD", "REDUCED_5", "REDUCED_19", "STANDARD_23"])
    .default("STANDARD_23"),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER"]).default("CARD"),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        qty: z.number().min(1),
        unitPrice: z.string(),
        vatRate: z.string(),
      })
    )
    .min(1, "Minimálne jedna položka"),
  issuedAt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export const ekasaRouter = createRouter({
  /** Načíta konfiguráciu e-Kasa pre kliniku */
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const config = await ctx.db.query.ekasaConfig.findFirst({
      where: and(
        eq(ekasaConfig.practiceId, ctx.practiceId),
        isNull(ekasaConfig.deletedAt)
      ),
    });
    return config ?? null;
  }),

  /** Vytvorí alebo aktualizuje konfiguráciu e-Kasa */
  updateConfig: protectedProcedure
    .use(requireRole("admin"))
    .input(ekasaConfigInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.ekasaConfig.findFirst({
        where: and(
          eq(ekasaConfig.practiceId, ctx.practiceId),
          isNull(ekasaConfig.deletedAt)
        ),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(ekasaConfig)
          .set({
            ...input,
            icDph: input.icDph ?? null,
          })
          .where(eq(ekasaConfig.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(ekasaConfig)
        .values({
          practiceId: ctx.practiceId,
          ...input,
          icDph: input.icDph ?? null,
        })
        .returning();
      return created;
    }),

  /** Zoznam dokladov s filtrom a stránkovaním */
  getReceipts: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().min(0).default(0),
          status: z
            .enum(["PENDING", "SENT", "CONFIRMED", "FAILED", "OFFLINE_STORED"])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(ekasaReceipts.practiceId, ctx.practiceId),
        isNull(ekasaReceipts.deletedAt),
      ];

      if (input?.status) {
        conditions.push(eq(ekasaReceipts.status, input.status));
      }

      const items = await ctx.db.query.ekasaReceipts.findMany({
        where: and(...conditions),
        orderBy: [desc(ekasaReceipts.issuedAt)],
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
        with: {
          invoice: true,
        },
      });

      return items;
    }),

  /** Vytvorí, podpíše a odošle nový pokladničný doklad */
  createReceipt: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(createReceiptInput)
    .mutation(async ({ ctx, input }) => {
      const config = await ctx.db.query.ekasaConfig.findFirst({
        where: and(
          eq(ekasaConfig.practiceId, ctx.practiceId),
          eq(ekasaConfig.isActive, true),
          isNull(ekasaConfig.deletedAt)
        ),
      });

      if (!config) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "e-Kasa nie je pre túto kliniku nakonfigurovaná. Nastavte ju v Nastavenia -> e-Kasa.",
        });
      }

      const issuedAt = input.issuedAt ? new Date(input.issuedAt) : new Date();

      const result = await processEkasaReceipt(
        {
          practiceId: ctx.practiceId,
          invoiceId: input.invoiceId,
          amountBase: input.amountBase,
          amountVat: input.amountVat,
          amountTotal: input.amountTotal,
          vatRate: input.vatRate,
          paymentMethod: input.paymentMethod,
          items: input.items,
          issuedAt,
        },
        config
      );

      return result;
    }),

  /** Opakovaný pokus o odoslanie offline alebo zlyhaného dokladu */
  retryReceipt: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(z.object({ receiptId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const receipt = await ctx.db.query.ekasaReceipts.findFirst({
        where: and(
          eq(ekasaReceipts.id, input.receiptId),
          eq(ekasaReceipts.practiceId, ctx.practiceId),
          isNull(ekasaReceipts.deletedAt)
        ),
      });

      if (!receipt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Doklad nebol nájdený",
        });
      }

      if (receipt.status === "CONFIRMED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Doklad už bol úspešne odoslaný",
        });
      }

      const config = await ctx.db.query.ekasaConfig.findFirst({
        where: and(
          eq(ekasaConfig.practiceId, ctx.practiceId),
          eq(ekasaConfig.isActive, true),
          isNull(ekasaConfig.deletedAt)
        ),
      });

      if (!config) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "e-Kasa konfigurácia chýba",
        });
      }

      const apiResult = await sendToEkasaApi({
        apiUrl: config.ekasaApiUrl,
        receiptNumber: receipt.receiptNumber,
        dic: config.dic,
        pokladnicaId: config.pokladnicaId,
        amountTotal: receipt.amountTotal,
        amountVat: receipt.amountVat,
        paymentMethod: receipt.paymentMethod,
        okp: receipt.okp ?? "",
        pkp: receipt.pkp ?? "",
        issuedAt: receipt.issuedAt,
        items: [{ name: "Veterinárne služby", qty: 1, unitPrice: receipt.amountTotal, vatRate: receipt.vatRate }],
      });

      const newStatus = apiResult.success ? "CONFIRMED" : "FAILED";

      await ctx.db
        .update(ekasaReceipts)
        .set({
          status: newStatus,
          uid: apiResult.uid ?? receipt.uid,
          rawResponse: apiResult.rawResponse ?? null,
          lastRetryAt: new Date(),
        })
        .where(eq(ekasaReceipts.id, receipt.id));

      return { success: apiResult.success, status: newStatus, uid: apiResult.uid };
    }),

  /** Generuje HTML pre tlač dokladu na termálnej tlačiarni (58mm / 80mm) */
  printReceipt: protectedProcedure
    .input(
      z.object({
        receiptId: z.string().uuid(),
        paperWidth: z.enum(["58mm", "80mm"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const receipt = await ctx.db.query.ekasaReceipts.findFirst({
        where: and(
          eq(ekasaReceipts.id, input.receiptId),
          eq(ekasaReceipts.practiceId, ctx.practiceId),
          isNull(ekasaReceipts.deletedAt)
        ),
      });

      if (!receipt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Doklad nebol nájdený",
        });
      }

      const config = await ctx.db.query.ekasaConfig.findFirst({
        where: and(
          eq(ekasaConfig.practiceId, ctx.practiceId),
          isNull(ekasaConfig.deletedAt)
        ),
      });

      const practice = await ctx.db.query.practices.findFirst({
        where: eq(practices.id, ctx.practiceId),
      });

      const clinicName = practice?.name ?? "Veterinárna ambulancia";

      const html = generateReceiptHtml(receipt, {
        clinicName,
        address: null,
        phone: null,
        dic: config?.dic ?? "0000000000",
        icDph: config?.icDph,
        pokladnicaId: config?.pokladnicaId ?? "ORP-00000",
        paperWidth: input.paperWidth ?? "80mm",
      });

      return { html };
    }),

  /**
   * Automatické vystavenie pokladničného dokladu z úhrady faktúry (Zero-Touch checkout).
   * Spúšťa sa priamo po zaznamenaní platby v ambulancii.
   */
  createReceiptFromPayment: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        paymentId: z.string().uuid().optional(),
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Neplatná suma"),
        paymentMethod: z.enum([
          "cash",
          "credit_card",
          "debit_card",
          "check",
          "online",
          "other",
        ]),
        vatRate: z
          .enum([
            "ZERO",
            "REDUCED",
            "STANDARD",
            "REDUCED_5",
            "REDUCED_19",
            "STANDARD_23",
          ])
          .default("STANDARD_23"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Over e-Kasa konfiguráciu
      const config = await ctx.db.query.ekasaConfig.findFirst({
        where: and(
          eq(ekasaConfig.practiceId, ctx.practiceId),
          eq(ekasaConfig.isActive, true),
          isNull(ekasaConfig.deletedAt)
        ),
      });

      if (!config) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "e-Kasa nie je pre túto kliniku nakonfigurovaná. Prosím nastavte ju v Nastavenia -> e-Kasa.",
        });
      }

      // 2. Ak už existuje doklad k tejto platbe, vráť existujúci
      if (input.paymentId) {
        const existing = await ctx.db.query.ekasaReceipts.findFirst({
          where: and(
            eq(ekasaReceipts.practiceId, ctx.practiceId),
            eq(ekasaReceipts.paymentId, input.paymentId),
            isNull(ekasaReceipts.deletedAt)
          ),
        });

        if (existing) {
          const qrUrl = generateQrCodeData({
            uid: existing.uid,
            dic: config.dic,
            amountTotal: existing.amountTotal,
            receiptNumber: existing.receiptNumber,
          });

          const practice = await ctx.db.query.practices.findFirst({
            where: eq(practices.id, ctx.practiceId),
          });

          const html = generateReceiptHtml(existing, {
            clinicName: practice?.name ?? "Veterinárna ambulancia",
            address: null,
            phone: null,
            dic: config.dic,
            icDph: config.icDph,
            pokladnicaId: config.pokladnicaId,
          });

          return {
            receiptId: existing.id,
            receiptNumber: existing.receiptNumber,
            amountTotal: existing.amountTotal,
            status: existing.status,
            uid: existing.uid,
            okp: existing.okp,
            qrUrl,
            html,
            alreadyExists: true,
          };
        }
      }

      // 3. Načítaj položky faktúry
      const items = await ctx.db.query.invoiceItems.findMany({
        where: and(
          eq(invoiceItems.invoiceId, input.invoiceId),
          isNull(invoiceItems.deletedAt)
        ),
      });

      const mappedItems =
        items.length > 0
          ? items.map((it) => ({
              name: it.description,
              qty: it.quantity,
              unitPrice: it.unitPrice,
              vatRate: input.vatRate,
            }))
          : [
              {
                name: "Veterinárne úkony a vyšetrenie",
                qty: 1,
                unitPrice: input.amount,
                vatRate: input.vatRate,
              },
            ];

      // 4. Namapuj platobnú metódu
      const mappedMethod: "CASH" | "CARD" | "TRANSFER" =
        input.paymentMethod === "cash"
          ? "CASH"
          : input.paymentMethod === "credit_card" ||
            input.paymentMethod === "debit_card"
          ? "CARD"
          : "TRANSFER";

      // 5. Vypočítaj základ a DPH
      const { base, vat } = calculateVatAmounts(
        Number(input.amount),
        input.vatRate as EkasaVatRateType
      );

      // 6. Spracuj, podpíš a odošli doklad
      const result = await processEkasaReceipt(
        {
          practiceId: ctx.practiceId,
          invoiceId: input.invoiceId,
          paymentId: input.paymentId,
          amountBase: base,
          amountVat: vat,
          amountTotal: input.amount,
          vatRate: input.vatRate as EkasaVatRateType,
          paymentMethod: mappedMethod,
          items: mappedItems,
          issuedAt: new Date(),
        },
        config
      );

      const receipt = await ctx.db.query.ekasaReceipts.findFirst({
        where: eq(ekasaReceipts.id, result.receiptId),
      });

      const qrUrl = generateQrCodeData({
        uid: result.uid,
        dic: config.dic,
        amountTotal: input.amount,
        receiptNumber: receipt?.receiptNumber ?? "",
      });

      const practice = await ctx.db.query.practices.findFirst({
        where: eq(practices.id, ctx.practiceId),
      });

      const html = receipt
        ? generateReceiptHtml(receipt, {
            clinicName: practice?.name ?? "Veterinárna ambulancia",
            address: null,
            phone: null,
            dic: config.dic,
            icDph: config.icDph,
            pokladnicaId: config.pokladnicaId,
          })
        : "";

      return {
        receiptId: result.receiptId,
        receiptNumber: receipt?.receiptNumber ?? "",
        amountTotal: input.amount,
        status: result.status,
        uid: result.uid,
        okp: receipt?.okp ?? "",
        qrUrl,
        html,
        alreadyExists: false,
      };
    }),

  /** Vyhľadá existujúci e-Kasa doklad priradený k platbe alebo faktúre */
  getReceiptForPayment: protectedProcedure
    .input(
      z.object({
        paymentId: z.string().uuid().optional(),
        invoiceId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!input.paymentId && !input.invoiceId) return null;

      const conditions = [
        eq(ekasaReceipts.practiceId, ctx.practiceId),
        isNull(ekasaReceipts.deletedAt),
      ];

      if (input.paymentId) {
        conditions.push(eq(ekasaReceipts.paymentId, input.paymentId));
      } else if (input.invoiceId) {
        conditions.push(eq(ekasaReceipts.invoiceId, input.invoiceId));
      }

      const receipt = await ctx.db.query.ekasaReceipts.findFirst({
        where: and(...conditions),
        orderBy: [desc(ekasaReceipts.issuedAt)],
      });

      return receipt ?? null;
    }),

  /** Živý sumár dennej tržby pre daný dátum */
  getDailyClosureSummary: protectedProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const dateStr = input?.date ?? new Date().toISOString().slice(0, 10);
      const summary = await computeDailySummary(ctx.practiceId, dateStr);

      const existing = await ctx.db.query.ekasaDailyClosures.findFirst({
        where: and(
          eq(ekasaDailyClosures.practiceId, ctx.practiceId),
          eq(ekasaDailyClosures.date, dateStr),
          isNull(ekasaDailyClosures.deletedAt)
        ),
      });

      return {
        date: dateStr,
        isClosed: !!existing,
        closureNumber: existing?.closureNumber ?? null,
        closedAt: existing?.closedAt ?? null,
        summary,
      };
    }),

  /** Manuálne alebo automatické vykonanie dennej uzávierky (Z-report) */
  performDailyClosure: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(z.object({ date: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const dateStr = input?.date ?? new Date().toISOString().slice(0, 10);
      const closure = await createDailyClosure({
        practiceId: ctx.practiceId,
        dateStr,
        userId: ctx.session?.user?.id,
      });
      return closure;
    }),

  /** Zoznam historických denných uzávierok */
  getDailyClosures: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(30),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.ekasaDailyClosures.findMany({
        where: and(
          eq(ekasaDailyClosures.practiceId, ctx.practiceId),
          isNull(ekasaDailyClosures.deletedAt)
        ),
        orderBy: [desc(ekasaDailyClosures.date)],
        limit: input?.limit ?? 30,
        offset: input?.offset ?? 0,
        with: {
          closedByUser: true,
        },
      });
    }),

  /** Mesačný export a sumár tržieb pre účtovníctvo kliniky */
  getAccountantExport: protectedProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      })
    )
    .query(async ({ ctx, input }) => {
      const monthStr = input.month.toString().padStart(2, "0");
      const monthPrefix = `${input.year}-${monthStr}`;

      const closures = await ctx.db.query.ekasaDailyClosures.findMany({
        where: and(
          eq(ekasaDailyClosures.practiceId, ctx.practiceId),
          isNull(ekasaDailyClosures.deletedAt),
          sql`${ekasaDailyClosures.date} LIKE ${monthPrefix + "%"}`
        ),
        orderBy: [ekasaDailyClosures.date],
      });

      let totalAmount = 0;
      let cashAmount = 0;
      let cardAmount = 0;
      let transferAmount = 0;
      let receiptsCount = 0;
      let vat23Base = 0,
        vat23Tax = 0;
      let vat19Base = 0,
        vat19Tax = 0;
      let vat5Base = 0,
        vat5Tax = 0;
      let vat0Base = 0;

      for (const c of closures) {
        totalAmount += Number(c.totalAmount) || 0;
        cashAmount += Number(c.cashAmount) || 0;
        cardAmount += Number(c.cardAmount) || 0;
        transferAmount += Number(c.transferAmount) || 0;
        receiptsCount += Number(c.receiptsCount) || 0;

        const vb = c.vatBreakdown as any;
        if (vb) {
          vat23Base += vb.vat23?.base ?? 0;
          vat23Tax += vb.vat23?.vat ?? 0;
          vat19Base += vb.vat19?.base ?? 0;
          vat19Tax += vb.vat19?.vat ?? 0;
          vat5Base += vb.vat5?.base ?? 0;
          vat5Tax += vb.vat5?.vat ?? 0;
          vat0Base += vb.vat0?.base ?? 0;
        }
      }

      const round = (n: number) => Math.round(n * 100) / 100;

      const csvRows = [
        "Datum;Cislo_uzavierky;Pocet_dokladov;Hotovost_EUR;Karta_EUR;Prevod_EUR;Spolu_EUR;Zaklad_23_EUR;DPH_23_EUR;Zaklad_19_EUR;DPH_19_EUR;Zaklad_5_EUR;DPH_5_EUR;Oslobodene_0_EUR",
        ...closures.map((c) => {
          const vb = c.vatBreakdown as any;
          return [
            c.date,
            c.closureNumber,
            c.receiptsCount,
            c.cashAmount,
            c.cardAmount,
            c.transferAmount,
            c.totalAmount,
            (vb?.vat23?.base ?? 0).toFixed(2),
            (vb?.vat23?.vat ?? 0).toFixed(2),
            (vb?.vat19?.base ?? 0).toFixed(2),
            (vb?.vat19?.vat ?? 0).toFixed(2),
            (vb?.vat5?.base ?? 0).toFixed(2),
            (vb?.vat5?.vat ?? 0).toFixed(2),
            (vb?.vat0?.base ?? 0).toFixed(2),
          ].join(";");
        }),
      ];

      return {
        month: monthPrefix,
        closuresCount: closures.length,
        receiptsCount,
        totals: {
          totalAmount: round(totalAmount),
          cashAmount: round(cashAmount),
          cardAmount: round(cardAmount),
          transferAmount: round(transferAmount),
          vat23: { base: round(vat23Base), vat: round(vat23Tax) },
          vat19: { base: round(vat19Base), vat: round(vat19Tax) },
          vat5: { base: round(vat5Base), vat: round(vat5Tax) },
          vat0: { base: round(vat0Base), vat: 0 },
        },
        closures,
        csv: csvRows.join("\n"),
      };
    }),
});
