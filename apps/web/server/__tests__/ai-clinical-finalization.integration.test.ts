import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { and, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../../../../packages/db/schema/index";
import { appRouter } from "../routers/_app";
import { appendAiAuditEvent } from "@/lib/ai/audit-ledger";
import {
  verifyAiAuditChain,
  type AuditLogDbRow,
} from "@/lib/ai/audit-chain";
import { issueClinicianConfirmation } from "@/lib/ai/clinician-confirmation";
import { generateContentHash } from "@/lib/ai/draft-safety";

vi.mock("@/lib/audit", () => ({
  recordAuditLog: vi.fn(async () => undefined),
}));
vi.mock("@/lib/webhook-dispatcher", () => ({
  dispatchWebhookEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/marketing/messaging", () => ({
  schedulePostopCheckIn: vi.fn(async () => undefined),
  applySympathyGate: vi.fn(async () => ({ blocked: 0 })),
  detectAndTriggerDentalRecall: vi.fn(async () => true),
  checkAndTriggerSeniorMilestone: vi.fn(async () => true),
}));

const { dispatchWebhookEvent } = await import("@/lib/webhook-dispatcher");
const { schedulePostopCheckIn } = await import("@/lib/marketing/messaging");

const repoRoot = resolve(process.cwd(), "../..");
const describeWithAiFinalizationPostgres =
  process.env.AI_FINALIZATION_DB_INTEGRATION === "1" ? describe : describe.skip;

type Fixtures = {
  adminSql: ReturnType<typeof postgres>;
  ownerSql: ReturnType<typeof postgres>;
  appSql: ReturnType<typeof postgres>;
  raceSqlA: ReturnType<typeof postgres>;
  raceSqlB: ReturnType<typeof postgres>;
  databaseName: string;
  databaseUrl: string;
  practiceA: string;
  practiceB: string;
  vetA: string;
  vetB: string;
  frontDeskA: string;
  clientA: string;
  patientA: string;
  appointmentA: string;
  fileA: string;
};

let fx: Fixtures | undefined;

function sessionFor(userId: string, role: string, practiceId: string) {
  return {
    user: {
      id: userId,
      email: `synthetic-${role}@example.invalid`,
      name: `Synthetic ${role}`,
      role,
      practiceId,
    },
  } as never;
}

function callerFor(
  db: ReturnType<typeof drizzle<typeof schema>>,
  userId: string,
  role: string,
  practiceId: string,
) {
  return appRouter.createCaller({
    db,
    session: sessionFor(userId, role, practiceId),
  } as never);
}

describeWithAiFinalizationPostgres(
  "AI clinical finalization PostgreSQL contract (real DB, real RLS, real locks)",
  () => {
    beforeAll(async () => {
      const adminUrl = process.env.DATABASE_URL;
      if (!adminUrl) throw new Error("DATABASE_URL is required");

      const databaseName = `openpims_ai_finalize_${randomUUID().replaceAll("-", "")}`;
      if (!/^openpims_ai_finalize_[a-f0-9]+$/.test(databaseName)) {
        throw new Error("unsafe disposable database name");
      }

      const databaseUrl = new URL(adminUrl);
      databaseUrl.pathname = `/${databaseName}`;
      databaseUrl.search = "";
      databaseUrl.hash = "";

      const appUrl = new URL(databaseUrl);
      appUrl.username = "openpims_app";
      appUrl.password =
        process.env.OPENPIMS_APP_DB_PASSWORD?.trim() || "openpims_app";

      const adminSql = postgres(adminUrl, { max: 1 });
      await adminSql.unsafe(`create database "${databaseName}"`);

      execFileSync("pnpm", ["--filter", "@openpims/db", "db:migrate"], {
        cwd: repoRoot,
        env: { ...process.env, DATABASE_URL: databaseUrl.toString() },
        encoding: "utf8",
        timeout: 120_000,
      });
      execFileSync("pnpm", ["--filter", "@openpims/db", "db:rls"], {
        cwd: repoRoot,
        env: { ...process.env, DATABASE_URL: databaseUrl.toString() },
        encoding: "utf8",
        timeout: 120_000,
      });

      const ownerSql = postgres(databaseUrl.toString(), { max: 1 });
      const appSql = postgres(appUrl.toString(), { max: 5 });
      const raceSqlA = postgres(appUrl.toString(), { max: 1 });
      const raceSqlB = postgres(appUrl.toString(), { max: 1 });
      const ownerDb = drizzle(ownerSql, { schema });

      const [practiceA] = await ownerDb
        .insert(schema.practices)
        .values({ name: "Synthetic Finalization Clinic A" })
        .returning({ id: schema.practices.id });
      const [practiceB] = await ownerDb
        .insert(schema.practices)
        .values({ name: "Synthetic Finalization Clinic B" })
        .returning({ id: schema.practices.id });
      if (!practiceA || !practiceB) throw new Error("failed to seed practices");

      const users = await ownerDb
        .insert(schema.users)
        .values([
          {
            practiceId: practiceA.id,
            email: "synthetic-vet-a@example.invalid",
            passwordHash: "not-a-real-password-hash",
            name: "Synthetic Vet A",
            role: "veterinarian",
            emailVerifiedAt: new Date(),
          },
          {
            practiceId: practiceB.id,
            email: "synthetic-vet-b@example.invalid",
            passwordHash: "not-a-real-password-hash",
            name: "Synthetic Vet B",
            role: "veterinarian",
            emailVerifiedAt: new Date(),
          },
          {
            practiceId: practiceA.id,
            email: "synthetic-frontdesk-a@example.invalid",
            passwordHash: "not-a-real-password-hash",
            name: "Synthetic Front Desk A",
            role: "front_desk",
            emailVerifiedAt: new Date(),
          },
        ])
        .returning({ id: schema.users.id });
      const [vetA, vetB, frontDeskA] = users;
      if (!vetA || !vetB || !frontDeskA) throw new Error("failed to seed users");

      const [locationA] = await ownerDb
        .insert(schema.locations)
        .values({
          practiceId: practiceA.id,
          name: "Synthetic Finalization Clinic",
          isPrimary: true,
        })
        .returning({ id: schema.locations.id });
      if (!locationA) throw new Error("failed to seed location");

      const [clientA] = await ownerDb
        .insert(schema.clients)
        .values({
          practiceId: practiceA.id,
          firstName: "Synthetic",
          lastName: "Owner",
        })
        .returning({ id: schema.clients.id });
      if (!clientA) throw new Error("failed to seed client");

      const [patientA] = await ownerDb
        .insert(schema.patients)
        .values({
          practiceId: practiceA.id,
          clientId: clientA.id,
          name: "Synthetic Patient",
          species: "canine",
        })
        .returning({ id: schema.patients.id });
      if (!patientA) throw new Error("failed to seed patient");

      const now = new Date();
      const [appointmentA] = await ownerDb
        .insert(schema.appointments)
        .values({
          practiceId: practiceA.id,
          locationId: locationA.id,
          patientId: patientA.id,
          clientId: clientA.id,
          doctorId: vetA.id,
          startTime: now,
          endTime: new Date(now.getTime() + 30 * 60_000),
          status: "in_exam",
        })
        .returning({ id: schema.appointments.id });
      if (!appointmentA) throw new Error("failed to seed appointment");

      const fileKeyA = `${practiceA.id}/imaging/synthetic-xray.dcm`;
      const [fileA] = await ownerDb
        .insert(schema.files)
        .values({
          practiceId: practiceA.id,
          uploadedBy: vetA.id,
          fileName: "synthetic-xray.dcm",
          fileKey: fileKeyA,
          fileUrl: `/api/files/${fileKeyA}`,
          mimeType: "application/dicom",
          category: "imaging",
          patientId: patientA.id,
        })
        .returning({ id: schema.files.id });
      if (!fileA) throw new Error("failed to seed file");

      fx = {
        adminSql,
        ownerSql,
        appSql,
        raceSqlA,
        raceSqlB,
        databaseName,
        databaseUrl: databaseUrl.toString(),
        practiceA: practiceA.id,
        practiceB: practiceB.id,
        vetA: vetA.id,
        vetB: vetB.id,
        frontDeskA: frontDeskA.id,
        clientA: clientA.id,
        patientA: patientA.id,
        appointmentA: appointmentA.id,
        fileA: fileA.id,
      };
    }, 300_000);

    afterAll(async () => {
      if (!fx) return;
      const { adminSql, ownerSql, appSql, raceSqlA, raceSqlB, databaseName } =
        fx;
      await ownerSql.end().catch(() => {});
      await appSql.end().catch(() => {});
      await raceSqlA.end().catch(() => {});
      await raceSqlB.end().catch(() => {});
      await adminSql
        .unsafe(`drop database if exists "${databaseName}" with (force)`)
        .catch(() => {});
      await adminSql.end().catch(() => {});
      fx = undefined;
    }, 120_000);

    function f(): Fixtures {
      if (!fx) throw new Error("fixtures not initialized");
      return fx;
    }

    function ownerDb() {
      return drizzle(f().ownerSql, { schema });
    }

    function appDb() {
      return drizzle(f().appSql, { schema });
    }

    async function seedAnalysis(input?: {
      practiceId?: string;
      result?: string;
      status?: "PENDING" | "COMPLETED";
    }) {
      const { practiceA, patientA, fileA, vetA } = f();
      const [row] = await ownerDb()
        .insert(schema.aiImagingAnalyses)
        .values({
          practiceId: input?.practiceId ?? practiceA,
          patientId: patientA,
          fileId: fileA,
          requestedBy: vetA,
          modelId: "synthetic-test-model",
          imageType: "xray",
          result: input?.result ?? "Synthetic AI draft findings.",
          status: input?.status ?? "PENDING",
          revision: 0,
        })
        .returning();
      if (!row) throw new Error("failed to seed analysis");
      return row;
    }

    async function seedDictation(input?: {
      appointmentId?: string;
      revision?: number;
    }) {
      const { practiceA, patientA, appointmentA, vetA } = f();
      const [row] = await ownerDb()
        .insert(schema.voiceDictations)
        .values({
          practiceId: practiceA,
          patientId: patientA,
          appointmentId: input?.appointmentId ?? appointmentA,
          dictatedBy: vetA,
          modelId: "synthetic-test-model",
          status: "COMPLETED",
          subjective: "Synthetic subjective.",
          objective: "Synthetic objective.",
          assessment: "Synthetic assessment.",
          plan: "Synthetic plan.",
          revision: input?.revision ?? 0,
        })
        .returning();
      if (!row) throw new Error("failed to seed dictation");
      return row;
    }

    async function seedAppointment(status: "in_exam" | "scheduled" = "in_exam") {
      const { practiceA, patientA, clientA, vetA } = f();
      const [location] = await ownerDb()
        .select({ id: schema.locations.id })
        .from(schema.locations)
        .where(eq(schema.locations.practiceId, practiceA))
        .limit(1);
      if (!location) throw new Error("location fixture missing");
      const now = new Date();
      const [row] = await ownerDb()
        .insert(schema.appointments)
        .values({
          practiceId: practiceA,
          locationId: location.id,
          patientId: patientA,
          clientId: clientA,
          doctorId: vetA,
          startTime: now,
          endTime: new Date(now.getTime() + 30 * 60_000),
          status,
        })
        .returning();
      if (!row) throw new Error("failed to seed appointment");
      return row;
    }

    async function readAuditChain(practiceId: string): Promise<AuditLogDbRow[]> {
      const rows = await ownerDb()
        .select()
        .from(schema.extAiAuditLog)
        .where(eq(schema.extAiAuditLog.practiceId, practiceId));
      return rows.map((r) => ({
        id: r.id,
        practiceId: r.practiceId,
        sequenceNumber: r.sequenceNumber,
        actorId: r.actorId,
        actorRole: r.actorRole,
        entityType: r.entityType,
        entityId: r.entityId,
        actionType: r.actionType,
        originalDraftHash: r.originalDraftHash,
        confirmedContentHash: r.confirmedContentHash,
        wasEditedByClinician: r.wasEditedByClinician,
        confirmedAt: r.confirmedAt,
        previousEventHash: r.previousEventHash,
        eventHash: r.eventHash,
        canonicalizationVersion: r.canonicalizationVersion,
      }));
    }

    it(
      "imaging prepare→finalize happy path appends a verifiable genesis audit event",
      async () => {
        const { practiceA, vetA } = f();
        const analysis = await seedAnalysis();
        const caller = callerFor(appDb(), vetA, "veterinarian", practiceA);

        const finalReport = "Synthetic confirmed radiological findings.";
        const prepared = await caller.extensions.imaging.prepareConfirmation({
          analysisId: analysis.id,
          finalReport,
        });
        expect(prepared.expectedRevision).toBe(0);

        const confirmed = await caller.extensions.imaging.confirmAnalysis({
          analysisId: analysis.id,
          expectedRevision: prepared.expectedRevision,
          clinicianConfirmed: { confirmationId: prepared.confirmationId },
          finalReport,
        });
        expect(confirmed.success).toBe(true);
        expect(confirmed.analysis.status).toBe("COMPLETED");
        expect(confirmed.analysis.revision).toBe(1);
        expect(confirmed.auditRecord.sequenceNumber).toBe(1);
        expect(confirmed.auditRecord.previousEventHash).toBeNull();

        const chain = await readAuditChain(practiceA);
        expect(chain).toHaveLength(1);
        expect(chain[0]).toMatchObject({
          sequenceNumber: 1,
          previousEventHash: null,
          entityType: "imaging_analysis",
          entityId: analysis.id,
          actionType: "imaging_confirmed",
          actorRole: "veterinarian",
        });
        const verification = verifyAiAuditChain(chain);
        expect(verification.ok).toBe(true);
        expect(verification.totalEvents).toBe(1);
      },
      120_000,
    );

    it(
      "voice prepare→finalize chains sequence 2 onto the same practice ledger",
      async () => {
        const { practiceA, vetA } = f();
        const freshAppointment = await seedAppointment();
        const dictation = await seedDictation({
          appointmentId: freshAppointment.id,
        });
        const caller = callerFor(appDb(), vetA, "veterinarian", practiceA);

        const sections = {
          subjective: "Synthetic subjective.",
          objective: "Synthetic objective.",
          assessment: "Synthetic assessment.",
          plan: "Synthetic plan, confirmed.",
        };
        const prepared = await caller.extensions.voice.prepareConfirmation({
          dictationId: dictation.id,
          ...sections,
        });
        expect(prepared.expectedRevision).toBe(0);

        const saved = await caller.extensions.voice.saveAsSoapNote({
          dictationId: dictation.id,
          expectedRevision: prepared.expectedRevision,
          ...sections,
          clinicianConfirmed: { confirmationId: prepared.confirmationId },
        });
        expect(saved.status).toBe("finalized");

        const [updatedDictation] = await ownerDb()
          .select()
          .from(schema.voiceDictations)
          .where(eq(schema.voiceDictations.id, dictation.id))
          .limit(1);
        expect(updatedDictation?.soapNoteId).toBe(saved.id);

        const chain = await readAuditChain(practiceA);
        expect(chain).toHaveLength(2);
        const verification = verifyAiAuditChain(chain);
        expect(verification.ok).toBe(true);
        const seq2 = chain.find((e) => e.sequenceNumber === 2);
        expect(seq2).toMatchObject({
          entityType: "soap_note",
          actionType: "soap_note_finalized",
        });
        expect(seq2?.previousEventHash).toBe(
          chain.find((e) => e.sequenceNumber === 1)?.eventHash,
        );
      },
      120_000,
    );

    it(
      "replay of a consumed confirmation fails and appends no second audit event",
      async () => {
        const { practiceA, vetA } = f();
        const analysis = await seedAnalysis();
        const caller = callerFor(appDb(), vetA, "veterinarian", practiceA);
        const finalReport = "Synthetic confirmed findings for replay test.";

        const prepared = await caller.extensions.imaging.prepareConfirmation({
          analysisId: analysis.id,
          finalReport,
        });
        await caller.extensions.imaging.confirmAnalysis({
          analysisId: analysis.id,
          expectedRevision: prepared.expectedRevision,
          clinicianConfirmed: { confirmationId: prepared.confirmationId },
          finalReport,
        });

        const before = await readAuditChain(practiceA);

        // True replay: the same envelope against the same entity fails because
        // the entity is already finalized (checked before consume).
        await expect(
          caller.extensions.imaging.confirmAnalysis({
            analysisId: analysis.id,
            expectedRevision: prepared.expectedRevision,
            clinicianConfirmed: { confirmationId: prepared.confirmationId },
            finalReport,
          }),
        ).rejects.toMatchObject({
          code: "CONFLICT",
          message: "Analysis is already finalized.",
        });

        // Cross-entity reuse: the same envelope against a DIFFERENT entity
        // fails with entity-mismatch (PRECONDITION_FAILED), never by
        // finalizing the wrong record.
        const analysis2 = await seedAnalysis();
        await expect(
          caller.extensions.imaging.confirmAnalysis({
            analysisId: analysis2.id,
            expectedRevision: 0,
            clinicianConfirmed: { confirmationId: prepared.confirmationId },
            finalReport,
          }),
        ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

        const after = await readAuditChain(practiceA);
        expect(after.length).toBe(before.length);
        expect(verifyAiAuditChain(after).ok).toBe(true);
      },
      120_000,
    );

    it(
      "expired confirmation fails with CONFLICT and leaves no audit trace",
      async () => {
        const { practiceA, vetA } = f();
        const analysis = await seedAnalysis();
        const finalReport = "Synthetic confirmed findings for expiry test.";
        const envelope = await issueClinicianConfirmation(
          ownerDb() as never,
          {
            practiceId: practiceA,
            actorId: vetA,
            actorRole: "veterinarian",
            actionType: "imaging_confirmed",
            entityType: "imaging_analysis",
            entityId: analysis.id,
            expectedRevision: 0,
            originalDraftHash: generateContentHash(analysis.result ?? ""),
            confirmedContentHash: generateContentHash(finalReport),
            ttlSeconds: -60,
          },
        );
        expect(envelope.expiresAt.getTime()).toBeLessThan(Date.now());

        const caller = callerFor(appDb(), vetA, "veterinarian", practiceA);
        const before = await readAuditChain(practiceA);
        await expect(
          caller.extensions.imaging.confirmAnalysis({
            analysisId: analysis.id,
            expectedRevision: 0,
            clinicianConfirmed: { confirmationId: envelope.id },
            finalReport,
          }),
        ).rejects.toMatchObject({ code: "CONFLICT" });

        const after = await readAuditChain(practiceA);
        expect(after.length).toBe(before.length);
      },
      120_000,
    );

    it(
      "cross-tenant finalize fails and RLS hides the foreign row from openpims_app",
      async () => {
        const { practiceA, practiceB, vetB } = f();
        const analysis = await seedAnalysis();
        const callerB = callerFor(appDb(), vetB, "veterinarian", practiceB);

        await expect(
          callerB.extensions.imaging.prepareConfirmation({
            analysisId: analysis.id,
            finalReport: "Cross-tenant attempt.",
          }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });

        // Defense-in-depth: the RLS policy itself hides practice-A rows when
        // the session context is practice B.
        await f().appSql.begin(async (txSql) => {
          await txSql`select set_config('app.current_practice_id', ${practiceB}, true)`;
          const foreign = await txSql`
            select id from ai_imaging_analyses
            where id = ${analysis.id} and deleted_at is null
          `;
          expect(foreign).toHaveLength(0);
        });
        await f().appSql.begin(async (txSql) => {
          await txSql`select set_config('app.current_practice_id', ${practiceA}, true)`;
          const own = await txSql`
            select id from ai_imaging_analyses
            where id = ${analysis.id} and deleted_at is null
          `;
          expect(own).toHaveLength(1);
        });
      },
      120_000,
    );

    it(
      "front-desk role cannot prepare or consume clinical confirmations",
      async () => {
        const { practiceA, frontDeskA } = f();
        const analysis = await seedAnalysis();
        const caller = callerFor(appDb(), frontDeskA, "front_desk", practiceA);

        await expect(
          caller.extensions.imaging.prepareConfirmation({
            analysisId: analysis.id,
            finalReport: "Front desk attempt.",
          }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      },
      120_000,
    );

    it(
      "bare boolean confirmation and missing revision fail closed",
      async () => {
        const { practiceA, vetA } = f();
        const analysis = await seedAnalysis();
        const caller = callerFor(appDb(), vetA, "veterinarian", practiceA);
        const finalReport = "Synthetic confirmed findings.";

        await expect(
          caller.extensions.imaging.confirmAnalysis({
            analysisId: analysis.id,
            expectedRevision: 0,
            clinicianConfirmed: true,
            finalReport,
          }),
        ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

        const prepared = await caller.extensions.imaging.prepareConfirmation({
          analysisId: analysis.id,
          finalReport,
        });
        await expect(
          caller.extensions.imaging.confirmAnalysis({
            analysisId: analysis.id,
            clinicianConfirmed: { confirmationId: prepared.confirmationId },
            finalReport,
          }),
        ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      },
      120_000,
    );

    it(
      "concurrent finalization with one envelope: exactly one wins, audit stays valid",
      async () => {
        const { practiceA, vetA } = f();
        const analysis = await seedAnalysis();
        const caller = callerFor(appDb(), vetA, "veterinarian", practiceA);
        const finalReport = "Synthetic concurrent finalization.";

        const prepared = await caller.extensions.imaging.prepareConfirmation({
          analysisId: analysis.id,
          finalReport,
        });
        const input = {
          analysisId: analysis.id,
          expectedRevision: prepared.expectedRevision,
          clinicianConfirmed: { confirmationId: prepared.confirmationId },
          finalReport,
        };
        const raceA = callerFor(
          drizzle(f().raceSqlA, { schema }),
          vetA,
          "veterinarian",
          practiceA,
        );
        const raceB = callerFor(
          drizzle(f().raceSqlB, { schema }),
          vetA,
          "veterinarian",
          practiceA,
        );

        const before = await readAuditChain(practiceA);
        const results = await Promise.allSettled([
          raceA.extensions.imaging.confirmAnalysis(input),
          raceB.extensions.imaging.confirmAnalysis(input),
        ]);
        const fulfilled = results.filter((r) => r.status === "fulfilled");
        const rejected = results.filter((r) => r.status === "rejected");
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(rejected[0]).toMatchObject({
          reason: { code: "CONFLICT" },
        });

        const after = await readAuditChain(practiceA);
        expect(after.length).toBe(before.length + 1);
        expect(verifyAiAuditChain(after).ok).toBe(true);

        const [envelope] = await ownerDb()
          .select()
          .from(schema.extClinicianConfirmations)
          .where(eq(schema.extClinicianConfirmations.id, prepared.confirmationId))
          .limit(1);
        expect(envelope?.status).toBe("CONSUMED");
      },
      180_000,
    );

    it(
      "concurrent audit appends serialize: distinct sequences, single chain, no fork",
      async () => {
        const { practiceB, vetB } = f();
        const dbA = drizzle(f().raceSqlA, { schema });
        const dbB = drizzle(f().raceSqlB, { schema });
        const draftHash = generateContentHash("synthetic concurrent draft");
        const finalHash = generateContentHash("synthetic concurrent final");

        // Direct service calls run as openpims_app, so each transaction must
        // establish the tenant GUC exactly like withTenant() does inside the
        // routers; otherwise RLS (not the ledger logic) rejects the insert.
        const append = (db: typeof dbA, entityId: string) =>
          db.transaction(async (tx) => {
            await tx.execute(
              sql`select set_config('app.current_practice_id', ${practiceB}, true)`,
            );
            return appendAiAuditEvent(tx as never, {
              practiceId: practiceB,
              actorId: vetB,
              actorName: "Synthetic Vet B",
              actorRole: "veterinarian",
              entityType: "imaging_analysis",
              entityId,
              actionType: "imaging_confirmed",
              originalDraftHash: draftHash,
              confirmedContentHash: finalHash,
            });
          });

        const [r1, r2] = await Promise.all([
          append(dbA, randomUUID()),
          append(dbB, randomUUID()),
        ]);
        const sequences = [r1.sequenceNumber, r2.sequenceNumber].sort();
        expect(sequences).toEqual([1, 2]);

        const chain = await readAuditChain(practiceB);
        expect(chain).toHaveLength(2);
        const verification = verifyAiAuditChain(chain);
        expect(verification.ok).toBe(true);
      },
      180_000,
    );

    it(
      "unique (practice_id, sequence_number) constraint rejects duplicates",
      async () => {
        // Self-sufficient: seed one ledger row, then collide with it. (Does
        // not depend on any other test's fixtures or on file execution order.)
        const { practiceB, vetB } = f();
        const seeded = await ownerDb().transaction((tx) =>
          appendAiAuditEvent(tx as never, {
            practiceId: practiceB,
            actorId: vetB,
            actorName: "Synthetic Vet B",
            actorRole: "veterinarian",
            entityType: "imaging_analysis",
            entityId: randomUUID(),
            actionType: "imaging_confirmed",
            originalDraftHash: generateContentHash("unique-seed-draft"),
            confirmedContentHash: generateContentHash("unique-seed-final"),
          }),
        );

        // Drizzle wraps the PostgreSQL error: the SQLSTATE lives on `cause`.
        const failure = (await ownerDb()
          .insert(schema.extAiAuditLog)
          .values({
            practiceId: practiceB,
            actorId: vetB,
            actorName: "Synthetic Vet B",
            actorRole: "veterinarian",
            entityType: "imaging_analysis",
            entityId: randomUUID(),
            actionType: "imaging_confirmed",
            originalDraftHash: generateContentHash("dup"),
            confirmedContentHash: generateContentHash("dup"),
            wasEditedByClinician: false,
            confirmedAt: new Date(),
            sequenceNumber: seeded.sequenceNumber,
            previousEventHash: seeded.previousEventHash,
            eventHash: generateContentHash(`dup-${Date.now()}`),
            canonicalizationVersion: 1,
          })
          .then(
            () => null,
            (error: unknown) => error,
          )) as { cause?: unknown } | null;
        expect(
          failure,
          "duplicate (practice_id, sequence_number) insert was expected to fail",
        ).not.toBeNull();
        expect(failure?.cause).toMatchObject({ code: "23505" });
      },
      120_000,
    );

    it(
      "pg_advisory_xact_lock serializes two independent connections",
      async () => {
        const lockKey = `ai_finalize_probe:${randomUUID()}`;
        const connA = await f().raceSqlA.reserve();
        const connB = await f().raceSqlB.reserve();
        try {
          await connA`begin`;
          await connA`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
          const whileHeld =
            await connB`select pg_try_advisory_xact_lock(hashtextextended(${lockKey}, 0)) as acquired`;
          expect(whileHeld[0]?.acquired).toBe(false);
          await connA`commit`;
          const afterCommit =
            await connB`select pg_try_advisory_xact_lock(hashtextextended(${lockKey}, 0)) as acquired`;
          expect(afterCommit[0]?.acquired).toBe(true);
        } finally {
          await connA`rollback`.catch(() => {});
          connA.release();
          connB.release();
        }
      },
      120_000,
    );

    it(
      "tampered payload rolls back confirmation consumption and appends nothing",
      async () => {
        const { practiceA, vetA } = f();
        const analysis = await seedAnalysis();
        const caller = callerFor(appDb(), vetA, "veterinarian", practiceA);
        const finalReport = "Synthetic confirmed findings.";

        const prepared = await caller.extensions.imaging.prepareConfirmation({
          analysisId: analysis.id,
          finalReport,
        });
        const before = await readAuditChain(practiceA);
        await expect(
          caller.extensions.imaging.confirmAnalysis({
            analysisId: analysis.id,
            expectedRevision: prepared.expectedRevision,
            clinicianConfirmed: { confirmationId: prepared.confirmationId },
            finalReport: "Tampered findings after review.",
          }),
        ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

        const [envelope] = await ownerDb()
          .select()
          .from(schema.extClinicianConfirmations)
          .where(eq(schema.extClinicianConfirmations.id, prepared.confirmationId))
          .limit(1);
        expect(envelope?.status).toBe("PENDING");

        const [stillPending] = await ownerDb()
          .select()
          .from(schema.aiImagingAnalyses)
          .where(eq(schema.aiImagingAnalyses.id, analysis.id))
          .limit(1);
        expect(stillPending?.status).toBe("PENDING");

        const after = await readAuditChain(practiceA);
        expect(after.length).toBe(before.length);
      },
      120_000,
    );

    it(
      "finalized analysis cannot be overwritten; stale second envelope conflicts",
      async () => {
        const { practiceA, vetA } = f();
        const analysis = await seedAnalysis();
        const caller = callerFor(appDb(), vetA, "veterinarian", practiceA);
        const finalReport = "Synthetic confirmed findings.";

        const prepared = await caller.extensions.imaging.prepareConfirmation({
          analysisId: analysis.id,
          finalReport,
        });
        await caller.extensions.imaging.confirmAnalysis({
          analysisId: analysis.id,
          expectedRevision: prepared.expectedRevision,
          clinicianConfirmed: { confirmationId: prepared.confirmationId },
          finalReport,
        });

        await expect(
          caller.extensions.imaging.prepareConfirmation({
            analysisId: analysis.id,
            finalReport,
          }),
        ).rejects.toMatchObject({ code: "CONFLICT" });

        const stale = await issueClinicianConfirmation(ownerDb() as never, {
          practiceId: practiceA,
          actorId: vetA,
          actorRole: "veterinarian",
          actionType: "imaging_confirmed",
          entityType: "imaging_analysis",
          entityId: analysis.id,
          expectedRevision: 0,
          originalDraftHash: generateContentHash(analysis.result ?? ""),
          confirmedContentHash: generateContentHash(finalReport),
        });
        await expect(
          caller.extensions.imaging.confirmAnalysis({
            analysisId: analysis.id,
            expectedRevision: 0,
            clinicianConfirmed: { confirmationId: stale.id },
            finalReport,
          }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
      },
      120_000,
    );

    it(
      "audit ledger is immutable: app role denied, owner trigger raises, confirmations undeletable",
      async () => {
        // Self-sufficient: seed our own ledger row + our own envelope, so this
        // test never depends on other tests' fixtures or on file order.
        const { practiceA, vetA } = f();
        const seeded = await ownerDb().transaction((tx) =>
          appendAiAuditEvent(tx as never, {
            practiceId: practiceA,
            actorId: vetA,
            actorName: "Synthetic Vet A",
            actorRole: "veterinarian",
            entityType: "imaging_analysis",
            entityId: randomUUID(),
            actionType: "imaging_confirmed",
            originalDraftHash: generateContentHash("immutability-seed-draft"),
            confirmedContentHash: generateContentHash("immutability-seed-final"),
          }),
        );
        const targetId = seeded.row.id;
        const seededEnvelope = await issueClinicianConfirmation(
          ownerDb() as never,
          {
            practiceId: practiceA,
            actorId: vetA,
            actorRole: "veterinarian",
            actionType: "imaging_confirmed",
            entityType: "imaging_analysis",
            entityId: randomUUID(),
            expectedRevision: 0,
            originalDraftHash: generateContentHash("immutability-env-draft"),
            confirmedContentHash: generateContentHash("immutability-env-final"),
          },
        );

        // Each negative probe runs on a reserved app-role connection OUTSIDE
        // an explicit transaction (implicit per-statement transactions), with
        // a session-level tenant GUC that is always RESET before release. A
        // deliberately failing statement must never poison pooled
        // connections, and the GUC proves the denial comes from GRANTS (row
        // is RLS-visible) rather than from RLS filtering.
        async function expectAppDenied(
          probe: (conn: Sql) => Promise<unknown>,
          expectedCode: string,
        ) {
          const conn = await f().appSql.reserve();
          try {
            await conn`select set_config('app.current_practice_id', ${practiceA}, false)`;
            try {
              const failure = (await probe(conn).then(
                () => null,
                (error: unknown) => error,
              )) as { code?: unknown } | null;
              expect(
                failure,
                "probe was expected to be denied but succeeded",
              ).not.toBeNull();
              expect(failure).toMatchObject({ code: expectedCode });
            } finally {
              await conn`reset app.current_practice_id`.catch(() => {});
            }
          } finally {
            conn.release();
          }
        }

        // Row is RLS-visible to the app role under the practice-A context…
        {
          const conn = await f().appSql.reserve();
          try {
            await conn`select set_config('app.current_practice_id', ${practiceA}, false)`;
            const visible = await conn`
              select id from ext_ai_audit_log where id = ${targetId}
            `;
            expect(visible).toHaveLength(1);
            await conn`reset app.current_practice_id`.catch(() => {});
          } finally {
            conn.release();
          }
        }

        // …yet UPDATE/DELETE are denied at grant level (42501).
        await expectAppDenied(
          (conn) =>
            conn`update ext_ai_audit_log set actor_name = 'tampered' where id = ${targetId}`,
          "42501",
        );
        await expectAppDenied(
          (conn) => conn`delete from ext_ai_audit_log where id = ${targetId}`,
          "42501",
        );
        await expectAppDenied(
          (conn) =>
            conn`delete from ext_clinician_confirmations where id = ${seededEnvelope.id}`,
          "42501",
        );

        // Table owner: the immutability trigger raises (55000) even though
        // owner grants allow the write. Each probe is implicitly rolled back.
        const ownerUpdateFailure = (await f()
          .ownerSql`update ext_ai_audit_log set actor_name = 'tampered' where id = ${targetId}`
          .then(
            () => null,
            (error: unknown) => error,
          )) as { code?: unknown } | null;
        expect(ownerUpdateFailure).toMatchObject({ code: "55000" });
        const ownerDeleteFailure = (await f()
          .ownerSql`delete from ext_ai_audit_log where id = ${targetId}`
          .then(
            () => null,
            (error: unknown) => error,
          )) as { code?: unknown } | null;
        expect(ownerDeleteFailure).toMatchObject({ code: "55000" });

        const [untouched] = await ownerDb()
          .select()
          .from(schema.extAiAuditLog)
          .where(eq(schema.extAiAuditLog.id, targetId))
          .limit(1);
        expect(untouched?.actorName).not.toBe("tampered");
        const [envelopeIntact] = await ownerDb()
          .select()
          .from(schema.extClinicianConfirmations)
          .where(eq(schema.extClinicianConfirmations.id, seededEnvelope.id))
          .limit(1);
        expect(envelopeIntact?.status).toBe("PENDING");
      },
      120_000,
    );

    it(
      "discharge side effects fire once after commit — never on failed finalization",
      async () => {
        const { practiceA, patientA, vetA } = f();
        vi.mocked(dispatchWebhookEvent).mockClear();
        vi.mocked(schedulePostopCheckIn).mockClear();
        const caller = callerFor(appDb(), vetA, "veterinarian", practiceA);

        const draftInput = {
          patientId: patientA,
          petName: "Synthetic Patient",
          diagnosis: "Synthetic diagnosis.",
          treatment: "Synthetic treatment.",
          followUp: "Synthetic follow-up.",
          reportText: "Synthetic discharge instructions.",
        };
        const prepared = await caller.extensions.discharge.prepareConfirmation(
          draftInput,
        );
        expect(prepared.reportId).toBeDefined();

        const saved = await caller.extensions.discharge.save({
          id: prepared.reportId,
          expectedRevision: prepared.expectedRevision,
          ...draftInput,
          language: "sk",
          status: "finalized",
          clinicianConfirmed: { confirmationId: prepared.confirmationId },
        });
        expect(saved.status).toBe("finalized");

        expect(dispatchWebhookEvent).toHaveBeenCalledTimes(1);
        expect(dispatchWebhookEvent).toHaveBeenCalledWith(
          practiceA,
          "discharge_report.finalized",
          expect.objectContaining({ reportId: prepared.reportId }),
        );
        expect(schedulePostopCheckIn).toHaveBeenCalledTimes(1);

        // A failed finalization (stale revision on a second draft) must not
        // emit anything: side effects run strictly after durable commit.
        const prepared2 = await caller.extensions.discharge.prepareConfirmation(
          { ...draftInput, reportText: "Second synthetic instructions." },
        );
        await expect(
          caller.extensions.discharge.save({
            id: prepared2.reportId,
            expectedRevision: prepared2.expectedRevision + 99,
            ...draftInput,
            reportText: "Second synthetic instructions.",
            language: "sk",
            status: "finalized",
            clinicianConfirmed: { confirmationId: prepared2.confirmationId },
          }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
        expect(dispatchWebhookEvent).toHaveBeenCalledTimes(1);
        expect(schedulePostopCheckIn).toHaveBeenCalledTimes(1);

        const chain = await readAuditChain(practiceA);
        expect(verifyAiAuditChain(chain).ok).toBe(true);
      },
      180_000,
    );

    it(
      "stale discharge revision on an updated draft conflicts without consuming",
      async () => {
        const { practiceA, patientA, vetA } = f();
        const caller = callerFor(appDb(), vetA, "veterinarian", practiceA);
        const draftInput = {
          patientId: patientA,
          petName: "Synthetic Patient",
          diagnosis: "Synthetic diagnosis.",
          reportText: "Synthetic instructions v1.",
        };
        const prepared = await caller.extensions.discharge.prepareConfirmation(
          draftInput,
        );

        // First update the draft (revision 0 -> 1) as a plain draft edit.
        const updated = await caller.extensions.discharge.save({
          id: prepared.reportId,
          expectedRevision: 0,
          ...draftInput,
          reportText: "Synthetic instructions v2.",
          language: "sk",
          status: "draft",
        });
        expect(updated.revision).toBe(1);

        // The envelope bound to revision 0 must now fail.
        await expect(
          caller.extensions.discharge.save({
            id: prepared.reportId,
            expectedRevision: 0,
            ...draftInput,
            language: "sk",
            status: "finalized",
            clinicianConfirmed: { confirmationId: prepared.confirmationId },
          }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
      },
      120_000,
    );
  },
);
