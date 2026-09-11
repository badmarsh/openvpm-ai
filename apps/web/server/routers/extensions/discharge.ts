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
import { dischargeReports, patients, practices, extMarketingContentItems, extAiAuditLog } from "@openpims/db";
import { configuredModel } from "@/lib/agent/runner";
import {
  assertPatientNotDeceased,
  requireConfirmationEnvelopeId,
  requireExpectedRevision,
} from "./_safety";
import { DEFAULT_AI_MODEL } from "@/lib/ai-models";
import { recordUsage } from "@/lib/billing/usage";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import { validateMarketingText } from "@/lib/marketing/validator";
import {
  schedulePostopCheckIn,
  applySympathyGate,
  detectAndTriggerDentalRecall,
  checkAndTriggerSeniorMilestone,
} from "@/lib/marketing/messaging";
import type { Database } from "@openpims/db/client";
import { assertAgentRole, requireTrustedActorRole } from "@/lib/authorization";
import { appendAiAuditEvent } from "@/lib/ai/audit-ledger";
import {
  consumeClinicianConfirmation,
  issueClinicianConfirmation,
  ClinicianConfirmationError,
} from "@/lib/ai/clinician-confirmation";
import {
  CLINICIAN_CONFIRMATION_REQUIRED_MESSAGE,
  buildAiConfirmationAuditTrail,
  optionalClinicianConfirmationInput,
  resolveAiRecordStatus,
  generateContentHash,
  isClinicianConfirmed,
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

// Sympathy-flow safety gate (Skill §3) — shared implementation in _safety.ts

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
      } catch {
        // AI generation unavailable – fall back to the validated templates below.
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
  /**
   * Pre-issues an actor-bound, payload-bound confirmation envelope token for discharge finalization.
   *
   * New-entity binding: when no `reportId` is supplied, a server-side draft
   * report row is created first and the envelope is issued against its real
   * ID. Confirmations are NEVER bound to a surrogate identity (such as the
   * clinician's user ID) — the envelope must always authorize the exact
   * entity that `save` will finalize.
   */
  prepareConfirmation: dischargeProcedure
    .input(
      z.object({
        reportId: z.string().uuid().optional(),
        patientId: z.string().uuid().optional(),
        appointmentId: z.string().uuid().optional(),
        petName: z.string().min(1).max(255),
        species: z.string().max(255).optional(),
        diagnosis: z.string().min(1).max(5000),
        treatment: z.string().max(5000).optional(),
        followUp: z.string().max(5000).optional(),
        reportText: z.string().min(1).max(50_000),
        originalAiDraft: z.string().max(50_000).optional(),
        language: z.string().max(8).default("sk"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actorRole = requireTrustedActorRole(
        ctx.user.role,
        "Discharge confirmation requires an authenticated staff role.",
      );
      assertAgentRole(
        { userRole: actorRole },
        ["admin", "veterinarian"],
        "Only veterinarians and admins may prepare confirmation envelopes for discharge.",
      );

      const originalAiDraft = input.originalAiDraft ?? input.reportText;
      const originalDraftHash = generateContentHash(originalAiDraft);
      const confirmedContentHash = generateContentHash(input.reportText);

      // Draft creation + envelope issuance run atomically so the envelope can
      // never reference a report row that failed to persist.
      const { envelope, reportId } = await ctx.db.transaction(async (tx) => {
        const db = tx as unknown as Database;
        let targetEntityId = input.reportId;
        let expectedRevision = 0;

        if (targetEntityId) {
          const [existing] = await db
            .select()
            .from(dischargeReports)
            .where(
              and(
                eq(dischargeReports.id, targetEntityId),
                eq(dischargeReports.practiceId, ctx.practiceId),
                isNull(dischargeReports.deletedAt),
              ),
            )
            .limit(1);

          if (!existing) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Discharge report not found" });
          }
          if (existing.status === "finalized") {
            throw new TRPCError({ code: "CONFLICT", message: "Discharge report is already finalized." });
          }
          expectedRevision = existing.revision;
        } else {
          if (input.patientId) {
            const [patientRecord] = await db
              .select({ id: patients.id })
              .from(patients)
              .where(
                and(
                  eq(patients.id, input.patientId),
                  eq(patients.practiceId, ctx.practiceId),
                  isNull(patients.deletedAt),
                ),
              )
              .limit(1);
            if (!patientRecord) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Patient not found",
              });
            }
          }
          const [draft] = await db
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
              status: "draft",
              revision: 0,
            })
            .returning({ id: dischargeReports.id });
          if (!draft) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create discharge draft",
            });
          }
          targetEntityId = draft.id;
          expectedRevision = 0;
        }

        const issued = await issueClinicianConfirmation(db, {
          practiceId: ctx.practiceId,
          actorId: ctx.user.id,
          actorRole,
          actionType: "discharge_finalized",
          entityType: "discharge_report",
          entityId: targetEntityId,
          expectedRevision,
          originalDraftHash,
          confirmedContentHash,
        });
        return { envelope: issued, reportId: targetEntityId };
      });

      return {
        confirmationId: envelope.id,
        reportId,
        expiresAt: envelope.expiresAt,
        expectedRevision: envelope.expectedRevision,
        originalDraftHash,
        confirmedContentHash,
      };
    }),

  /**
   * Uloží vygenerovanú správu do databázy s atomickou auditnou integritou a
   * optimistickou konkurencionou ochranou.
   *
   * Human-in-the-loop: AI-generated discharge text is a *draft* until a
   * clinician finalizes it with a pre-issued one-time confirmation envelope
   * (see `prepareConfirmation`). Only a confirmed, finalized report emits the
   * webhook or schedules owner communication. All DB operations run in a
   * single transaction.
   *
   * Finalization always targets an existing draft: `prepareConfirmation`
   * creates the server-side draft when needed and returns its `reportId`.
   * Updates of an existing report (draft or finalize) require
   * `expectedRevision`; only brand-new draft creation omits it.
   */
  save: dischargeProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        // Optional at the schema layer so a missing token on update/finalize
        // paths fails with the explicit PRECONDITION_FAILED contract
        // (requireExpectedRevision), never with silent fallback to the
        // stored revision. Only brand-new draft creation omits it.
        expectedRevision: z.number().int().min(0).optional(),
        patientId: z.string().uuid().optional(),
        appointmentId: z.string().uuid().optional(),
        petName: z.string().min(1).max(255),
        species: z.string().max(255).optional(),
        diagnosis: z.string().min(1).max(5000),
        treatment: z.string().max(5000).optional(),
        followUp: z.string().max(5000).optional(),
        reportText: z.string().min(1).max(50_000),
        originalAiDraft: z.string().max(50_000).optional(),
        language: z.string().max(8).default("sk"),
        status: z.enum(["draft", "finalized"]).default("draft"),
        clinicianConfirmed: optionalClinicianConfirmationInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.status === "finalized" && !isClinicianConfirmed(input.clinicianConfirmed)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: CLINICIAN_CONFIRMATION_REQUIRED_MESSAGE,
        });
      }
      const status = resolveAiRecordStatus({
        requestedStatus: input.status,
        clinicianConfirmed: input.clinicianConfirmed,
      });

      const actorRole = requireTrustedActorRole(
        ctx.user.role,
        "Discharge save requires an authenticated staff role.",
      );
      // Option 1 (envelope required): bare `clinicianConfirmed: true` is
      // rejected — only a pre-issued one-time confirmation token finalizes.
      const confirmationId =
        status === "finalized"
          ? requireConfirmationEnvelopeId(input.clinicianConfirmed)
          : null;
      if (status === "finalized") {
        assertAgentRole(
          { userRole: actorRole },
          ["admin", "veterinarian"],
          "Only veterinarians and admins may finalize discharge reports.",
        );
        if (!input.id) {
          // A confirmation envelope always binds an existing draft entity
          // (prepareConfirmation creates it when needed). Finalizing a
          // not-yet-existing report cannot be entity-bound — reject so the
          // caller follows the prepare-first flow instead of silently
          // recording an unbound confirmation.
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Finalization requires an existing draft. Call prepareConfirmation first and finalize with the returned reportId.",
          });
        }
      }

      const originalAiDraft = input.originalAiDraft ?? input.reportText;
      const originalDraftHash = generateContentHash(originalAiDraft);
      const confirmedContentHash = generateContentHash(input.reportText);
      const wasEditedByClinician = originalDraftHash !== confirmedContentHash;

      // ATOMIC TRANSACTION: discharge report (create/update) + clinician confirmation + audit ledger
      const { saved, patient } = await ctx.db.transaction(async (tx) => {
        const db = tx as unknown as Database;

        // Tenant scoping: a report may only reference this practice's patient.
        let patientRecord: { clientId: string | null; status: string } | undefined;
        if (input.patientId) {
          [patientRecord] = await db
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
          if (!patientRecord) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Patient not found",
            });
          }
        }

        let savedReport: typeof dischargeReports.$inferSelect;

        if (input.id) {
          const [existing] = await db
            .select()
            .from(dischargeReports)
            .where(
              and(
                eq(dischargeReports.id, input.id),
                eq(dischargeReports.practiceId, ctx.practiceId),
                isNull(dischargeReports.deletedAt),
              ),
            )
            .limit(1)
            .for("update");

          if (!existing) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Discharge report not found" });
          }
          if (existing.status === "finalized") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Discharge report is already finalized.",
            });
          }

          const expectedRevision = requireExpectedRevision(
            input.expectedRevision,
          );
          if (existing.revision !== expectedRevision) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `Discharge report changed concurrently. Expected revision ${expectedRevision}, got ${existing.revision}.`,
            });
          }

          if (status === "finalized") {
            try {
              await consumeClinicianConfirmation(db, {
                confirmationId: confirmationId as string,
                practiceId: ctx.practiceId,
                actorId: ctx.user.id,
                actorRole,
                actionType: "discharge_finalized",
                entityType: "discharge_report",
                entityId: existing.id,
                expectedRevision,
                originalDraftHash,
                confirmedContentHash,
              });
            } catch (err) {
              if (err instanceof ClinicianConfirmationError) {
                const code =
                  err.code === "NOT_FOUND"
                    ? "NOT_FOUND"
                    : err.code === "EXPIRED" ||
                        err.code === "ALREADY_CONSUMED" ||
                        err.code === "REVISION_MISMATCH"
                      ? "CONFLICT"
                      : "PRECONDITION_FAILED";
                throw new TRPCError({ code, message: err.message });
              }
              throw err;
            }

            await appendAiAuditEvent(db, {
              practiceId: ctx.practiceId,
              actorId: ctx.user.id,
              actorName: ctx.user.name ?? ctx.user.email ?? "Clinician",
              actorRole,
              entityType: "discharge_report",
              entityId: existing.id,
              actionType: "discharge_finalized",
              originalDraftHash,
              confirmedContentHash,
              wasEditedByClinician,
            });
          }

          const [updated] = await db
            .update(dischargeReports)
            .set({
              patientId: input.patientId ?? existing.patientId,
              appointmentId: input.appointmentId ?? existing.appointmentId,
              petName: input.petName,
              species: input.species ?? existing.species,
              diagnosis: input.diagnosis,
              treatment: input.treatment ?? existing.treatment,
              followUp: input.followUp ?? existing.followUp,
              reportText: input.reportText,
              language: input.language,
              status,
              revision: existing.revision + 1,
            })
            .where(
              and(
                eq(dischargeReports.id, existing.id),
                eq(dischargeReports.practiceId, ctx.practiceId),
                eq(dischargeReports.status, "draft"),
                eq(dischargeReports.revision, expectedRevision),
              ),
            )
            .returning();

          if (!updated) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Discharge report was modified concurrently.",
            });
          }
          savedReport = updated;
        } else {
          // New report insert
          const [inserted] = await db
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
              revision: 0,
            })
            .returning();

          if (!inserted) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to save discharge report",
            });
          }

          // NOTE: finalize-on-create is rejected before the transaction
          // (a confirmation envelope always binds an existing draft entity
          // issued by prepareConfirmation). This branch only persists drafts.
          savedReport = inserted;
        }

        return { saved: savedReport, patient: patientRecord };
      });

      // Side effects executed ONLY AFTER transaction commits
      if (saved.status === "finalized") {
        void dispatchWebhookEvent(ctx.practiceId, "discharge_report.finalized", {
          reportId: saved.id,
          patientId: saved.patientId,
          appointmentId: saved.appointmentId,
        });

        if (saved.patientId && patient) {
          if (patient.status === "deceased") {
            if (patient.clientId) {
              await applySympathyGate(
                ctx.db,
                ctx.practiceId,
                patient.clientId,
                saved.patientId,
                "discharge_sympathy_gate",
              );
            }
          } else if (patient.clientId) {
            await schedulePostopCheckIn(
              ctx.db,
              ctx.practiceId,
              patient.clientId,
              saved.patientId,
            );

            const clinicalContext = `${saved.diagnosis} ${saved.treatment ?? ""} ${saved.reportText}`;
            await detectAndTriggerDentalRecall(
              ctx.db,
              ctx.practiceId,
              patient.clientId,
              saved.patientId,
              clinicalContext,
            );
            await checkAndTriggerSeniorMilestone(
              ctx.db,
              ctx.practiceId,
              patient.clientId,
              saved.patientId,
            );
          }
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

  /** Generuje SMS súhrn do 160 znakov a vizuálny liekový rozvrh */
  generateSmsAndSchedule: dischargeProcedure
    .input(
      z.object({
        patientId: z.string().uuid().optional(),
        petName: z.string().min(1).max(255),
        diagnosis: z.string().min(1).max(5000),
        treatment: z.string().max(5000).optional(),
        followUp: z.string().max(5000).optional(),
        language: z.enum(["sk", "en"]).default("sk"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Sympathy gate: never draft an owner SMS for a deceased patient.
      await assertPatientNotDeceased(ctx.db, input.patientId);

      const [practice] = await ctx.db
        .select({ name: practices.name, phone: practices.phone })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);

      const clinicName = practice?.name || "Klinika";
      const clinicPhone = practice?.phone || "";

      // Default fallback values
      let smsText = `${clinicName}: ${input.petName} je po zakroku. Lieky podavajte podla planu. V pripade nudze: ${clinicPhone}`.slice(0, 160);
      let medicationSchedule: Array<{
        medicationName: string;
        dosage: string;
        frequency: string;
        morning: boolean;
        noon: boolean;
        evening: boolean;
        night: boolean;
        withFood: boolean;
        notes: string;
      }> = [];
      let warningSigns: string[] = [
        "Apatia, slabosť alebo neschopnosť vstať",
        "Opakované zvracanie alebo neustupujúca hnačka",
        "Dýchavičnosť, sťažené dýchanie",
        "Krvácanie alebo výrazný opuch operačnej rany",
      ];

      // Parse medications from treatment text deterministically as baseline
      if (input.treatment) {
        const lines = input.treatment.split(/[,;\n]+/).map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          const isMorning = /ráno|rano|morning|1x|2x|3x/i.test(line);
          const isEvening = /večer|vecer|evening|2x|3x/i.test(line);
          const isNoon = /obed|noon|3x/i.test(line);
          medicationSchedule.push({
            medicationName: line.split(/[\d]/)[0]?.trim() || line,
            dosage: line,
            frequency: /2x/i.test(line) ? "2x denne" : /3x/i.test(line) ? "3x denne" : "1x denne",
            morning: isMorning || (!isMorning && !isEvening && !isNoon),
            noon: isNoon,
            evening: isEvening,
            night: false,
            withFood: /jedl|krmiv|food/i.test(line),
            notes: line,
          });
        }
      }

      // Try AI refinement if available
      try {
        const model = configuredModel();
        const prompt = `Z nasledujúcich klinických údajov vygeneruj presný JSON s 3 poľami:
1. "smsText": stručná SMS správa pre majiteľa, MAXIMÁLNE 160 ZNAKOV. Musí obsahovať meno pacienta (${input.petName}), potvrdenie stavu, hlavný liek a núdzový kontakt (${clinicPhone}).
2. "medicationSchedule": pole objektov s kľúčmi { "medicationName": string, "dosage": string, "frequency": string, "morning": boolean, "noon": boolean, "evening": boolean, "night": boolean, "withFood": boolean, "notes": string }
3. "warningSigns": pole 3-4 kľúčových varovných príznakov ako stringy.

Klinika: ${clinicName}
Pacient: ${input.petName}
Diagnóza: ${input.diagnosis}
Liečba a lieky: ${input.treatment || "N/A"}
Kontrola: ${input.followUp || "N/A"}

Odpovedz VÝHRADNE čistým JSON objektom.`;

        const res = await generateText({
          model,
          prompt,
        });

        const raw = res.text.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
        const parsed = JSON.parse(raw);
        if (parsed.smsText) smsText = String(parsed.smsText).slice(0, 160);
        if (Array.isArray(parsed.medicationSchedule) && parsed.medicationSchedule.length > 0) {
          medicationSchedule = parsed.medicationSchedule;
        }
        if (Array.isArray(parsed.warningSigns) && parsed.warningSigns.length > 0) {
          warningSigns = parsed.warningSigns;
        }
      } catch {
        // Fall back to the deterministic defaults above.
      }

      return {
        smsText,
        medicationSchedule,
        warningSigns,
      };
    }),

  /** Vytvorí anonymizovaný edukačný príspevok na sociálne siete z prepúšťacieho prípadu */
  createMarketingPostFromCase: dischargeProcedure
    .input(
      z.object({
        patientId: z.string().uuid().optional(),
        petName: z.string().min(1).max(255),
        species: z.string().max(255).optional(),
        diagnosis: z.string().min(1).max(5000),
        treatment: z.string().max(5000).optional(),
        channel: z.enum(["instagram", "facebook", "google_business"]).default("instagram"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Sympathy gate: never draft a marketing post for a deceased patient.
      await assertPatientNotDeceased(ctx.db, input.patientId);

      const [practice] = await ctx.db
        .select({ name: practices.name })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);

      const clinicName = practice?.name || "Naša veterinárna klinika";
      const speciesLabel = input.species?.toLowerCase().includes("mač") ? "mačička" : "psík";

      // Build compliant, educational story compliant with KVL SR ethics
      let title = `Edukačný prípad: Liečba ochorenia (${speciesLabel})`;
      let body = `🐾 Z našej ambulancie: Starostlivosť o pacienta po zákroku\n\n` +
        `Nedávno nás navštívil štvornohý pacient s diagnózou: ${input.diagnosis}. ` +
        `Vďaka včasnej diagnostike a nasadeniu vhodnej starostlivosti je pacient stabilizovaný a v domácom liečení.\n\n` +
        `💡 Čo si všímať u vašich miláčikov doma?\n` +
        `Ak spozorujete apatiu, nechutenstvo alebo zmenu správania, nečakajte – včasná návšteva veterinára výrazne uľahčuje liečbu a chráni zdravie zvieraťa.\n\n` +
        `🩺 Radi vám poradíme v ${clinicName}.\n` +
        `#veterinar #starostlivostozvierata #zdraviezvierat #veterinarnaklinika`;

      try {
        const model = configuredModel();
        const prompt = `Si marketingový expert pre veterinárnu kliniku na Slovensku.
Vytvor pútavý, odborný a anonymizovaný edukačný príspevok pre ${input.channel}.
Striktne dodržiavaj Etický kódex Komory veterinárnych lekárov SR:
- ŽIADNE uvádzanie celých mien majiteľov (plná anonymizácia pacienta).
- ŽIADNE názvy liekov viazaných na lekársky predpis (antibiotiká, anestetiká).
- ŽIADNA agresívna reklama typu 'sme najlepší/najlacnejší'.
- Zameraj sa na edukáciu majiteľov (prevencia, kedy ísť k lekárovi).

Klinika: ${clinicName}
Pacient: ${speciesLabel}
Diagnóza: ${input.diagnosis}
Vykonaná starostlivosť: ${input.treatment || "štandardná terapia"}

Vráť JSON: { "title": string, "body": string }`;

        const res = await generateText({ model, prompt });
        const raw = res.text.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
        const parsed = JSON.parse(raw);
        if (parsed.title) title = parsed.title;
        if (parsed.body) body = parsed.body;
      } catch {
        // Fall back to the deterministic defaults above.
      }

      // Validate through the KVL SR compliance validator
      const validationReport = validateMarketingText({ text: body, context: "marketing" });

      const [item] = await ctx.db
        .insert(extMarketingContentItems)
        .values({
          practiceId: ctx.practiceId,
          createdBy: ctx.user.id,
          title,
          body,
          channel: input.channel,
          status: validationReport.verdict === "block" ? "blocked" : "proposed",
          validatorVerdict: validationReport.verdict,
          validatorFindings: validationReport.findings,
        })
        .returning();

      return {
        item,
        validationReport,
      };
    }),
});

