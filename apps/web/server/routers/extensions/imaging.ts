import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { eq, and, isNull, desc, ilike, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import {
  createRouter,
  protectedProcedure,
  requireRole,
  requireFeature,
} from "../../trpc";
import {
  aiImagingAnalyses,
  files,
  treatmentPlans,
  treatmentPlanItems,
  vitalSigns,
  patients,
  practices,
  consentForms,
  consentRequests,
  rooms,
  soapNotes,
  extMarketingContentItems,
  extAiAuditLog,
} from "@openpims/db";
import type { Database } from "@openpims/db/client";
import { configuredModel } from "@/lib/agent/runner";
import { DEFAULT_AI_MODEL } from "@/lib/ai-models";
import { readPrimaryObject } from "@/lib/s3";
import { calculateVhs as computeVhs } from "@/lib/imaging/vhs-calculator";
import { validateMarketingText } from "@/lib/marketing/validator";
import {
  saveAppointmentSoapDraft,
  SoapLifecycleError,
} from "@/lib/records/soap-lifecycle";
import {
  AiDraftSafetyError,
  assertAiMayWriteToSoapNote,
  assertClinicianConfirmed,
  buildAiConfirmationAuditTrail,
  clinicianConfirmationInput,
} from "@/lib/ai/draft-safety";

export const MEDICAL_IMAGING_SYSTEM_PROMPT = `You are a veterinary radiology AI assistant integrated into OpenVPM, an open-source veterinary practice management system.

Your role is to analyze medical images (X-rays, CT scans, MRI, ultrasound, clinical photos) and provide structured, clinically useful observations.

Guidelines:
- Describe what you see objectively — list findings, never give a definitive diagnosis.
- Always include a disclaimer that this is AI-assisted analysis and must be reviewed by a licensed veterinarian.
- Use the SOAP (Subjective, Objective, Assessment, Plan) framework when appropriate.
- Note any visible abnormalities, artifacts, positioning issues, or limitations.
- If the image quality is poor, state that clearly.
- Answer in the same language as the user's prompt (Slovak or English).
- For Slovak responses, use official Slovak veterinary terminology (ŠVPS SR, KVL SR).
- Be concise but thorough.`;

export const MODALITY_SYSTEM_PROMPTS: Record<string, string> = {
  xray: `Si špecialista na veterinárnu rádiológiu (RTG) v systéme OpenVPM.
Pri analýze rádiologickej snímky postupuj systematicky:
1. Projekcia a technická kvalita snímky (laterálna, ventrodorzálna VD, dorzoventrálna DV, expozícia, pohybové artefakty).
2. Skelet a axiálny aparát (fraktúry, osteolýza, periostálne reakcie, subluxácie, spondylóza, diskopatia).
3. Hrudník (ak je relevantný):
   - Pľúcny parenchým: pľúcne vzory (alveolárny, intersticiálny, bronchiálny, vaskulárny).
   - Kardiovaskulárny aparát: srdcová silueta (VHS, dilatácia komôr/predsieň), tracheálny uhol, v. cava caudalis, aorta.
   - Pleurálny priestor: výpotok, pneumotorax, bránica.
4. Brušná dutina (ak je relevantná): detail pobrušnice, kontúry orgánov, plynatosť, cudzie telesá, urolitiáza.
Vždy uveď zoznam objektívnych rádiologických nálezov, diferenciálne diagnózy a pripomeň, že nález musí verifikovať licencovaný veterinárny lekár.
Odpovedz v jazyku zadania (slovenčina / angličtina).`,

  ultrasound: `Si špecialista na veterinárnu ultrasonografiu (USG/SONO) v systéme OpenVPM.
Pri analýze sonogramu postupuj systematicky:
1. Vyšetrovaný orgán / oblasť a rovina rezu.
2. Echogenita a parenchymálna architektúra (homogénna/nehomogénna, anechogénne, hypoechogénne, hyperechogénne štruktúry).
3. Ohraničenie, marginácie, hrúbka stien (žalúdok, tenké/hrubé črevo, močový mechúr, žlčník) a vrstevnatosť.
4. Prítomnosť voľnej tekutiny (AFAST/TFAST protokol) a cievne prietoky.
5. Falošné artefakty (akustický tieň, distálne zosilnenie, reverberácie).
Vždy uveď zoznam objektívnych sonografických nálezov, diferenciálne diagnózy a pripomeň nutnosť verifikácie veterinárom.
Odpovedz v jazyku zadania (slovenčina / angličtina).`,

  ct: `Si špecialista na veterinárnu počítačovú tomografiu (CT) v systéme OpenVPM.
Pri analýze CT rezov postupuj systematicky:
1. Rovina rezu (axiálna, sagitálna, koronárna) a použité okno (kostné, mäkkotkanivové, pľúcne).
2. Atenuácia a denzita tkanív v Hounsfieldových jednotkách (HU).
3. Kontrastné sýtenie a vaskulárna architektúra (ak je aplikovaná k.l.).
4. Kompresívne lézie miechy, expanzívne procesy, asymetrie mäkkých tkanív.
Vždy uveď objektívne CT nálezy a diferenciálne diagnózy podliehajúce verifikácii veterinárom.
Odpovedz v jazyku zadania (slovenčina / angličtina).`,

  mri: `Si špecialista na veterinárnu magnetickú rezonanciu (MRI) v systéme OpenVPM.
Pri analýze MRI sekvencií postupuj systematicky:
1. Zobrazená sekvencia (T1W, T2W, FLAIR, T2* GRE, post-kontrast T1+C).
2. Intenzita signálu (hyperintenzívny, izointenzívny, hypointenzívny).
3. Edém, kompresia nervových štruktúr, lebečné/miechové lézie, sýtenie meningov.
Vždy uveď zoznam nálezov a diferenciálne diagnózy. Odpovedz v jazyku zadania (slovenčina / angličtina).`,

  photo: `Si veterinárny dermatológ a chirurg v systéme OpenVPM.
Pri analýze klinickej fotografie postupuj systematicky:
1. Anatomická lokalizácia a morfológia lézie (makula, papula, pustula, krusta, erózia, ulcus, fistula, alopécia, tumor).
2. Rozsah, ohraničenie, zápalové zmeny (erytém, edém, purulentný / serózny exsudát).
3. Stav hojenia rany a stehov pri pooperačných ranách.
4. Diferenciálna diagnostika a odporúčané doplnkové vyšetrenia (cytológia, zoškrab, biopsia, kultivácia).
Vždy pripomeň, že foto-analýza je len orientačná a vyžaduje priame klinické vyšetrenie.
Odpovedz v jazyku zadania (slovenčina / angličtina).`,
};

const analyzeInput = z.object({
  fileId: z.string().uuid(),
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  imageType: z.enum(["xray", "ct", "mri", "ultrasound", "photo"]),
  userPrompt: z.string().max(2000).optional(),
});

const listByPatientInput = z.object({
  patientId: z.string().uuid(),
});

const getInput = z.object({
  id: z.string().uuid(),
});

const imagingProcedure = protectedProcedure
  .use(requireRole("admin", "veterinarian"))
  .use(requireFeature("agent"));

export const imagingRouter = createRouter({
  /** Spustí AI analýzu medicínskeho obrazu */
  analyze: imagingProcedure
    .input(analyzeInput)
    .mutation(async ({ ctx, input }) => {
      // 1. Načíta file z DB
      const [file] = await ctx.db
        .select({
          id: files.id,
          fileKey: files.fileKey,
          mimeType: files.mimeType,
          fileName: files.fileName,
        })
        .from(files)
        .where(
          and(
            eq(files.id, input.fileId),
            eq(files.practiceId, ctx.practiceId),
            isNull(files.deletedAt),
          ),
        )
        .limit(1);

      if (!file) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found",
        });
      }

      // 2. Vytvorí záznam analýzy so statusom PENDING
      const [analysis] = await ctx.db
        .insert(aiImagingAnalyses)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          fileId: input.fileId,
          appointmentId: input.appointmentId ?? null,
          requestedBy: ctx.user.id,
          modelId: process.env.AI_MODEL ?? DEFAULT_AI_MODEL,
          imageType: input.imageType,
          userPrompt: input.userPrompt ?? null,
          status: "PENDING",
        })
        .returning();

      if (!analysis) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nepodarilo sa vytvoriť záznam analýzy",
        });
      }

      try {
        // 3. Načíta obraz z objektového úložiska (priamo, bez HTTP round-trip)
        const object = await readPrimaryObject(file.fileKey, {
          maxBytes: 16 * 1024 * 1024,
        });
        if (object.status !== "available") {
          throw new Error(
            object.status === "missing"
              ? "Obraz sa v úložisku nenašiel"
              : "Obraz sa nepodarilo načítať z úložiska",
          );
        }

        const base64Image = Buffer.from(object.body).toString("base64");
        const mimeType = file.mimeType ?? object.contentType ?? "image/jpeg";
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        // 4. Zavolá AI model
        const promptText = input.userPrompt
          ? `Analyzuj tento medicínsky obraz (${input.imageType}). Otázka lekára: ${input.userPrompt}`
          : `Analyzuj tento medicínsky obraz (${input.imageType}). Poskytni štruktúrovaný popis nálezov.`;

        const model = configuredModel();
        const systemPrompt =
          MODALITY_SYSTEM_PROMPTS[input.imageType] ?? MEDICAL_IMAGING_SYSTEM_PROMPT;

        const result = await generateText({
          model,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                { type: "image", image: dataUrl },
              ],
            },
          ],
        });

        const resultText = result.text.trim();

        // 5. Uloží výsledok
        const [updated] = await ctx.db
          .update(aiImagingAnalyses)
          .set({
            status: "COMPLETED",
            result: resultText,
            rawResponse: { text: resultText, finishReason: result.finishReason },
            completedAt: new Date(),
          })
          .where(eq(aiImagingAnalyses.id, analysis.id))
          .returning();

        return updated;
      } catch (error) {
        // 6. Označí ako FAILED
        const errorMessage =
          error instanceof Error ? error.message : "Neznáma chyba";

        await ctx.db
          .update(aiImagingAnalyses)
          .set({
            status: "FAILED",
            errorMessage,
            completedAt: new Date(),
          })
          .where(eq(aiImagingAnalyses.id, analysis.id));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Analýza zlyhala: ${errorMessage}`,
        });
      }
    }),

  /** Vráti všetky analýzy pre daného pacienta */
  listByPatient: imagingProcedure
    .input(listByPatientInput)
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(aiImagingAnalyses)
        .where(
          and(
            eq(aiImagingAnalyses.practiceId, ctx.practiceId),
            eq(aiImagingAnalyses.patientId, input.patientId),
            isNull(aiImagingAnalyses.deletedAt),
          ),
        )
        .orderBy(desc(aiImagingAnalyses.createdAt));
    }),

  /** Vráti detail jednej analýzy */
  get: imagingProcedure
    .input(getInput)
    .query(async ({ ctx, input }) => {
      const [analysis] = await ctx.db
        .select()
        .from(aiImagingAnalyses)
        .where(
          and(
            eq(aiImagingAnalyses.id, input.id),
            eq(aiImagingAnalyses.practiceId, ctx.practiceId),
            isNull(aiImagingAnalyses.deletedAt),
          ),
        )
        .limit(1);

      if (!analysis) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Analysis not found",
        });
      }

      return analysis;
    }),

  /** Generuje predoperačný a anestéziologický liečebný plán na základe AI rádiologického nálezu */
  createSurgicalPlanFromImaging: imagingProcedure
    .input(
      z.object({
        analysisId: z.string().uuid(),
        appointmentId: z.string().uuid().optional(),
        targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        procedureTitle: z.string().max(255).optional(),
        customNotes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Over analýzu
      const [analysis] = await ctx.db
        .select()
        .from(aiImagingAnalyses)
        .where(
          and(
            eq(aiImagingAnalyses.id, input.analysisId),
            eq(aiImagingAnalyses.practiceId, ctx.practiceId),
            isNull(aiImagingAnalyses.deletedAt)
          )
        )
        .limit(1);

      if (!analysis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Analýza sa nenašla" });
      }

      // 2. Over pacienta a zisti váhu z vitálnych funkcií
      const [patient] = await ctx.db
        .select({ id: patients.id, name: patients.name, species: patients.species, clientId: patients.clientId })
        .from(patients)
        .where(and(eq(patients.id, analysis.patientId), eq(patients.practiceId, ctx.practiceId)))
        .limit(1);

      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
      }

      const [latestVitals] = await ctx.db
        .select({ weightKg: vitalSigns.weightKg })
        .from(vitalSigns)
        .where(
          and(
            eq(vitalSigns.patientId, patient.id),
            eq(vitalSigns.practiceId, ctx.practiceId),
            isNull(vitalSigns.deletedAt)
          )
        )
        .orderBy(desc(vitalSigns.recordedAt))
        .limit(1);

      const weightKg = parseFloat(latestVitals?.weightKg ?? "10") || 10;

      // 3. Rozpoznanie indikácie a názvu zákroku
      const resultLower = (analysis.result || "").toLowerCase();
      let derivedTitle = input.procedureTitle;
      if (!derivedTitle) {
        if (resultLower.includes("fraktúr") || resultLower.includes("fractur") || resultLower.includes("zlomen")) {
          derivedTitle = "Chirurgická osteosyntéza fraktúry";
        } else if (resultLower.includes("cudz") || resultLower.includes("foreign")) {
          derivedTitle = "Gastrotómia / Enterotómia (extrakcia cudzieho telesa)";
        } else if (resultLower.includes("pyometr") || resultLower.includes("uter")) {
          derivedTitle = "Ovariohysterektómia (Pyometra)";
        } else if (resultLower.includes("luxác") || resultLower.includes("luxat")) {
          derivedTitle = "Chirurgická repozícia a stabilizácia luxácie";
        } else if (resultLower.includes("tumor") || resultLower.includes("novotvar") || resultLower.includes("útvar")) {
          derivedTitle = "Chirurgická extirpácia útvaru a biopsia";
        } else {
          derivedTitle = `Chirurgický zákrok (${analysis.imageType.toUpperCase()} nález)`;
        }
      }

      // 4. Výpočet anestéziologického protokolu podľa hmotnosti
      const doseButorphanolMg = (weightKg * 0.2).toFixed(2);
      const doseButorphanolMl = (weightKg * 0.2 / 10).toFixed(2); // Butomidor 10mg/ml
      const doseMedetomidineMg = (weightKg * 0.01).toFixed(3);
      const doseMedetomidineMl = (weightKg * 0.01 / 1).toFixed(2); // Sedator 1mg/ml
      const dosePropofolMg = (weightKg * 3.5).toFixed(1);
      const dosePropofolMl = (weightKg * 0.35).toFixed(1); // Propofol 10mg/ml
      const doseMeloxicamMg = (weightKg * 0.2).toFixed(2);
      const doseMeloxicamMl = (weightKg * 0.2 / 5).toFixed(2); // Meloxidyl 5mg/ml

      const anesthesiaSummary = {
        patientWeightKg: weightKg,
        premedication: `Butorfanol: ${doseButorphanolMg} mg (${doseButorphanolMl} ml Butomidor 10mg/ml) + Medetomidín: ${doseMedetomidineMg} mg (${doseMedetomidineMl} ml Sedator 1mg/ml) i.m./i.v.`,
        induction: `Propofol: cca ${dosePropofolMg} mg (${dosePropofolMl} ml Propofol 1%) i.v. do účinku + intubácia`,
        maintenance: "Inhalačný izoflurán / sevoflurán s O2 + monitorovanie EKG/kapno/pulz",
        analgesiaPostOp: `Meloxikam: ${doseMeloxicamMg} mg (${doseMeloxicamMl} ml Meloxidyl 5mg/ml) s.c.`,
      };

      // 5. Vytvor záznam v treatmentPlans
      const planDate = input.targetDate ?? new Date().toISOString().slice(0, 10);
      const [plan] = await ctx.db
        .insert(treatmentPlans)
        .values({
          practiceId: ctx.practiceId,
          patientId: patient.id,
          title: derivedTitle,
          description: `Chirurgický a anestéziologický plán vygenerovaný z AI rádiologickej analýzy (#${analysis.id.slice(0, 8)}).\nHmotnosť pacienta: ${weightKg} kg.\nIndikácia: ${analysis.result?.slice(0, 300)}...${input.customNotes ? `\nPoznámky: ${input.customNotes}` : ""}`,
          status: "active",
          startDate: planDate,
          createdBy: ctx.user.id,
        })
        .returning();

      if (!plan) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Nepodarilo sa vytvoriť liečebný plán" });
      }

      // 6. Vlož kroky do treatmentPlanItems
      const itemsToInsert = [
        {
          planId: plan.id,
          description: "Predoperačná príprava a kanylácia",
          instructions: "Predoperačné zhodnotenie ASA, zavedenie i.v. kanyly do v. cephalica, zahájenie infúzie Ringer-Laktát 5-10 ml/kg/h.",
          sortOrder: 1,
        },
        {
          planId: plan.id,
          description: `Premedikácia (${weightKg} kg)`,
          instructions: anesthesiaSummary.premedication,
          sortOrder: 2,
        },
        {
          planId: plan.id,
          description: "Úvod do anestézie a intubácia",
          instructions: anesthesiaSummary.induction,
          sortOrder: 3,
        },
        {
          planId: plan.id,
          description: `Chirurgický výkon: ${derivedTitle}`,
          instructions: `Vykonanie operačného zákroku podľa aseptických pravidiel. Monitorovanie vitálnych funkcií (${anesthesiaSummary.maintenance}).`,
          sortOrder: 4,
        },
        {
          planId: plan.id,
          description: "Pooperačná analgézia a prebúdzanie",
          instructions: `${anesthesiaSummary.analgesiaPostOp}. Udržiavanie normotermie (výhrevná podložka), kontrola slizníc a CRT.`,
          sortOrder: 5,
        },
        {
          planId: plan.id,
          description: "Pooperačná rádiologická kontrola",
          instructions: "Zhotovenie kontrolnej pooperačnej RTG/USG snímky na overenie repozičného postavenia / úspešnosti výkonu.",
          sortOrder: 6,
        },
      ];

      for (const item of itemsToInsert) {
        await ctx.db.insert(treatmentPlanItems).values(item);
      }

      // 7. Vytvor koncept súhlasu majiteľa v consentRequests
      let consentRequestId: string | null = null;
      let signingToken: string | null = null;
      try {
        const token = randomUUID();
        const tokenHash = createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const [consentReq] = await ctx.db
          .insert(consentRequests)
          .values({
            practiceId: ctx.practiceId,
            patientId: patient.id,
            createdBy: ctx.user.id,
            appointmentId: input.appointmentId ?? analysis.appointmentId ?? null,
            token,
            tokenHash,
            expiresAt,
            title: `Informovaný súhlas s anestéziou a operáciou: ${derivedTitle}`,
            bodyText: `Svojím podpisom potvrdzujem, že som bol/a riadne oboznámený/á so zdravotným stavom pacienta (${patient.name}), s potrebnosťou a rizikami chirurgického zákroku "${derivedTitle}" a celkovej anestézie, ako aj s predpokladanou cenou zákroku. Súhlasím s vykonaním zákroku a podaním potrebných liečiv.`,
            status: "pending",
          })
          .returning({ id: consentRequests.id });

        if (consentReq) {
          consentRequestId = consentReq.id;
          signingToken = token;
        }
      } catch {
        // Consent request creation is best-effort and must not fail imaging.
      }

      // 8. Zisti dostupnú operačnú sálu
      const surgeryRooms = await ctx.db
        .select({ id: rooms.id, name: rooms.name })
        .from(rooms)
        .where(
          and(
            eq(rooms.practiceId, ctx.practiceId),
            isNull(rooms.deletedAt),
            or(
              ilike(rooms.name, "%operač%"),
              ilike(rooms.name, "%sála%"),
              ilike(rooms.name, "%surgery%")
            )
          )
        )
        .limit(3);

      return {
        success: true,
        planId: plan.id,
        planTitle: derivedTitle,
        patientName: patient.name,
        patientWeightKg: weightKg,
        anesthesiaProtocol: anesthesiaSummary,
        consentRequestId,
        signingUrl: signingToken ? `/sign/${signingToken}` : null,
        suggestedRooms: surgeryRooms,
      };
    }),

  /**
   * Vloží nález AI analýzy do SOAP záznamu vizity.
   *
   * Human-in-the-loop: AI findings may only be appended to an *open draft*.
   * A finalized note is immutable from the AI side (PRECONDITION_FAILED); the
   * clinician must use the addendum/replacement workflow. When no draft exists
   * a new draft is created through the shared SOAP lifecycle so the open
   * in-exam visit lock and duplicate-draft invariants apply.
   */
  injectFindingsIntoSoap: imagingProcedure
    .input(
      z.object({
        analysisId: z.string().uuid(),
        appointmentId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [analysis] = await ctx.db
        .select()
        .from(aiImagingAnalyses)
        .where(
          and(
            eq(aiImagingAnalyses.id, input.analysisId),
            eq(aiImagingAnalyses.practiceId, ctx.practiceId),
            isNull(aiImagingAnalyses.deletedAt)
          )
        )
        .limit(1);

      if (!analysis || !analysis.result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Analýza sa nenašla alebo nemá výsledok" });
      }

      const [existingSoap] = await ctx.db
        .select()
        .from(soapNotes)
        .where(
          and(
            eq(soapNotes.appointmentId, input.appointmentId),
            eq(soapNotes.practiceId, ctx.practiceId),
            eq(soapNotes.patientId, analysis.patientId),
            isNull(soapNotes.deletedAt)
          )
        )
        .limit(1);

      const imagingFinding = `[AI Rádiológia (${analysis.imageType.toUpperCase()}) – návrh na overenie lekárom]:\n${analysis.result}`;
      const actor = { id: ctx.user.id, name: ctx.user.name ?? "Veterinárny lekár" };

      try {
        if (existingSoap) {
          assertAiMayWriteToSoapNote(existingSoap);
          const updatedObjective = existingSoap.objective
            ? `${existingSoap.objective}\n\n${imagingFinding}`
            : imagingFinding;

          const result = await ctx.db.transaction((tx) =>
            saveAppointmentSoapDraft(tx as unknown as Database, {
              practiceId: ctx.practiceId,
              patientId: analysis.patientId,
              appointmentId: input.appointmentId,
              noteId: existingSoap.id,
              expectedRevision: existingSoap.revision,
              actor,
              sections: { ...existingSoap, objective: updatedObjective },
            }),
          );
          if (result.outcome !== "saved") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "SOAP draft changed in another session. Refresh and retry.",
            });
          }
          return { success: true, updatedSoapId: result.draft.id, status: result.draft.status };
        }

        const result = await ctx.db.transaction((tx) =>
          saveAppointmentSoapDraft(tx as unknown as Database, {
            practiceId: ctx.practiceId,
            patientId: analysis.patientId,
            appointmentId: input.appointmentId,
            expectedRevision: 0,
            actor,
            sections: { objective: imagingFinding },
          }),
        );
        if (result.outcome !== "saved") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This encounter already has SOAP documentation. Refresh and retry.",
          });
        }
        return { success: true, updatedSoapId: result.draft.id, status: result.draft.status };
      } catch (error) {
        if (error instanceof SoapLifecycleError || error instanceof AiDraftSafetyError) {
          throw new TRPCError({ code: error.code, message: error.message });
        }
        throw error;
      }
    }),

  /** Vypočíta Vertebral Heart Score (VHS) z rádiologických meraní srdca */
  calculateVhs: imagingProcedure
    .input(
      z.object({
        longAxisMm: z.number().positive(),
        shortAxisMm: z.number().positive(),
        t4VertebraLengthMm: z.number().positive(),
        species: z.enum(["canine", "feline"]).default("canine"),
      }),
    )
    .mutation(async ({ input }) => {
      return computeVhs(input);
    }),

  /**
   * Formálne schválenie a potvrdenie rádiologického nálezu veterinárnym lekárom
   * s kryptografickým audit trailom (ext_ai_audit_log).
   */
  confirmAnalysis: imagingProcedure
    .input(
      z.object({
        analysisId: z.string().uuid(),
        clinicianConfirmed: clinicianConfirmationInput,
        finalReport: z.string().min(1).max(50_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertClinicianConfirmed(input.clinicianConfirmed);
      const [analysis] = await ctx.db
        .select()
        .from(aiImagingAnalyses)
        .where(
          and(
            eq(aiImagingAnalyses.id, input.analysisId),
            eq(aiImagingAnalyses.practiceId, ctx.practiceId),
            isNull(aiImagingAnalyses.deletedAt),
          )
        )
        .limit(1);

      if (!analysis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
      }

      const originalAiDraft = analysis.result ?? "";
      const audit = buildAiConfirmationAuditTrail({
        actorId: ctx.user.id,
        actorName: ctx.user.name ?? ctx.user.email ?? "Clinician",
        entityType: "imaging_analysis",
        entityId: analysis.id,
        originalAiDraft,
        finalClinicianContent: input.finalReport,
      });

      // IMPORTANT: audit insert and analysis update execute in the same
      // transaction. If the audit insert fails the update is rolled back —
      // finalization fails closed rather than leaving an un-audited record.
      const updated = await ctx.db.transaction(async (tx) => {
        const db = tx as unknown as Database;
        await db.insert(extAiAuditLog).values({
          practiceId: ctx.practiceId,
          actorId: ctx.user.id,
          actorName: audit.actorName,
          entityType: audit.entityType,
          entityId: audit.entityId,
          originalDraftHash: audit.originalDraftHash,
          confirmedContentHash: audit.confirmedContentHash,
          wasEditedByClinician: audit.wasEditedByClinician,
          confirmedAt: audit.confirmedAt,
        });

        const [updatedAnalysis] = await db
          .update(aiImagingAnalyses)
          .set({
            result: input.finalReport,
            status: "COMPLETED",
            completedAt: new Date(),
          })
          .where(
            and(
              eq(aiImagingAnalyses.id, analysis.id),
              eq(aiImagingAnalyses.practiceId, ctx.practiceId),
            ),
          )
          .returning();

        if (!updatedAnalysis) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Analysis was modified concurrently. Please reload and try again.",
          });
        }
        return updatedAnalysis;
      });

      return {
        success: true,
        analysis: updated,
        auditRecord: {
          originalDraftHash: audit.originalDraftHash,
          confirmedContentHash: audit.confirmedContentHash,
          wasEditedByClinician: audit.wasEditedByClinician,
        },
      };
    }),

  /** Vytvorí anonymizovaný rádiologický kvíz ("Prípad týždňa") pre sociálne siete */
  createMarketingQuizFromImaging: imagingProcedure
    .input(
      z.object({
        analysisId: z.string().uuid(),
        question: z.string().max(500).optional(),
        correctAnswer: z.string().min(1).max(255),
        wrongAnswers: z.array(z.string().min(1).max(255)).min(1).max(4),
        educationalExplanation: z.string().max(2000).optional(),
        channel: z.enum(["instagram", "facebook", "google_business"]).default("instagram"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [analysis] = await ctx.db
        .select({
          id: aiImagingAnalyses.id,
          imageType: aiImagingAnalyses.imageType,
          result: aiImagingAnalyses.result,
          patientId: aiImagingAnalyses.patientId,
        })
        .from(aiImagingAnalyses)
        .where(
          and(
            eq(aiImagingAnalyses.id, input.analysisId),
            eq(aiImagingAnalyses.practiceId, ctx.practiceId),
            isNull(aiImagingAnalyses.deletedAt),
          ),
        )
        .limit(1);

      if (!analysis) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Analysis not found",
        });
      }

      const [practice] = await ctx.db
        .select({ name: practices.name })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);

      const clinicName = practice?.name || "Naša veterinárna klinika";
      const qText = input.question || "Čo odhalila táto rádiologická snímka z našej ambulancie?";

      // Format options for the quiz
      const allOptions = [input.correctAnswer, ...input.wrongAnswers];
      const letters = ["A", "B", "C", "D"];
      const optionsText = allOptions.map((opt, i) => `${letters[i]}) ${opt}`).join("\n");

      const explanation = input.educationalExplanation ||
        `Správna odpoveď je: ${input.correctAnswer}. Včasné vyšetrenie umožňuje zachytiť nález skôr, než dôjde k dekompenzácii.`;

      const title = `Rádiologický kvíz: Prípad z ambulancie (${analysis.imageType.toUpperCase()})`;
      const body =
        `🧠 KVÍZ TÝŽDŇA: Otestujte si svoje znalosti!\n\n` +
        `Pozrite sa na snímku nášho pacienta a tipnite si správnu odpoveď:\n` +
        `❓ ${qText}\n\n` +
        `${optionsText}\n\n` +
        `👇 Napíšte nám váš tip do komentára! Správnu odpoveď a vysvetlenie nájdete v komentári alebo v našom ďalšom príbehu.\n\n` +
        `💡 ${explanation}\n\n` +
        `Zdravie vašich miláčikov chránime v ${clinicName}.\n` +
        `#veterinarnykviz #radiologia #rtg #veterinar #starostlivostozvierata`;

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
