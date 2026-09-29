import { z } from "zod";
import { eq, and, isNull, desc, inArray, sql, or, gte } from "drizzle-orm";
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
  extWithdrawalPeriods,
} from "@openpims/db";
import {
  buildKvepisPayload,
  buildReferenceNumber,
} from "@/lib/kvepis/builder";
import { transcribeAudioDirect } from "@/lib/voice/transcription";
import { parseFieldVisitTranscript } from "@/lib/voice/field-visit-parser";
import { isControlledSubstanceName } from "@/lib/controlled-substances/policy";
import { calculateStatutoryWithdrawal } from "@/lib/statutory/withdrawal";
import {
  MAX_WITHDRAWAL_DAYS,
  clampWithdrawalDays,
  formatCehzEarTag,
  normalizeCehzEarTag,
} from "@/lib/field-visits/policy";

/**
 * Withdrawal periods (ochranné lehoty) must stay within a plausible range.
 * The products table does not store per-product statutory withdrawal data,
 * so the shared `MAX_WITHDRAWAL_DAYS` bound in `@/lib/field-visits/policy`
 * is the only validation available — it stops obvious garbage (e.g. 100000
 * days) from flowing into prescriptions, `ext_withdrawal_periods` and KVEPIS
 * treatment-diary drafts (Zákon č. 39/2007 Z. z. a nariadenia EÚ).
 */

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
    // Aktívne ochranné lehoty (mäso / mlieko) evidované ku kravám fariem —
    // poháňajú "Withdrawal Watch" kartu na /field-visits.
    const cowIds = cows.map((c) => c.id);
    const nowTs = new Date();
    const activeWithdrawals = cowIds.length > 0
      ? await ctx.db.query.extWithdrawalPeriods.findMany({
          where: and(
            eq(extWithdrawalPeriods.practiceId, ctx.practiceId),
            isNull(extWithdrawalPeriods.deletedAt),
            inArray(extWithdrawalPeriods.patientId, cowIds),
            gte(extWithdrawalPeriods.safeUntil, nowTs)
          ),
          orderBy: [desc(extWithdrawalPeriods.administeredAt)],
        })
      : [];
    const kvepisList = await ctx.db.query.extKvepisSubmissions.findMany({
      where: and(eq(extKvepisSubmissions.practiceId, ctx.practiceId), isNull(extKvepisSubmissions.deletedAt), sql`${extKvepisSubmissions.cehzCode} IS NOT NULL`),
      orderBy: [desc(extKvepisSubmissions.createdAt)],
    });
    const cowById = new Map(cows.map((c) => [c.id, c]));
    const farmByCowId = new Map(cows.map((c) => [c.id, c.clientId]));
    const farmById = new Map(farmClients.map((f) => [f.id, f]));
    const withdrawalsByPatient = new Map<string, typeof activeWithdrawals>();
    for (const w of activeWithdrawals) {
      const list = withdrawalsByPatient.get(w.patientId) ?? [];
      list.push(w);
      withdrawalsByPatient.set(w.patientId, list);
    }
    const enrichedWithdrawals = activeWithdrawals.map((w) => {
      const cow = cowById.get(w.patientId);
      const farm = farmById.get(farmByCowId.get(w.patientId) ?? "");
      return {
        ...w,
        patientName: cow?.name ?? null,
        earTag: cow?.microchipNumber ?? null,
        farmId: farm?.id ?? null,
        farmName: farm ? `${farm.firstName} ${farm.lastName}`.trim() : null,
      };
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
        cows: farmCows.map((c) => ({
          id: c.id,
          name: c.name,
          earTag: c.microchipNumber || "—",
          breed: c.breed || "Bovine",
          dob: c.dob,
          status: c.status,
          /** true, ak zviera má práve platnú ochrannú lehotu (mäso/mlieko). */
          activeWithdrawal: (withdrawalsByPatient.get(c.id)?.length ?? 0) > 0,
        })),
        cowCount: farmCows.length,
        visitCount: farmVisits.length,
        unbilledAmount,
        totalPaid,
        draftInvoice: draftInvoices[0] || null,
        invoices: invoicesForFarm,
      };
    });
    const totalUnbilled = farmsWithDetails.reduce((sum, f) => sum + f.unbilledAmount, 0);
    return {
      farms: farmsWithDetails,
      totalFarms: farmsWithDetails.length,
      totalCows: cows.length,
      totalVisits: fieldAppointments.length,
      totalUnbilled,
      kvepisSubmissions: kvepisList,
      recentVisits: fieldAppointments.slice(0, 15),
      /** Aktívne ochranné lehoty naprieč všetkými farmami (Withdrawal Watch). */
      withdrawals: enrichedWithdrawals,
    };
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

  /**
   * Rýchly diktát v maštali: okamžitý prepis hlasu (STT) + koncept formulára
   * výjazdu (diagnóza, liek, ochranné lehoty) pre predvyplnenie UI.
   * Kontrolované látky sa cez AI prefill nikdy nepodávajú — platí brána
   * `isControlledSubstanceName` pri uložení výjazdu (Zákon č. 139/1998 Z. z.).
   */
  transcribeVoice: vetProcedure
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
        products: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().min(0.1), instructions: z.string().optional(), meatWithdrawalDays: z.number().int().min(0).max(MAX_WITHDRAWAL_DAYS).optional(), milkWithdrawalDays: z.number().int().min(0).max(MAX_WITHDRAWAL_DAYS).optional() })).default([]),
        notes: z.string().optional(),
        sendToKvepis: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const farm = await ctx.db.query.clients.findFirst({ where: and(eq(clients.id, input.farmId), eq(clients.practiceId, ctx.practiceId)) });
      if (!farm) throw new TRPCError({ code: "NOT_FOUND", message: "Farma nebola nájdená." });
      const cow = await ctx.db.query.patients.findFirst({ where: and(eq(patients.id, input.cowId), eq(patients.practiceId, ctx.practiceId)) });
      if (!cow) throw new TRPCError({ code: "NOT_FOUND", message: "Zviera nebolo nájdené." });
      const cowEarTag = normalizeCehzEarTag(cow.microchipNumber);
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
          // Controlled-substances gate (Zákon č. 139/1998 Z. z.): the voice-first
          // field-visit flow is AI-assisted prefill, so controlled substances must
          // never be recorded through it. They require manual entry with witness
          // on the controlled-substances screen.
          if (isControlledSubstanceName(p.name)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "Kontrolovanú látku '" +
                p.name +
                "' nie je možné podávať cez terénny výjazd (Zákon č. 139/1998 Z. z.). Záznam vytvorte ručne v sekcii Kontrolované látky.",
            });
          }
          const lineTotal = parseFloat(p.unitPrice || "0") * prodItem.quantity;
          addedSubtotal += lineTotal;
          await ctx.db.insert(invoiceItems).values({ invoiceId: draftInvoice.id, description: `${p.name} — ${prodItem.quantity} ks (${cow.name})`, quantity: prodItem.quantity, unitPrice: p.unitPrice, total: lineTotal.toFixed(2), taxable: p.taxable, itemType: "product", itemId: p.id });
          await ctx.db.insert(prescriptions).values({ practiceId: ctx.practiceId, patientId: input.cowId, appointmentId: appt.id, medicationName: p.name, dosage: "Podľa klinického stavu", frequency: "Pri výjazde", quantity: prodItem.quantity, productId: p.id, prescribedBy: ctx.user.id, startDate: now.toISOString().slice(0, 10), status: "completed", instructions: prodItem.instructions || `Ochranná lehota mäso: ${prodItem.meatWithdrawalDays || 0} dní, mlieko: ${prodItem.milkWithdrawalDays || 0} dní.` });
          // Zákonná evidencia ochrannej lehoty (Zákon č. 39/2007 Z. z.) — každé
          // podanie lieku hospodárskemu zvieraťu zapíše do ext_withdrawal_periods.
          const meatDays = clampWithdrawalDays(prodItem.meatWithdrawalDays ?? 0);
          const milkDays = clampWithdrawalDays(prodItem.milkWithdrawalDays ?? 0);
          if (meatDays > 0 || milkDays > 0) {
            const wCalc = calculateStatutoryWithdrawal(now, { meat: meatDays, milk: milkDays }, false, now);
            await ctx.db.insert(extWithdrawalPeriods).values({
              practiceId: ctx.practiceId,
              patientId: input.cowId,
              visitId: appt.id,
              medicationName: p.name,
              targetAnimalType: "bovine",
              meatWithdrawalDays: meatDays,
              milkWithdrawalDays: milkDays,
              meatSafeUntil: wCalc.meatSafeUntil,
              milkSafeUntil: wCalc.milkSafeUntil,
              isCascadeApplied: false,
              administeredAt: now,
              safeUntil: wCalc.overallSafeUntil,
              notes: `Terénny výjazd: ${cow.name} (${cow.microchipNumber || "bez ušnej známky"}).`,
            });
          }
        }
      }
      const currentSubtotal = parseFloat(draftInvoice.subtotal || "0") + addedSubtotal;
      const currentTax = currentSubtotal * 0.23;
      await ctx.db.update(invoices).set({ subtotal: currentSubtotal.toFixed(2), tax: currentTax.toFixed(2), total: (currentSubtotal + currentTax).toFixed(2), updatedAt: now }).where(eq(invoices.id, draftInvoice.id));
      // KVEPIS: pri uložení výjazdu S LIEČIVOM automaticky vygeneruj koncept
      // záznamu do registra liečiv KVEPIS s referenčným číslom (buildReferenceNumber).
      // Vyžaduje platnú ušnú známku CEHZ (SK + 12 číslic).
      if (input.sendToKvepis && input.products.length > 0 && cowEarTag) {
        const maxMeatDays = clampWithdrawalDays(Math.max(0, ...input.products.map((p) => p.meatWithdrawalDays ?? 0)));
        const maxMilkDays = clampWithdrawalDays(Math.max(0, ...input.products.map((p) => p.milkWithdrawalDays ?? 0)));
        const firstProd = input.products[0] ? await ctx.db.query.products.findFirst({ where: and(eq(products.id, input.products[0].productId), eq(products.practiceId, ctx.practiceId)) }) : null;
        const cehzCode = farm.notes?.match(/CEHZ:\s*(\w+)/i)?.[1] ?? farm.externalId ?? null;
        const farmIco = farm.externalId ?? null;
        const credentials = await ctx.db.query.extKvepisCredentials.findFirst({ where: and(eq(extKvepisCredentials.practiceId, ctx.practiceId), isNull(extKvepisCredentials.deletedAt)) });
        const [seqRow] = await ctx.db.select({ count: sql<number>`count(*)::int` }).from(extKvepisSubmissions).where(and(eq(extKvepisSubmissions.practiceId, ctx.practiceId), isNull(extKvepisSubmissions.deletedAt)));
        const referenceNumber = buildReferenceNumber(now, (seqRow?.count ?? 0) + 1);
        const maxW = Math.max(maxMeatDays, maxMilkDays);
        const built = buildKvepisPayload({ submissionType: "treatment_diary_batch", referenceNumber, practiceIco: credentials?.ico ?? farmIco ?? "", practiceKvlId: credentials?.kvlId ?? null, farmIco, cehzCode, earTagNumber: cowEarTag, kvlNumber: credentials?.kvlId ?? null, animalSpecies: "bovine", diagnosis: input.diagnosis, medicationName: firstProd?.name ?? null, meatWithdrawalDays: maxMeatDays > 0 ? maxMeatDays : null, milkWithdrawalDays: maxMilkDays > 0 ? maxMilkDays : null, administeredAt: now, safeUntil: maxW > 0 ? new Date(now.getTime() + maxW * 86400000) : null, notes: input.notes ?? null });
        await ctx.db.insert(extKvepisSubmissions).values({ practiceId: ctx.practiceId, submissionType: "treatment_diary_batch", status: "DRAFT", referenceNumber, patientId: input.cowId, sourceEntityType: "appointment", sourceEntityId: appt.id, farmIco, cehzCode, earTagNumber: cowEarTag, kvlNumber: credentials?.kvlId ?? null, payloadXml: built.xml, payloadJson: built.json, payloadHash: built.hash, notes: `Terénny výjazd: ${cow.name} — ${input.diagnosis}.` });
        return { success: true, appointmentId: appt.id, invoiceId: draftInvoice.id, kvepisReferenceNumber: referenceNumber };
      }
      return { success: true, appointmentId: appt.id, invoiceId: draftInvoice.id, kvepisReferenceNumber: null };
    }),

  /**
   * Hromadné ošetrenie stáda (Herd Batch Actions): jeden terénny výjazd
   * (vakcinácia / odčervenie / synchronizácia ruje) s rozpisom na vybrané
   * ušné známky CEHZ — fakturácia, KVEPIS koncept aj ochranné lehoty
   * sa evidujú per zviera.
   */
  createHerdBatchVisit: vetProcedure
    .input(
      z.object({
        farmId: z.string().uuid(),
        cowIds: z.array(z.string().uuid()).min(2).max(500),
        batchAction: z.enum(["vaccination", "deworming", "estrus_synch", "other"]),
        diagnosis: z.string().min(3),
        serviceIds: z.array(z.string().uuid()).default([]),
        products: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().min(0.1), instructions: z.string().optional(), meatWithdrawalDays: z.number().int().min(0).max(MAX_WITHDRAWAL_DAYS).optional(), milkWithdrawalDays: z.number().int().min(0).max(MAX_WITHDRAWAL_DAYS).optional() })).default([]),
        notes: z.string().optional(),
        sendToKvepis: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const farm = await ctx.db.query.clients.findFirst({ where: and(eq(clients.id, input.farmId), eq(clients.practiceId, ctx.practiceId)) });
      if (!farm) throw new TRPCError({ code: "NOT_FOUND", message: "Farma nebola nájdená." });

      const uniqueCowIds = [...new Set(input.cowIds)];
      const cows = uniqueCowIds.length > 0
        ? await ctx.db.query.patients.findMany({ where: and(eq(patients.practiceId, ctx.practiceId), isNull(patients.deletedAt), inArray(patients.id, uniqueCowIds)) })
        : [];
      const selectedCows = uniqueCowIds.map((id) => cows.find((c) => c.id === id && c.clientId === input.farmId));
      if (selectedCows.some((c) => !c)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Niektoré vybrané zvieratá neexistujú alebo neprináležia tejto farme." });
      }
      const herd = selectedCows as Array<(typeof cows)[number]>;

      // Controlled-substances gate (Zákon č. 139/1998 Z. z.) — overenie
      // PRED akýmikoľvek zápismi, aby hromadný zákrok nezanikol v polovici.
      type ProductRow = { id: string; name: string; unitPrice: string; taxable: boolean };
      type ServiceRow = { id: string; name: string; defaultPrice: string; taxable: boolean };
      const productRows: ProductRow[] = [];
      for (const prodItem of input.products) {
        const p = await ctx.db.query.products.findFirst({ where: and(eq(products.id, prodItem.productId), eq(products.practiceId, ctx.practiceId)) });
        if (!p) continue;
        if (isControlledSubstanceName(p.name)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Kontrolovanú látku '" + p.name + "' nie je možné podávať cez terénny výjazd (Zákon č. 139/1998 Z. z.). Záznam vytvorte ručne v sekcii Kontrolované látky.",
          });
        }
        productRows.push({ id: p.id, name: p.name, unitPrice: p.unitPrice, taxable: p.taxable });
      }
      const serviceRows: ServiceRow[] = [];
      for (const sId of input.serviceIds) {
        const s = await ctx.db.query.services.findFirst({ where: and(eq(services.id, sId), eq(services.practiceId, ctx.practiceId)) });
        if (s) serviceRows.push({ id: s.id, name: s.name, defaultPrice: s.defaultPrice, taxable: s.taxable });
      }

      const now = new Date();
      const actionLabels: Record<typeof input.batchAction, string> = {
        vaccination: "Hromadná vakcinácia stáda",
        deworming: "Odčervenie stáda",
        estrus_synch: "Synchronizácia ruje",
        other: "Hromadný zákrok",
      };
      const earTagList = herd
        .map((c) => formatCehzEarTag(c.microchipNumber) ?? c.microchipNumber ?? c.name)
        .join(", ");

      // Jeden terénny výjazd (jedna appointment) s rozpisom ušných známok.
      const primary = herd[0];
      const [appt] = await ctx.db.insert(appointments).values({
        practiceId: ctx.practiceId,
        clientId: input.farmId,
        patientId: primary.id,
        doctorId: ctx.user.id,
        startTime: now,
        endTime: new Date(now.getTime() + 45 * 60000),
        status: "checked_out",
        origin: "field",
        notes: `Terénny výjazd — ${actionLabels[input.batchAction]}: ${input.diagnosis}. Zvieratá (${herd.length}): ${earTagList}. ${input.notes || ""}`,
      }).returning();
      await ctx.db.insert(soapNotes).values({
        practiceId: ctx.practiceId,
        patientId: primary.id,
        appointmentId: appt.id,
        authorId: ctx.user.id,
        authorName: ctx.user.name || "MVDr. Martin Sýkora",
        status: "finalized",
        subjective: `Hromadný zákrok nahlásený chovateľom: ${input.diagnosis}`,
        objective: `${actionLabels[input.batchAction]} — ${herd.length} zvierat, ušné známky: ${earTagList}.`,
        assessment: input.diagnosis,
        plan: input.notes || "Podľa protokolu hromadného ošetrenia stáda.",
        finalizedAt: now,
        finalizedBy: ctx.user.id,
        finalizerName: ctx.user.name || "MVDr. Martin Sýkora",
      });

      let draftInvoice = await ctx.db.query.invoices.findFirst({ where: and(eq(invoices.practiceId, ctx.practiceId), eq(invoices.clientId, input.farmId), eq(invoices.status, "draft"), isNull(invoices.deletedAt)) });
      if (!draftInvoice) {
        const [inv] = await ctx.db.insert(invoices).values({ practiceId: ctx.practiceId, clientId: input.farmId, status: "draft", subtotal: "0", tax: "0", total: "0", paidAmount: "0", dueDate: new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10) }).returning();
        draftInvoice = inv;
      }

      // Fakturácia + KVEPIS + ochranné lehoty: rozpis per ušná známka.
      let addedSubtotal = 0;
      for (const cow of herd) {
        for (const s of serviceRows) {
          addedSubtotal += parseFloat(s.defaultPrice || "0");
          await ctx.db.insert(invoiceItems).values({ invoiceId: draftInvoice.id, description: `${s.name} (${cow.name})`, quantity: 1, unitPrice: s.defaultPrice, total: s.defaultPrice, taxable: s.taxable, itemType: "service", itemId: s.id });
        }
        for (const prodItem of input.products) {
          const p = productRows.find((row) => row.id === prodItem.productId);
          if (!p) continue;
          const lineTotal = parseFloat(p.unitPrice || "0") * prodItem.quantity;
          addedSubtotal += lineTotal;
          await ctx.db.insert(invoiceItems).values({ invoiceId: draftInvoice.id, description: `${p.name} — ${prodItem.quantity} ks (${cow.name})`, quantity: prodItem.quantity, unitPrice: p.unitPrice, total: lineTotal.toFixed(2), taxable: p.taxable, itemType: "product", itemId: p.id });
          await ctx.db.insert(prescriptions).values({ practiceId: ctx.practiceId, patientId: cow.id, appointmentId: appt.id, medicationName: p.name, dosage: "Podľa protokolu stáda", frequency: "Pri hromadnom výjazde", quantity: prodItem.quantity, productId: p.id, prescribedBy: ctx.user.id, startDate: now.toISOString().slice(0, 10), status: "completed", instructions: prodItem.instructions || `Ochranná lehota mäso: ${prodItem.meatWithdrawalDays || 0} dní, mlieko: ${prodItem.milkWithdrawalDays || 0} dní.` });
          const meatDays = clampWithdrawalDays(prodItem.meatWithdrawalDays ?? 0);
          const milkDays = clampWithdrawalDays(prodItem.milkWithdrawalDays ?? 0);
          if (meatDays > 0 || milkDays > 0) {
            const wCalc = calculateStatutoryWithdrawal(now, { meat: meatDays, milk: milkDays }, false, now);
            await ctx.db.insert(extWithdrawalPeriods).values({
              practiceId: ctx.practiceId,
              patientId: cow.id,
              visitId: appt.id,
              medicationName: p.name,
              targetAnimalType: "bovine",
              meatWithdrawalDays: meatDays,
              milkWithdrawalDays: milkDays,
              meatSafeUntil: wCalc.meatSafeUntil,
              milkSafeUntil: wCalc.milkSafeUntil,
              isCascadeApplied: false,
              administeredAt: now,
              safeUntil: wCalc.overallSafeUntil,
              notes: `Hromadný zákrok: ${cow.name} (${cow.microchipNumber || "bez ušnej známky"}).`,
            });
          }
        }
      }

      const currentSubtotal = parseFloat(draftInvoice.subtotal || "0") + addedSubtotal;
      const currentTax = currentSubtotal * 0.23;
      await ctx.db.update(invoices).set({ subtotal: currentSubtotal.toFixed(2), tax: currentTax.toFixed(2), total: (currentSubtotal + currentTax).toFixed(2), updatedAt: now }).where(eq(invoices.id, draftInvoice.id));

      // KVEPIS koncepty: per zviera s platnou ušnou známkou, unikátne referenčné čísla.
      const breakdown: Array<{ cowId: string; name: string; earTag: string | null; kvepisReferenceNumber: string | null }> = [];
      const maxMeatDays = clampWithdrawalDays(Math.max(0, ...input.products.map((p) => p.meatWithdrawalDays ?? 0)));
      const maxMilkDays = clampWithdrawalDays(Math.max(0, ...input.products.map((p) => p.milkWithdrawalDays ?? 0)));
      const firstProd = productRows[0] ?? null;
      const cehzCode = farm.notes?.match(/CEHZ:\s*(\w+)/i)?.[1] ?? farm.externalId ?? null;
      const farmIco = farm.externalId ?? null;
      const maxW = Math.max(maxMeatDays, maxMilkDays);

      let seq = 0;
      if (input.sendToKvepis && input.products.length > 0) {
        const [seqRow] = await ctx.db.select({ count: sql<number>`count(*)::int` }).from(extKvepisSubmissions).where(and(eq(extKvepisSubmissions.practiceId, ctx.practiceId), isNull(extKvepisSubmissions.deletedAt)));
        seq = seqRow?.count ?? 0;
      }
      const credentials = input.sendToKvepis && input.products.length > 0
        ? await ctx.db.query.extKvepisCredentials.findFirst({ where: and(eq(extKvepisCredentials.practiceId, ctx.practiceId), isNull(extKvepisCredentials.deletedAt)) })
        : null;

      for (const cow of herd) {
        const earTag = normalizeCehzEarTag(cow.microchipNumber);
        let referenceNumber: string | null = null;
        if (input.sendToKvepis && input.products.length > 0 && earTag) {
          seq += 1;
          referenceNumber = buildReferenceNumber(now, seq);
          const built = buildKvepisPayload({ submissionType: "treatment_diary_batch", referenceNumber, practiceIco: credentials?.ico ?? farmIco ?? "", practiceKvlId: credentials?.kvlId ?? null, farmIco, cehzCode, earTagNumber: earTag, kvlNumber: credentials?.kvlId ?? null, animalSpecies: "bovine", diagnosis: input.diagnosis, medicationName: firstProd?.name ?? null, meatWithdrawalDays: maxMeatDays > 0 ? maxMeatDays : null, milkWithdrawalDays: maxMilkDays > 0 ? maxMilkDays : null, administeredAt: now, safeUntil: maxW > 0 ? new Date(now.getTime() + maxW * 86400000) : null, notes: input.notes ?? null });
          await ctx.db.insert(extKvepisSubmissions).values({ practiceId: ctx.practiceId, submissionType: "treatment_diary_batch", status: "DRAFT", referenceNumber, patientId: cow.id, sourceEntityType: "appointment", sourceEntityId: appt.id, farmIco, cehzCode, earTagNumber: earTag, kvlNumber: credentials?.kvlId ?? null, payloadXml: built.xml, payloadJson: built.json, payloadHash: built.hash, notes: `${actionLabels[input.batchAction]}: ${cow.name} — ${input.diagnosis}.` });
        }
        breakdown.push({ cowId: cow.id, name: cow.name, earTag, kvepisReferenceNumber: referenceNumber });
      }

      return { success: true, appointmentId: appt.id, invoiceId: draftInvoice.id, cowCount: herd.length, breakdown };
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
      // CEHZ validácia: SK + 12 číslic (napr. "SK 000801452101" / "000801452101").
      const formattedEarTag = normalizeCehzEarTag(input.earTag);
      if (!formattedEarTag) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Neplatná ušná známka CEHZ — očakávaný formát SK + 12 číslic (napr. SK 000801452101).",
        });
      }
      const [cow] = await ctx.db.insert(patients).values({ practiceId: ctx.practiceId, clientId: input.farmId, name: input.name, species: "bovine", breed: input.breed, sex: "female", microchipNumber: formattedEarTag, dob: input.dob || new Date().toISOString().slice(0, 10), status: "active" }).returning();
      return cow;
    }),
});
