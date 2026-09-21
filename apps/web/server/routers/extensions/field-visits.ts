import { z } from "zod";
import { eq, and, isNull, desc, inArray, sql, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  clients,
  patients,
  appointments,
  invoices,
  invoiceItems,
  products,
  services,
  soapNotes,
  prescriptions,
  extKvepisSubmissions,
  extKvepisCredentials,
} from "@openpims/db";
import {
  buildKvepisPayload,
  buildReferenceNumber,
} from "@/lib/kvepis/builder";
import { transcribeAudioDirect } from "@/lib/voice/transcription";
import { parseFieldVisitTranscript } from "@/lib/voice/field-visit-parser";

const vetProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician")
);

export const fieldVisitsRouter = createRouter({
  getOverview: vetProcedure.query(async ({ ctx }) => {
    const farmClients = await ctx.db.query.clients.findMany({
      where: and(
        eq(clients.practiceId, ctx.practiceId),
        isNull(clients.deletedAt),
        or(
          eq(clients.externalSource, "cehz_farm"),
          sql`${clients.notes} ILIKE '%farma%' OR ${clients.notes} ILIKE '%chov%'`
        )
      ),
      orderBy: [desc(clients.createdAt)],
    });
    const farmIds = farmClients.map((f) => f.id);
    const cows = farmIds.length > 0
      ? await ctx.db.query.patients.findMany({
          where: and(eq(patients.practiceId, ctx.practiceId), isNull(patients.deletedAt), inArray(patients.clientId, farmIds)),
          orderBy: [desc(patients.createdAt)],
        })
      : [];
    const fieldAppointments = farmIds.length > 0
      ? await ctx.db.query.appointments.findMany({
          where: and(eq(appointments.practiceId, ctx.practiceId), isNull(appointments.deletedAt), inArray(appointments.clientId, farmIds), eq(appointments.origin, "field")),
          orderBy: [desc(appointments.startTime)],
        })
      : [];
    const farmInvoices = farmIds.length > 0
      ? await ctx.db.query.invoices.findMany({
          where: and(eq(invoices.practiceId, ctx.practiceId), isNull(invoices.deletedAt), inArray(invoices.clientId, farmIds)),
          orderBy: [desc(invoices.createdAt)],
          with: { items: true },
        })
      : [];
    const kvepisList = await ctx.db.query.extKvepisSubmissions.findMany({
      where: and(eq(extKvepisSubmissions.practiceId, ctx.practiceId), isNull(extKvepisSubmissions.deletedAt), sql`${extKvepisSubmissions.cehzCode} IS NOT NULL`),
      orderBy: [desc(extKvepisSubmissions.createdAt)],
    });
    const farmsWithDetails = farmClients.map((farm) => {
      const farmCows = cows.filter((c) => c.clientId === farm.id);
      const farmVisits = fieldAppointments.filter((a) => a.clientId === farm.id);
      const invoicesForFarm = farmInvoices.filter((inv) => inv.clientId === farm.id);
      const draftInvoices = invoicesForFarm.filter((inv) => inv.status === "draft");
      const paidInvoices = invoicesForFarm.filter((inv) => inv.status === "paid");
      const unbilledAmount = draftInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || "0"), 0);
      const totalPaid = paidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || "0"), 0);
      return {
        id: farm.id,
        name: `${farm.firstName} ${farm.lastName}`.trim(),
        firstName: farm.firstName,
        lastName: farm.lastName,
        ico: farm.externalId || "—",
        cehz: farm.notes?.match(/CEHZ:\s*(\w+)/i)?.[1] || farm.externalId || "—",
        email: farm.email,
        phone: farm.phone,
        address: farm.address,
        city: farm.city,
        zip: farm.zip,
        notes: farm.notes,
        contactPerson: farm.emergencyContact,
        cows: farmCows.map((c) => ({ id: c.id, name: c.name, earTag: c.microchipNumber || "—", breed: c.breed || "Bovine", dob: c.dob, status: c.status })),
        cowCount: farmCows.length,
        visitCount: farmVisits.length,
        unbilledAmount,
        totalPaid,
        draftInvoice: draftInvoices[0] || null,
        invoices: invoicesForFarm,
      };
    });
    const totalUnbilled = farmsWithDetails.reduce((sum, f) => sum + f.unbilledAmount, 0);
    return { farms: farmsWithDetails, totalFarms: farmsWithDetails.length, totalCows: cows.length, totalVisits: fieldAppointments.length, totalUnbilled, kvepisSubmissions: kvepisList, recentVisits: fieldAppointments.slice(0, 15) };
  }),

  getLargeAnimalStock: vetProcedure.query(async ({ ctx }) => {
    return ctx.db.query.products.findMany({
      where: and(eq(products.practiceId, ctx.practiceId), isNull(products.deletedAt), or(sql`${products.sku} LIKE 'VET-LA-%'`, inArray(products.category, ["Intramammáriá","Antibiotiká inj.","Infúzne roztoky","Antiflogistiká","Gynekologiká","Antiparazitiká","Vakcíny HD","Dietetiká & Metaboliká"]))),
      orderBy: [products.category, products.name],
    });
  }),

  getLargeAnimalServices: vetProcedure.query(async ({ ctx }) => {
    return ctx.db.query.services.findMany({
      where: and(eq(services.practiceId, ctx.practiceId), isNull(services.deletedAt), sql`${services.code} LIKE 'HD-%'`),
      orderBy: [services.name],
    });
  }),

  /** STT + AI parsing hlasového diktátu → predvyplnený draft formulára výjazdu. */
  parseVoiceVisit: vetProcedure
    .input(z.object({ audioBase64: z.string().min(1).max(26_214_400), audioMimeType: z.string().default("audio/webm") }))
    .mutation(async ({ input }) => {
      const transcript = await transcribeAudioDirect(input.audioBase64, input.audioMimeType);
      return parseFieldVisitTranscript(transcript);
    }),

  createFieldVisit: vetProcedure
    .input(
      z.object({
        farmId: z.string().uuid(),
        cowId: z.string().uuid(),
        diagnosis: z.string().min(3),
        serviceIds: z.array(z.string().uuid()).default([]),
        products: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().min(0.1), instructions: z.string().optional(), meatWithdrawalDays: z.number().int().min(0).optional(), milkWithdrawalDays: z.number().int().min(0).optional() })).default([]),
        notes: z.string().optional(),
        sendToKvepis: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const farm = await ctx.db.query.clients.findFirst({ where: and(eq(clients.id, input.farmId), eq(clients.practiceId, ctx.practiceId)) });
      if (!farm) throw new TRPCError({ code: "NOT_FOUND", message: "Farma nebola nájdená." });
      const cow = await ctx.db.query.patients.findFirst({ where: and(eq(patients.id, input.cowId), eq(patients.practiceId, ctx.practiceId)) });
      if (!cow) throw new TRPCError({ code: "NOT_FOUND", message: "Zviera nebolo nájdené." });
      const now = new Date();
      const [appt] = await ctx.db.insert(appointments).values({ practiceId: ctx.practiceId, clientId: input.farmId, patientId: input.cowId, doctorId: ctx.user.id, startTime: now, endTime: new Date(now.getTime() + 45 * 60000), status: "checked_out", origin: "field", notes: `Terénny výjazd: ${cow.name} (${cow.microchipNumber || "bez ušnej známky"}) — ${input.diagnosis}. ${input.notes || ""}` }).returning();
      await ctx.db.insert(soapNotes).values({ practiceId: ctx.practiceId, patientId: input.cowId, appointmentId: appt.id, authorId: ctx.user.id, authorName: ctx.user.name || "MVDr. Martin Sýkora", status: "finalized", subjective: `Hlásené chovateľom: ${input.diagnosis}`, objective: `Klinický nález: ${cow.name}, ušné č. ${cow.microchipNumber || "—"}.`, assessment: input.diagnosis, plan: input.notes || "Podaná terapia.", finalizedAt: now, finalizedBy: ctx.user.id, finalizerName: ctx.user.name || "MVDr. Martin Sýkora" });
      let draftInvoice = await ctx.db.query.invoices.findFirst({ where: and(eq(invoices.practiceId, ctx.practiceId), eq(invoices.clientId, input.farmId), eq(invoices.status, "draft"), isNull(invoices.deletedAt)) });
      if (!draftInvoice) {
        const [inv] = await ctx.db.insert(invoices).values({ practiceId: ctx.practiceId, clientId: input.farmId, status: "draft", subtotal: "0", tax: "0", total: "0", paidAmount: "0", dueDate: new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10) }).returning();
        draftInvoice = inv;
      }
      let addedSubtotal = 0;
      for (const sId of input.serviceIds) {
        const s = await ctx.db.query.services.findFirst({ where: and(eq(services.id, sId), eq(services.practiceId, ctx.practiceId)) });
        if (s) { addedSubtotal += parseFloat(s.defaultPrice || "0"); await ctx.db.insert(invoiceItems).values({ invoiceId: draftInvoice.id, description: `${s.name} (${cow.name})`, quantity: 1, unitPrice: s.defaultPrice, total: s.defaultPrice, taxable: s.taxable, itemType: "service", itemId: s.id }); }
      }
      for (const prodItem of input.products) {
        const p = await ctx.db.query.products.findFirst({ where: and(eq(products.id, prodItem.productId), eq(products.practiceId, ctx.practiceId)) });
        if (p) {
          const lineTotal = parseFloat(p.unitPrice || "0") * prodItem.quantity;
          addedSubtotal += lineTotal;
          await ctx.db.insert(invoiceItems).values({ invoiceId: draftInvoice.id, description: `${p.name} — ${prodItem.quantity} ks (${cow.name})`, quantity: prodItem.quantity, unitPrice: p.unitPrice, total: lineTotal.toFixed(2), taxable: p.taxable, itemType: "product", itemId: p.id });
          await ctx.db.insert(prescriptions).values({ practiceId: ctx.practiceId, patientId: input.cowId, appointmentId: appt.id, medicationName: p.name, dosage: "Podľa klinického stavu", frequency: "Pri výjazde", quantity: prodItem.quantity, productId: p.id, prescribedBy: ctx.user.id, startDate: now.toISOString().slice(0, 10), status: "completed", instructions: prodItem.instructions || `Ochranná lehota mäso: ${prodItem.meatWithdrawalDays || 0} dní, mlieko: ${prodItem.milkWithdrawalDays || 0} dní.` });
        }
      }
      const currentSubtotal = parseFloat(draftInvoice.subtotal || "0") + addedSubtotal;
      const currentTax = currentSubtotal * 0.23;
      await ctx.db.update(invoices).set({ subtotal: currentSubtotal.toFixed(2), tax: currentTax.toFixed(2), total: (currentSubtotal + currentTax).toFixed(2), updatedAt: now }).where(eq(invoices.id, draftInvoice.id));
      if (input.sendToKvepis && cow.microchipNumber) {
        const maxMeatDays = Math.max(0, ...input.products.map((p) => p.meatWithdrawalDays ?? 0));
        const maxMilkDays = Math.max(0, ...input.products.map((p) => p.milkWithdrawalDays ?? 0));
        const firstProd = input.products[0] ? await ctx.db.query.products.findFirst({ where: and(eq(products.id, input.products[0].productId), eq(products.practiceId, ctx.practiceId)) }) : null;
        const cehzCode = farm.notes?.match(/CEHZ:\s*(\w+)/i)?.[1] ?? farm.externalId ?? null;
        const farmIco = farm.externalId ?? null;
        const credentials = await ctx.db.query.extKvepisCredentials.findFirst({ where: and(eq(extKvepisCredentials.practiceId, ctx.practiceId), isNull(extKvepisCredentials.deletedAt)) });
        const [seqRow] = await ctx.db.select({ count: sql<number>`count(*)::int` }).from(extKvepisSubmissions).where(and(eq(extKvepisSubmissions.practiceId, ctx.practiceId), isNull(extKvepisSubmissions.deletedAt)));
        const referenceNumber = buildReferenceNumber(now, (seqRow?.count ?? 0) + 1);
        const maxW = Math.max(maxMeatDays, maxMilkDays);
        const built = buildKvepisPayload({ submissionType: "treatment_diary_batch", referenceNumber, practiceIco: credentials?.ico ?? farmIco ?? "", practiceKvlId: credentials?.kvlId ?? null, farmIco, cehzCode, earTagNumber: cow.microchipNumber, kvlNumber: credentials?.kvlId ?? null, animalSpecies: "bovine", diagnosis: input.diagnosis, medicationName: firstProd?.name ?? null, meatWithdrawalDays: maxMeatDays > 0 ? maxMeatDays : null, milkWithdrawalDays: maxMilkDays > 0 ? maxMilkDays : null, administeredAt: now, safeUntil: maxW > 0 ? new Date(now.getTime() + maxW * 86400000) : null, notes: input.notes ?? null });
        await ctx.db.insert(extKvepisSubmissions).values({ practiceId: ctx.practiceId, submissionType: "treatment_diary_batch", status: "DRAFT", referenceNumber, patientId: input.cowId, sourceEntityType: "appointment", sourceEntityId: appt.id, farmIco, cehzCode, earTagNumber: cow.microchipNumber, kvlNumber: credentials?.kvlId ?? null, payloadXml: built.xml, payloadJson: built.json, payloadHash: built.hash, notes: `Terénny výjazd: ${cow.name} — ${input.diagnosis}.` });
      }
      return { success: true, appointmentId: appt.id, invoiceId: draftInvoice.id };
    }),

  closeFarmInvoice: vetProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const inv = await ctx.db.query.invoices.findFirst({ where: and(eq(invoices.id, input.invoiceId), eq(invoices.practiceId, ctx.practiceId)) });
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Faktúra nebola nájdená." });
      const [updated] = await ctx.db.update(invoices).set({ status: "sent", updatedAt: new Date() }).where(eq(invoices.id, input.invoiceId)).returning();
      return updated;
    }),

  registerCow: vetProcedure
    .input(z.object({ farmId: z.string().uuid(), name: z.string().min(2), earTag: z.string().min(4), breed: z.string().default("Holštajnsko-frízsky dobytok"), dob: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const formattedEarTag = input.earTag.startsWith("SK") ? input.earTag : `SK ${input.earTag.trim()}`;
      const [cow] = await ctx.db.insert(patients).values({ practiceId: ctx.practiceId, clientId: input.farmId, name: input.name, species: "bovine", breed: input.breed, sex: "female", microchipNumber: formattedEarTag, dob: input.dob || new Date().toISOString().slice(0, 10), status: "active" }).returning();
      return cow;
    }),
});
