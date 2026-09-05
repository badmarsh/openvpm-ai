import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import {
  createRouter,
  protectedProcedure,
  requireRole,
  requireFeature,
} from "../../trpc";
import { dischargeReports, patients, practices } from "@openpims/db";
import { configuredModel } from "@/lib/agent/runner";
import { DEFAULT_AI_MODEL } from "@/lib/ai-models";
import { recordUsage } from "@/lib/billing/usage";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import {
  schedulePostopCheckIn,
  applySympathyGate,
  detectAndTriggerDentalRecall,
  checkAndTriggerSeniorMilestone,
} from "@/lib/marketing/messaging";
import {
  CLINICIAN_CONFIRMATION_REQUIRED_MESSAGE,
  optionalClinicianConfirmationInput,
  resolveAiRecordStatus,
} from "@/lib/ai/draft-safety";

const dischargeProcedure = protectedProcedure
  .use(requireRole("admin", "veterinarian", "technician", "front_desk"))
  .use(requireFeature("agent"));

const DISCHARGE_SYSTEM_PROMPT_SK = `Ste skúsený veterinárny asistent vo veterinárnej klinike.
Vašou úlohou je vygenerovať profesionálnu, empatickú a pre majiteľa ľahko zrozumiteľnú záverečnú prepúšťaciu správu (pokyny na domácu starostlivosť).

Pravidlá a štruktúra správy:
1. Oslovenie a úvod: Milý majiteľ / Vážený klient, zhrnutie stavu pacienta po ošetrení / hospitalizácii.
2. Diagnóza zrozumiteľnou rečou: Preložte odborné latinské / medicínske termíny do bežného jazyka, aby majiteľ presne chápal, čo jeho miláčikovi je.
3. Podaná liečba na klinike: Čo bolo vykonané a podané.
4. Domáca liečba a lieky: Dávkovanie, frekvencia, spôsob podania (s krmivom, nalačno atď.).
5. Režimové opatrenia a kŕmenie: Kľudový režim, diéta, hygiena rany, ochranný golier a pod.
6. Kedy okamžite kontaktovať kliniku (Varovné príznaky): Letargia, zvracanie, krvácanie, odmietanie vody atď.
7. Plánovaná kontrola: Dátum, čas alebo podmienky pre kontrolu.
8. Profesionálny a empatický záver s podpisom veterinárneho tímu kliniky.

Formátujte text v prehľadnom a úhľadnom Markdown formáte s odrážkami a tučným písmom pre dôležité upozornenia.`;

const DISCHARGE_SYSTEM_PROMPT_EN = `You are an expert veterinary assistant writing a discharge report for a pet owner.
Your task is to translate clinical diagnosis, treatments given, and follow-up instructions into clear, empathetic, and easily understandable language for a non-medical pet owner.

Structure:
1. Warm greeting and condition summary.
2. Diagnosis explained in plain language (translating clinical jargon).
3. Treatment and medications given at the clinic.
4. Home care instructions & medications (dosage, timing, administration tips).
5. Warning signs / when to call the clinic immediately.
6. Scheduled follow-up visit.
7. Empathetic closing from the veterinary team.

Format the response in clean Markdown with clear headings and bullet points.`;

export const dischargeRouter = createRouter({
  /** Generuje prepúšťaciu správu pomocou AI alebo šablóny */
  generate: dischargeProcedure
    .input(
      z.object({
        patientId: z.string().uuid().optional(),
        appointmentId: z.string().uuid().optional(),
        petName: z.string().min(1, "Zadajte meno pacienta").max(255),
        species: z.string().max(255).optional(),
        diagnosis: z.string().min(1, "Zadajte diagnózu").max(5000),
        treatment: z.string().max(5000).optional(),
        followUp: z.string().max(5000).optional(),
        language: z.enum(["sk", "en"]).default("sk"),
        tone: z.enum(["empathetic", "standard", "formal"]).default("empathetic"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Overenie klinických a bezpečnostných pravidiel (Sympathy flow)
      let isDeceased = false;
      if (input.patientId) {
        const [patient] = await ctx.db
          .select({
            id: patients.id,
            name: patients.name,
            status: patients.status,
            species: patients.species,
          })
          .from(patients)
          .where(
            and(
              eq(patients.id, input.patientId),
              eq(patients.practiceId, ctx.practiceId),
              isNull(patients.deletedAt),
            ),
          )
          .limit(1);

        if (patient?.status === "deceased") {
          isDeceased = true;
        }
      }

      // 2. Načítanie údajov o praxi pre personalizovaný podpis
      const [practice] = await ctx.db
        .select({
          name: practices.name,
          phone: practices.phone,
          email: practices.email,
        })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);

      const clinicName = practice?.name || "Veterinárna klinika";
      const clinicContact = practice?.phone ? `Tel: ${practice.phone}` : "";

      // 3. Pokus o AI generovanie cez configuredModel
      try {
        const model = configuredModel();
        const systemPrompt =
          input.language === "sk"
            ? DISCHARGE_SYSTEM_PROMPT_SK
            : DISCHARGE_SYSTEM_PROMPT_EN;

        const userPrompt =
          input.language === "sk"
            ? `Klinika: ${clinicName}\nKontakt: ${clinicContact}\nMeno pacienta: ${input.petName}\nDruh/Plemeno: ${input.species || "neuvedené"}\nDiagnóza: ${input.diagnosis}\nAplikovaná a predpísaná liečba: ${input.treatment || "neuvedené"}\nPokyny pre následnú starostlivosť a kontrolu: ${input.followUp || "neuvedené"}${isDeceased ? "\nUPOZORNENIE: Pacient uhynul / bol eutanazovaný. Správa musí vyjadrovať úprimnú sústrasť a empatiu rodine." : ""}`
            : `Clinic: ${clinicName}\nContact: ${clinicContact}\nPet Name: ${input.petName}\nSpecies/Breed: ${input.species || "Not specified"}\nDiagnosis: ${input.diagnosis}\nTreatment / Medications: ${input.treatment || "Not specified"}\nFollow-up & Home Care Instructions: ${input.followUp || "Not specified"}${isDeceased ? "\nNOTE: Patient is deceased. The letter must be a compassionate condolence note." : ""}`;

        const result = await generateText({
          model,
          system: systemPrompt,
          prompt: userPrompt,
        });

        await recordUsage({ practiceId: ctx.practiceId, kind: "ai_run" });

        const generatedText = result.text.trim();
        if (generatedText.length > 0) {
          return {
            text: generatedText,
            usedAi: true,
          };
        }
      } catch (err) {
        console.warn("Discharge AI generation fallback to template:", err);
      }

      // 4. Overený deterministický fallback
      if (input.language === "sk") {
        if (isDeceased) {
          return {
            text: `# Vyjadrenie úprimnej sústrasti\n\n**Klinika:** ${clinicName}\n**Pacient:** ${input.petName} (${input.species || "zviera"})\n\nVážená smútiaca rodina,\n\ns hlbokým zármutkom myslíme na Vás a ${input.petName}. Chceme Vám vyjadriť našu najúprimnejšiu sústrasť pri strate Vášho milovaného spoločníka. Ďakujeme za dôveru a starostlivosť, ktorú ste mu po celý život venovali.\n\nS úctou,\n**Tím ${clinicName}**\n${clinicContact}`,
            usedAi: false,
          };
        }

        return {
          text: `# Záverečná prepúšťacia správa pre majiteľa\n\n**Klinika:** ${clinicName}\n**Pacient:** ${input.petName} (${input.species || "neuvedené"})\n**Dátum ošetrenia:** ${new Date().toLocaleDateString("sk-SK")}\n\n---\n\n### 🩺 Diagnóza a zdravotný stav\n${input.diagnosis}\n\n### 💊 Vykonané ošetrenie a podaná liečba\n${input.treatment || "Liečba bola aplikovaná podľa klinického protokolu."}\n\n### 🏠 Domáca starostlivosť a režimové opatrenia\n- Zabezpečte pacientovi kľudové prostredie v teple a bez stresu.\n- Podávajte predpísané lieky presne podľa inštrukcií.\n- Zabezpečte stály prístup k čerstvej pitnej vode.\n\n### ⚠️ Varovné príznaky (kedy okamžite volať kliniku)\nAk spozorujete opakované zvracanie, výraznú apatiu, dýchavičnosť alebo odmietanie tekutín, bezodkladne nás kontaktujte.\n\n### 📅 Následná kontrola\n${input.followUp || "Podľa stavu alebo po telefonickej dohode."}\n\n---\n*Ďakujeme za Vašu dôveru.*\n**Tím ${clinicName}**\n${clinicContact}`,
          usedAi: false,
        };
      }

      return {
        text: `# Discharge Instructions for Pet Owner\n\n**Clinic:** ${clinicName}\n**Patient:** ${input.petName} (${input.species || "Not specified"})\n**Date:** ${new Date().toLocaleDateString("en-US")}\n\n---\n\n### 🩺 Diagnosis\n${input.diagnosis}\n\n### 💊 Treatment & Medications\n${input.treatment || "Treatment administered according to clinical guidelines."}\n\n### 🏠 Home Care Instructions\n- Keep your pet in a quiet, warm, and comfortable area.\n- Administer all medications as directed.\n- Ensure continuous access to fresh water.\n\n### ⚠️ When to Contact Us Immediately\nCall us immediately if you notice severe lethargy, persistent vomiting, difficulty breathing, or sudden deterioration.\n\n### 📅 Follow-up\n${input.followUp || "As needed or per phone consultation."}\n\n---\n*Thank you for trusting us with your pet's care.*\n**The ${clinicName} Team**\n${clinicContact}`,
        usedAi: false,
      };
    }),

  /**
   * Uloží vygenerovanú správu do databázy.
   *
   * Human-in-the-loop: AI-generated discharge text is a *draft* until a
   * clinician explicitly confirms it (`clinicianConfirmed: true`). Only a
   * confirmed, finalized report may emit the webhook or schedule any owner
   * communication. Deceased patients are hard-gated: no recall, post-op
   * check-in, dental, or senior-milestone message is ever queued; instead the
   * sympathy gate blocks outstanding marketing and opens a condolence task.
   */
  save: dischargeProcedure
    .input(
      z.object({
        patientId: z.string().uuid().optional(),
        appointmentId: z.string().uuid().optional(),
        petName: z.string().min(1).max(255),
        species: z.string().max(255).optional(),
        diagnosis: z.string().min(1).max(5000),
        treatment: z.string().max(5000).optional(),
        followUp: z.string().max(5000).optional(),
        reportText: z.string().min(1).max(50_000),
        language: z.string().max(8).default("sk"),
        status: z.enum(["draft", "finalized"]).default("draft"),
        clinicianConfirmed: optionalClinicianConfirmationInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.status === "finalized" && input.clinicianConfirmed !== true) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: CLINICIAN_CONFIRMATION_REQUIRED_MESSAGE,
        });
      }
      const status = resolveAiRecordStatus({
        requestedStatus: input.status,
        clinicianConfirmed: input.clinicianConfirmed,
      });

      // Tenant scoping: a report may only reference this practice's patient.
      let patient:
        | { clientId: string | null; status: string }
        | undefined;
      if (input.patientId) {
        [patient] = await ctx.db
          .select({ clientId: patients.clientId, status: patients.status })
          .from(patients)
          .where(
            and(
              eq(patients.id, input.patientId),
              eq(patients.practiceId, ctx.practiceId),
              isNull(patients.deletedAt),
            ),
          )
          .limit(1);
        if (!patient) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Pacient sa nenašiel",
          });
        }
      }

      const [saved] = await ctx.db
        .insert(dischargeReports)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId ?? null,
          appointmentId: input.appointmentId ?? null,
          createdBy: ctx.user.id,
          petName: input.petName,
          species: input.species ?? null,
          diagnosis: input.diagnosis,
          treatment: input.treatment ?? null,
          followUp: input.followUp ?? null,
          reportText: input.reportText,
          language: input.language,
          modelId: process.env.AI_MODEL ?? DEFAULT_AI_MODEL,
          status,
        })
        .returning();

      if (!saved) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nepodarilo sa uložiť prepúšťaciu správu",
        });
      }

      // Drafts never leave the chart: no webhook, no owner communication.
      if (saved.status !== "finalized") {
        return saved;
      }

      void dispatchWebhookEvent(ctx.practiceId, "discharge_report.finalized", {
        reportId: saved.id,
        patientId: saved.patientId,
        appointmentId: saved.appointmentId,
      });

      if (saved.patientId && patient) {
        if (patient.status === "deceased") {
          // Sympathy gate: block every recall/marketing trigger for a
          // deceased patient and route staff to a condolence task instead.
          if (patient.clientId) {
            await applySympathyGate(
              ctx.db,
              ctx.practiceId,
              patient.clientId,
              saved.patientId,
              "discharge_sympathy_gate"
            );
          }
        } else if (patient.clientId) {
          await schedulePostopCheckIn(
            ctx.db,
            ctx.practiceId,
            patient.clientId,
            saved.patientId
          );

          // Automatické vyvolanie klinických recallov (dentálna hygiena a geriatrický screening)
          const clinicalContext = `${saved.diagnosis} ${saved.treatment ?? ""} ${saved.reportText}`;
          await detectAndTriggerDentalRecall(
            ctx.db,
            ctx.practiceId,
            patient.clientId,
            saved.patientId,
            clinicalContext
          );
          await checkAndTriggerSeniorMilestone(
            ctx.db,
            ctx.practiceId,
            patient.clientId,
            saved.patientId
          );
        }
      }

      return saved;
    }),

  /** Zoznam správ pre konkrétneho pacienta */
  listByPatient: dischargeProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(dischargeReports)
        .where(
          and(
            eq(dischargeReports.practiceId, ctx.practiceId),
            eq(dischargeReports.patientId, input.patientId),
            isNull(dischargeReports.deletedAt),
          ),
        )
        .orderBy(desc(dischargeReports.createdAt))
        .limit(20);
    }),

  /** Zoznam posledných správ praxe */
  listRecent: dischargeProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(dischargeReports)
      .where(
        and(
          eq(dischargeReports.practiceId, ctx.practiceId),
          isNull(dischargeReports.deletedAt),
        ),
      )
      .orderBy(desc(dischargeReports.createdAt))
      .limit(10);
  }),
});
