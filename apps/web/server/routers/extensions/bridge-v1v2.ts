/**
 * Secure Interop Bridge v1 → v2 — tRPC extension router (Sprint 30).
 * ------------------------------------------------------------------
 * Mounted strictly under `extensionsRouter` (`trpc.extensions.bridgeV1V2.*`)
 * so the upstream routers stay untouched.
 *
 * The router is a thin persistence shell over `@/lib/interop/bridge-v1v2`:
 * the library owns envelope cryptography, schema validation and the statutory
 * safety gates; this file owns tenant scoping, the audit trail and storage.
 *
 * Server error messages stay in English (AGENTS.md §4); the console localises
 * them through `useI18n()`.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, ilike, isNull, or, sql } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  extAutomationSuppressionLog,
  extBridgeContracts,
  extBridgeEndpoints,
  extBridgeEvents,
  extBridgeKeys,
  extBridgeMessages,
  patients,
} from "@openpims/db";
import {
  BRIDGE_ALLOWED_MESSAGE_TYPES,
  BRIDGE_ENCRYPTION_ALGORITHM,
  BRIDGE_KEY_ROTATION_DAYS,
  BRIDGE_MAX_PAYLOAD_BYTES,
  BRIDGE_MESSAGE_TYPES,
  BRIDGE_PROTOCOL_VERSION,
  BRIDGE_REPLAY_WINDOW_MS,
  BRIDGE_SCHEMA_VERSIONS,
  type BridgeDirection,
  type BridgePatientStatus,
  type BridgeRuntime,
  bridgeKeyAgeDays,
  bridgeSecretEnvVar,
  bridgeSuccessRate,
  dispatchBridgeMessage,
  fingerprintBridgeKey,
  generateBridgeKeyId,
  generateBridgeMessageId,
  generateBridgeNonce,
  ingestBridgeEnvelope,
  isBridgeKeyRotationDue,
} from "@/lib/interop/bridge-v1v2";

/** Bridge operations are clinical-infrastructure work: admin + veterinarian. */
const bridgeProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian"),
);

/** Key lifecycle and contract approval are administrator-only. */
const bridgeAdminProcedure = protectedProcedure.use(requireRole("admin"));

const SEARCH_MAX_LENGTH = 120;
const ENDPOINT_NAME_MAX = 120;
const BASE_URL_MAX = 255;
const DEFAULT_KEY_SALT_PREFIX = "openvpm-bridge";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const directionSchema = z.enum(["v1_to_v2", "v2_to_v1"]);
const runtimeSchema = z.enum(["v1", "v2"]);
const endpointStatusSchema = z.enum(["active", "paused", "revoked"]);
const messageStatusSchema = z.enum([
  "received",
  "validated",
  "quarantined",
  "processed",
  "acknowledged",
  "failed",
  "rejected",
]);

/**
 * Secret material never travels through the API. The router resolves it from
 * the deployment secret store by reference (`secretRef`, defaulting to the
 * canonical env var for the runtime).
 */
function resolveBridgeSecret(
  secretRef: string | null | undefined,
  runtime: BridgeRuntime,
): string {
  const envName = secretRef?.trim() ? secretRef.trim() : bridgeSecretEnvVar(runtime);
  const secret = process.env[envName];
  if (!secret || secret.length < 16) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Bridge secret is not provisioned (${envName}). Configure it in the deployment secret store before registering a key.`,
    });
  }
  return secret;
}

function defaultKeySalt(practiceId: string, runtime: BridgeRuntime): string {
  return `${DEFAULT_KEY_SALT_PREFIX}:${practiceId}:${runtime}`;
}

function assertHttpsEndpoint(baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Bridge endpoint URL is not a valid absolute URL.",
    });
  }
  const isLocal =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !isLocal) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Bridge endpoints must use HTTPS (plain HTTP is only allowed for localhost development).",
    });
  }
  return parsed.origin;
}

type BridgeEventType =
  | "endpoint_registered"
  | "endpoint_updated"
  | "key_registered"
  | "key_rotated"
  | "key_revoked"
  | "contract_updated"
  | "envelope_received"
  | "signature_verified"
  | "signature_invalid"
  | "decrypted"
  | "decryption_failed"
  | "schema_validated"
  | "schema_rejected"
  | "safety_gate_blocked"
  | "quarantined"
  | "dispatched"
  | "acknowledged"
  | "suppression_forwarded";

interface BridgeEventInput {
  practiceId: string;
  actor: string;
  eventType: BridgeEventType;
  severity?: "info" | "warning" | "critical";
  endpointId?: string | null;
  messageId?: string | null;
  detail?: string | null;
}

async function recordBridgeEvent(
  db: Database,
  input: BridgeEventInput,
): Promise<void> {
  await db.insert(extBridgeEvents).values({
    practiceId: input.practiceId,
    endpointId: input.endpointId ?? null,
    messageId: input.messageId ?? null,
    eventType: input.eventType,
    severity: input.severity ?? "info",
    actor: input.actor,
    detail: input.detail ?? null,
  });
}

function actorOf(ctx: { session: { user: { id: string } } | null }): string {
  return ctx.session?.user?.id ? `user:${ctx.session.user.id}` : "system";
}

/** Resolves the local patient row for a bridged payload, when one exists. */
async function resolvePatientId(
  db: Database,
  practiceId: string,
  payload: Record<string, unknown> | null,
): Promise<string | null> {
  const candidate =
    typeof payload?.patientId === "string" ? payload.patientId : null;
  if (!candidate || !UUID_PATTERN.test(candidate)) return null;
  const rows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.id, candidate),
        eq(patients.practiceId, practiceId),
        isNull(patients.deletedAt),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Local patient status drives the Sympathy Gate on outbound messages. */
async function resolvePatientStatus(
  db: Database,
  practiceId: string,
  patientId: string | null,
): Promise<BridgePatientStatus | null> {
  if (!patientId || !UUID_PATTERN.test(patientId)) return null;
  const rows = await db
    .select({ status: patients.status })
    .from(patients)
    .where(
      and(
        eq(patients.id, patientId),
        eq(patients.practiceId, practiceId),
        isNull(patients.deletedAt),
      ),
    )
    .limit(1);
  const status = rows[0]?.status;
  if (!status) return null;
  return status === "deceased" ? "deceased" : "active";
}

/**
 * Sympathy Gate forwarding: the bridge writes the suppression to the canonical
 * `ext_automation_suppression_log`, which every automation path already
 * consults before contacting a client.
 */
async function forwardSuppression(
  db: Database,
  practiceId: string,
  payload: Record<string, unknown>,
  messageRowId: string,
): Promise<void> {
  const patientId =
    typeof payload.patientId === "string" && UUID_PATTERN.test(payload.patientId)
      ? payload.patientId
      : null;
  let clientId =
    typeof payload.clientId === "string" && UUID_PATTERN.test(payload.clientId)
      ? payload.clientId
      : null;

  if (patientId) {
    const rows = await db
      .select({ id: patients.id, clientId: patients.clientId })
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.practiceId, practiceId)))
      .limit(1);
    if (rows[0]) clientId = rows[0].clientId;
  }

  if (!clientId) return;

  const rawAction =
    typeof payload.blockedAction === "string" ? payload.blockedAction.trim() : "";
  const blockedAction =
    rawAction.length >= 3 ? rawAction.slice(0, 200) : "bridge:automation";
  const channel =
    payload.channel === "sms" || payload.channel === "email"
      ? payload.channel
      : null;

  await db
    .insert(extAutomationSuppressionLog)
    .values({
      practiceId,
      clientId,
      patientId,
      suppressionReason: "deceased_patient",
      blockedAction,
      channelAttempted: channel,
      detail:
        typeof payload.detail === "string"
          ? payload.detail
          : "Suppressed by the interop bridge Sympathy Gate.",
      dedupeKey: `bridge:${messageRowId}`,
    })
    .onConflictDoNothing();
}

export const bridgeV1V2Router = createRouter({
  /**
   * Console overview: peer health, throughput, key rotation state and the
   * statutory policy the bridge is currently enforcing.
   */
  getOverview: bridgeProcedure.query(async ({ ctx }) => {
    const practiceId = ctx.practiceId;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [endpoints, statusRows, recentMessages, keys] = await Promise.all([
      ctx.db
        .select({
          id: extBridgeEndpoints.id,
          name: extBridgeEndpoints.name,
          runtime: extBridgeEndpoints.runtime,
          direction: extBridgeEndpoints.direction,
          baseUrl: extBridgeEndpoints.baseUrl,
          status: extBridgeEndpoints.status,
          activeKeyId: extBridgeEndpoints.activeKeyId,
          lastSeenAt: extBridgeEndpoints.lastSeenAt,
          lastFailureCode: extBridgeEndpoints.lastFailureCode,
        })
        .from(extBridgeEndpoints)
        .where(
          and(
            eq(extBridgeEndpoints.practiceId, practiceId),
            isNull(extBridgeEndpoints.deletedAt),
          ),
        )
        .orderBy(extBridgeEndpoints.runtime),
      ctx.db
        .select({
          status: extBridgeMessages.status,
          value: count(),
        })
        .from(extBridgeMessages)
        .where(
          and(
            eq(extBridgeMessages.practiceId, practiceId),
            isNull(extBridgeMessages.deletedAt),
          ),
        )
        .groupBy(extBridgeMessages.status),
      ctx.db
        .select({
          inbound24h: sql<number>`count(*) filter (where ${extBridgeMessages.direction} = 'v1_to_v2')`,
          outbound24h: sql<number>`count(*) filter (where ${extBridgeMessages.direction} = 'v2_to_v1')`,
          suppressed24h: sql<number>`count(*) filter (where ${extBridgeMessages.sympathySuppressed})`,
          controlled24h: sql<number>`count(*) filter (where ${extBridgeMessages.controlledSubstance})`,
          drafts24h: sql<number>`count(*) filter (where ${extBridgeMessages.clinicalDraft})`,
        })
        .from(extBridgeMessages)
        .where(
          and(
            eq(extBridgeMessages.practiceId, practiceId),
            gte(extBridgeMessages.createdAt, since),
            isNull(extBridgeMessages.deletedAt),
          ),
        ),
      ctx.db
        .select({
          runtime: extBridgeKeys.runtime,
          keyId: extBridgeKeys.keyId,
          fingerprint: extBridgeKeys.fingerprint,
          salt: extBridgeKeys.salt,
          status: extBridgeKeys.status,
          activatedAt: extBridgeKeys.activatedAt,
        })
        .from(extBridgeKeys)
        .where(
          and(
            eq(extBridgeKeys.practiceId, practiceId),
            isNull(extBridgeKeys.deletedAt),
          ),
        )
        .orderBy(desc(extBridgeKeys.activatedAt)),
    ]);

    const byStatus: Record<string, number> = {};
    let totalMessages = 0;
    for (const row of statusRows) {
      const value = Number(row.value);
      byStatus[row.status] = value;
      totalMessages += value;
    }

    const keyItems = keys.map((key) => ({
      runtime: key.runtime,
      keyId: key.keyId,
      fingerprint: key.fingerprint,
      salt: key.salt,
      status: key.status,
      activatedAt: key.activatedAt,
      ageDays: bridgeKeyAgeDays(key.activatedAt),
      rotationDue: isBridgeKeyRotationDue(key.activatedAt),
    }));
    const activeKeys = keyItems.filter((key) => key.status === "active");
    const window = recentMessages[0];

    return {
      endpoints: {
        total: endpoints.length,
        active: endpoints.filter((endpoint) => endpoint.status === "active").length,
        paused: endpoints.filter((endpoint) => endpoint.status === "paused").length,
        revoked: endpoints.filter((endpoint) => endpoint.status === "revoked").length,
        items: endpoints,
      },
      messages: {
        total: totalMessages,
        validated: byStatus.validated ?? 0,
        processed: byStatus.processed ?? 0,
        quarantined: byStatus.quarantined ?? 0,
        rejected: byStatus.rejected ?? 0,
        failed: byStatus.failed ?? 0,
        acknowledged: byStatus.acknowledged ?? 0,
        successRate: bridgeSuccessRate({
          validated: byStatus.validated ?? 0,
          processed: byStatus.processed ?? 0,
          quarantined: byStatus.quarantined ?? 0,
          rejected: byStatus.rejected ?? 0,
          failed: byStatus.failed ?? 0,
        }),
        inbound24h: Number(window?.inbound24h ?? 0),
        outbound24h: Number(window?.outbound24h ?? 0),
        suppressed24h: Number(window?.suppressed24h ?? 0),
        controlled24h: Number(window?.controlled24h ?? 0),
        drafts24h: Number(window?.drafts24h ?? 0),
      },
      keys: {
        items: keyItems,
        active: activeKeys,
        rotationDue: activeKeys.some((key) => key.rotationDue),
        rotationDays: BRIDGE_KEY_ROTATION_DAYS,
      },
      policy: {
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
        schemaVersion: BRIDGE_SCHEMA_VERSIONS[0],
        encryptionAlgorithm: BRIDGE_ENCRYPTION_ALGORITHM,
        payloadLimitBytes: BRIDGE_MAX_PAYLOAD_BYTES,
        replayWindowSeconds: Math.round(BRIDGE_REPLAY_WINDOW_MS / 1000),
        messageTypeCount: BRIDGE_MESSAGE_TYPES.length,
        gates: [
          {
            code: "clinical_draft_required",
            statutoryReference: "Zákon č. 39/2007 Z. z.",
            messageTypes: [
              "clinical.soap_note.drafted",
              "clinical.soap_note.signed",
              "prescription.created",
            ],
          },
          {
            code: "controlled_substance_ai_prefill_forbidden",
            statutoryReference: "Zákon č. 139/1998 Z. z.",
            messageTypes: [
              "prescription.created",
              "controlled_substance.dispense",
            ],
          },
          {
            code: "sympathy_suppression_required",
            statutoryReference: "Sympathy Gate",
            messageTypes: [
              "automation.suppression.request",
              "appointment.created",
            ],
          },
        ],
      },
    };
  }),

  /** Registered peer runtimes. */
  listEndpoints: bridgeProcedure
    .input(
      z
        .object({
          runtime: runtimeSchema.optional(),
          status: endpointStatusSchema.optional(),
          search: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(extBridgeEndpoints.practiceId, ctx.practiceId),
        isNull(extBridgeEndpoints.deletedAt),
      ];
      if (input?.runtime) {
        conditions.push(eq(extBridgeEndpoints.runtime, input.runtime));
      }
      if (input?.status) {
        conditions.push(eq(extBridgeEndpoints.status, input.status));
      }
      if (input?.search) {
        conditions.push(ilike(extBridgeEndpoints.name, `%${input.search}%`));
      }

      const items = await ctx.db
        .select()
        .from(extBridgeEndpoints)
        .where(and(...conditions))
        .orderBy(extBridgeEndpoints.runtime);

      return { items, total: items.length };
    }),

  /** Creates or updates a peer endpoint. HTTPS is enforced. */
  saveEndpoint: bridgeAdminProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(ENDPOINT_NAME_MAX),
        runtime: runtimeSchema,
        direction: directionSchema,
        baseUrl: z.string().trim().min(8).max(BASE_URL_MAX),
        allowedMessageTypes: z
          .array(z.enum(BRIDGE_MESSAGE_TYPES))
          .max(BRIDGE_MESSAGE_TYPES.length)
          .optional(),
        status: endpointStatusSchema.default("active"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const baseUrl = assertHttpsEndpoint(input.baseUrl);
      const allowed = input.allowedMessageTypes ?? [];
      const catalogue = new Set<string>(
        BRIDGE_ALLOWED_MESSAGE_TYPES[input.direction],
      );
      const invalid = allowed.filter((type) => !catalogue.has(type));
      if (invalid.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Message types are not allowed on ${input.direction}: ${invalid.join(", ")}.`,
        });
      }

      if (input.id) {
        const [updated] = await ctx.db
          .update(extBridgeEndpoints)
          .set({
            name: input.name,
            runtime: input.runtime,
            direction: input.direction,
            baseUrl,
            allowedMessageTypes: allowed,
            status: input.status,
          })
          .where(
            and(
              eq(extBridgeEndpoints.id, input.id),
              eq(extBridgeEndpoints.practiceId, ctx.practiceId),
            ),
          )
          .returning();
        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bridge endpoint not found.",
          });
        }
        await recordBridgeEvent(ctx.db, {
          practiceId: ctx.practiceId,
          actor: actorOf(ctx),
          eventType: "endpoint_updated",
          endpointId: updated.id,
          detail: `${updated.runtime} → ${updated.baseUrl}`,
        });
        return updated;
      }

      const [created] = await ctx.db
        .insert(extBridgeEndpoints)
        .values({
          practiceId: ctx.practiceId,
          name: input.name,
          runtime: input.runtime,
          direction: input.direction,
          baseUrl,
          allowedMessageTypes: allowed,
          status: input.status,
          protocolVersion: BRIDGE_PROTOCOL_VERSION,
          createdBy: ctx.session.user.id,
        })
        .returning();

      await recordBridgeEvent(ctx.db, {
        practiceId: ctx.practiceId,
        actor: actorOf(ctx),
        eventType: "endpoint_registered",
        endpointId: created.id,
        detail: `${created.runtime} → ${created.baseUrl}`,
      });
      return created;
    }),

  /** Key registry — fingerprints only, never secret material. */
  listKeys: bridgeProcedure
    .input(z.object({ runtime: runtimeSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(extBridgeKeys.practiceId, ctx.practiceId),
        isNull(extBridgeKeys.deletedAt),
      ];
      if (input?.runtime) {
        conditions.push(eq(extBridgeKeys.runtime, input.runtime));
      }

      const rows = await ctx.db
        .select()
        .from(extBridgeKeys)
        .where(and(...conditions))
        .orderBy(desc(extBridgeKeys.activatedAt));

      return {
        items: rows.map((row) => ({
          ...row,
          ageDays: bridgeKeyAgeDays(row.activatedAt),
          rotationDue: isBridgeKeyRotationDue(row.activatedAt),
        })),
        total: rows.length,
      };
    }),

  /**
   * Activates the secret currently provisioned in the deployment secret store,
   * publishing only its fingerprint. Rotation is always on: the previously
   * active key for the runtime is marked `rotated` in the same call.
   */
  registerKey: bridgeAdminProcedure
    .input(
      z.object({
        runtime: runtimeSchema,
        keyId: z.string().trim().min(4).max(160).optional(),
        secretRef: z.string().trim().min(3).max(160).optional(),
        salt: z.string().trim().min(8).max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const secret = resolveBridgeSecret(input.secretRef, input.runtime);
      const salt = input.salt ?? defaultKeySalt(ctx.practiceId, input.runtime);
      const keyId = input.keyId ?? generateBridgeKeyId(input.runtime);

      const [existing] = await ctx.db
        .select({ id: extBridgeKeys.id })
        .from(extBridgeKeys)
        .where(
          and(
            eq(extBridgeKeys.practiceId, ctx.practiceId),
            eq(extBridgeKeys.keyId, keyId),
          ),
        );
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Key "${keyId}" already exists for this practice.`,
        });
      }

      const previous = await ctx.db
        .select({ id: extBridgeKeys.id, keyId: extBridgeKeys.keyId })
        .from(extBridgeKeys)
        .where(
          and(
            eq(extBridgeKeys.practiceId, ctx.practiceId),
            eq(extBridgeKeys.runtime, input.runtime),
            eq(extBridgeKeys.status, "active"),
          ),
        );

      const [created] = await ctx.db
        .insert(extBridgeKeys)
        .values({
          practiceId: ctx.practiceId,
          runtime: input.runtime,
          keyId,
          algorithm: BRIDGE_ENCRYPTION_ALGORITHM,
          fingerprint: fingerprintBridgeKey(secret),
          salt,
          secretRef: input.secretRef?.trim() || bridgeSecretEnvVar(input.runtime),
          status: "active",
          createdBy: ctx.session.user.id,
        })
        .returning();

      for (const old of previous) {
        await ctx.db
          .update(extBridgeKeys)
          .set({ status: "rotated", rotatedAt: new Date() })
          .where(
            and(
              eq(extBridgeKeys.id, old.id),
              eq(extBridgeKeys.practiceId, ctx.practiceId),
            ),
          );
        await recordBridgeEvent(ctx.db, {
          practiceId: ctx.practiceId,
          actor: actorOf(ctx),
          eventType: "key_rotated",
          detail: `${old.keyId} rotated out by ${created.keyId}`,
        });
      }

      await ctx.db
        .update(extBridgeEndpoints)
        .set({ activeKeyId: created.keyId })
        .where(
          and(
            eq(extBridgeEndpoints.practiceId, ctx.practiceId),
            eq(extBridgeEndpoints.runtime, input.runtime),
          ),
        );

      await recordBridgeEvent(ctx.db, {
        practiceId: ctx.practiceId,
        actor: actorOf(ctx),
        eventType: "key_registered",
        detail: `${created.runtime}:${created.keyId}`,
      });

      return {
        id: created.id,
        runtime: created.runtime,
        keyId: created.keyId,
        fingerprint: created.fingerprint,
        salt: created.salt,
        secretRef: created.secretRef,
        status: created.status,
        activatedAt: created.activatedAt,
      };
    }),

  /** Immediate revocation — the key can no longer seal or open envelopes. */
  revokeKey: bridgeAdminProcedure
    .input(z.object({ keyId: z.string().trim().min(4).max(160) }))
    .mutation(async ({ ctx, input }) => {
      const [revoked] = await ctx.db
        .update(extBridgeKeys)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(
          and(
            eq(extBridgeKeys.practiceId, ctx.practiceId),
            eq(extBridgeKeys.keyId, input.keyId),
          ),
        )
        .returning();
      if (!revoked) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bridge key not found." });
      }

      await recordBridgeEvent(ctx.db, {
        practiceId: ctx.practiceId,
        actor: actorOf(ctx),
        eventType: "key_revoked",
        severity: "warning",
        detail: `${revoked.runtime}:${revoked.keyId}`,
      });

      return revoked;
    }),

  /**
   * Payload contract registry: what the bridge can validate, per direction,
   * merged with this practice's approval state.
   */
  listContracts: bridgeProcedure
    .input(z.object({ direction: directionSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(extBridgeContracts)
        .where(
          and(
            eq(extBridgeContracts.practiceId, ctx.practiceId),
            isNull(extBridgeContracts.deletedAt),
          ),
        );

      const registry = new Map(
        rows.map((row) => [`${row.direction}:${row.messageType}`, row]),
      );

      const directions: BridgeDirection[] = input?.direction
        ? [input.direction]
        : ["v1_to_v2", "v2_to_v1"];

      const items = directions.flatMap((direction) =>
        BRIDGE_ALLOWED_MESSAGE_TYPES[direction].map((messageType) => {
          const registered = registry.get(`${direction}:${messageType}`);
          return {
            messageType,
            direction,
            schemaVersion: registered?.schemaVersion ?? BRIDGE_SCHEMA_VERSIONS[0],
            strict: registered?.strict ?? true,
            status: registered?.status ?? "active",
            registered: Boolean(registered),
            notes: registered?.notes ?? null,
            approvedAt: registered?.approvedAt ?? null,
          };
        }),
      );

      return { items, total: items.length };
    }),

  /** Approves or disables a payload contract for this practice. */
  upsertContract: bridgeAdminProcedure
    .input(
      z.object({
        messageType: z.enum(BRIDGE_MESSAGE_TYPES),
        direction: directionSchema,
        schemaVersion: z
          .string()
          .trim()
          .min(1)
          .max(16)
          .default(BRIDGE_SCHEMA_VERSIONS[0]),
        status: z.enum(["active", "disabled"]).default("active"),
        notes: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const catalogue = new Set<string>(
        BRIDGE_ALLOWED_MESSAGE_TYPES[input.direction],
      );
      if (!catalogue.has(input.messageType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Message type "${input.messageType}" is not allowed on ${input.direction}.`,
        });
      }

      const [saved] = await ctx.db
        .insert(extBridgeContracts)
        .values({
          practiceId: ctx.practiceId,
          messageType: input.messageType,
          schemaVersion: input.schemaVersion,
          direction: input.direction,
          strict: true,
          status: input.status,
          notes: input.notes ?? null,
          approvedBy: ctx.session.user.id,
          approvedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            extBridgeContracts.practiceId,
            extBridgeContracts.messageType,
            extBridgeContracts.schemaVersion,
            extBridgeContracts.direction,
          ],
          set: {
            status: input.status,
            notes: input.notes ?? null,
            approvedBy: ctx.session.user.id,
            approvedAt: new Date(),
          },
        })
        .returning();

      await recordBridgeEvent(ctx.db, {
        practiceId: ctx.practiceId,
        actor: actorOf(ctx),
        eventType: "contract_updated",
        detail: `${input.direction}:${input.messageType} → ${input.status}`,
      });

      return saved;
    }),

  /** Message log with the operator's filters. Ciphertext stays server-side. */
  listMessages: bridgeProcedure
    .input(
      z
        .object({
          status: messageStatusSchema.optional(),
          direction: directionSchema.optional(),
          messageType: z.enum(BRIDGE_MESSAGE_TYPES).optional(),
          search: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
          limit: z.number().int().min(1).max(200).default(100),
          offset: z.number().int().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(extBridgeMessages.practiceId, ctx.practiceId),
        isNull(extBridgeMessages.deletedAt),
      ];
      if (input?.status) {
        conditions.push(eq(extBridgeMessages.status, input.status));
      }
      if (input?.direction) {
        conditions.push(eq(extBridgeMessages.direction, input.direction));
      }
      if (input?.messageType) {
        conditions.push(eq(extBridgeMessages.messageType, input.messageType));
      }
      if (input?.search) {
        const needle = `%${input.search}%`;
        const searchCondition = or(
          ilike(extBridgeMessages.externalId, needle),
          ilike(extBridgeMessages.messageId, needle),
          ilike(extBridgeMessages.messageType, needle),
          ilike(extBridgeMessages.failureCode, needle),
        );
        if (searchCondition) conditions.push(searchCondition);
      }

      const [items, totalRow] = await Promise.all([
        ctx.db
          .select({
            id: extBridgeMessages.id,
            direction: extBridgeMessages.direction,
            sourceRuntime: extBridgeMessages.sourceRuntime,
            messageType: extBridgeMessages.messageType,
            schemaVersion: extBridgeMessages.schemaVersion,
            status: extBridgeMessages.status,
            externalId: extBridgeMessages.externalId,
            messageId: extBridgeMessages.messageId,
            correlationId: extBridgeMessages.correlationId,
            keyId: extBridgeMessages.keyId,
            algorithm: extBridgeMessages.algorithm,
            payloadHash: extBridgeMessages.payloadHash,
            signatureVerified: extBridgeMessages.signatureVerified,
            payloadByteSize: extBridgeMessages.payloadByteSize,
            failureCode: extBridgeMessages.failureCode,
            validationIssues: extBridgeMessages.validationIssues,
            payloadSummary: extBridgeMessages.payloadSummary,
            clinicalDraft: extBridgeMessages.clinicalDraft,
            requiresVetSignoff: extBridgeMessages.requiresVetSignoff,
            controlledSubstance: extBridgeMessages.controlledSubstance,
            sympathySuppressed: extBridgeMessages.sympathySuppressed,
            sentAt: extBridgeMessages.sentAt,
            processedAt: extBridgeMessages.processedAt,
            acknowledgedAt: extBridgeMessages.acknowledgedAt,
            createdAt: extBridgeMessages.createdAt,
          })
          .from(extBridgeMessages)
          .where(and(...conditions))
          .orderBy(desc(extBridgeMessages.createdAt))
          .limit(input?.limit ?? 100)
          .offset(input?.offset ?? 0),
        ctx.db
          .select({ value: count() })
          .from(extBridgeMessages)
          .where(and(...conditions)),
      ]);

      return { items, total: Number(totalRow[0]?.value ?? 0) };
    }),

  /** Single message with its security audit trail (ciphertext excluded). */
  getMessage: bridgeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [message] = await ctx.db
        .select()
        .from(extBridgeMessages)
        .where(
          and(
            eq(extBridgeMessages.id, input.id),
            eq(extBridgeMessages.practiceId, ctx.practiceId),
            isNull(extBridgeMessages.deletedAt),
          ),
        );
      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bridge message not found.",
        });
      }

      const events = await ctx.db
        .select()
        .from(extBridgeEvents)
        .where(eq(extBridgeEvents.messageId, message.id))
        .orderBy(desc(extBridgeEvents.createdAt));

      const { ciphertext: _ciphertext, ...safe } = message;
      return { message: safe, events };
    }),

  /**
   * Ingest path: validates, authenticates, decrypts and safety-gates an
   * envelope from the v1 runtime. Every outcome — including rejection — is
   * persisted with its audit trail.
   */
  ingest: bridgeProcedure
    .input(
      z.object({
        envelope: z.unknown(),
        endpointId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const raw = input.envelope as { header?: Record<string, unknown> } | null;
      const rawHeader =
        raw && typeof raw === "object" && raw.header && typeof raw.header === "object"
          ? raw.header
          : null;
      const runtime: BridgeRuntime =
        rawHeader?.sourceRuntime === "v2" ? "v2" : "v1";
      const direction: BridgeDirection =
        rawHeader?.direction === "v2_to_v1" ? "v2_to_v1" : "v1_to_v2";
      const nonce = typeof rawHeader?.nonce === "string" ? rawHeader.nonce : null;

      const [activeKey] = await ctx.db
        .select({
          keyId: extBridgeKeys.keyId,
          salt: extBridgeKeys.salt,
          secretRef: extBridgeKeys.secretRef,
        })
        .from(extBridgeKeys)
        .where(
          and(
            eq(extBridgeKeys.practiceId, ctx.practiceId),
            eq(extBridgeKeys.runtime, runtime),
            eq(extBridgeKeys.status, "active"),
            isNull(extBridgeKeys.deletedAt),
          ),
        )
        .orderBy(desc(extBridgeKeys.activatedAt))
        .limit(1);

      if (!activeKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `No active bridge key registered for runtime "${runtime}". Register a key before accepting envelopes.`,
        });
      }

      const secret = resolveBridgeSecret(activeKey.secretRef, runtime);

      const seenNonces = nonce
        ? (
            await ctx.db
              .select({ nonce: extBridgeMessages.nonce })
              .from(extBridgeMessages)
              .where(
                and(
                  eq(extBridgeMessages.practiceId, ctx.practiceId),
                  eq(extBridgeMessages.nonce, nonce),
                ),
              )
              .limit(1)
          ).map((row) => row.nonce)
        : [];

      const endpointId =
        input.endpointId ??
        (
          await ctx.db
            .select({ id: extBridgeEndpoints.id })
            .from(extBridgeEndpoints)
            .where(
              and(
                eq(extBridgeEndpoints.practiceId, ctx.practiceId),
                eq(extBridgeEndpoints.runtime, runtime),
                isNull(extBridgeEndpoints.deletedAt),
              ),
            )
            .limit(1)
        )[0]?.id ??
        null;

      const outcome = ingestBridgeEnvelope(input.envelope, {
        receiverRuntime: "v2",
        secret,
        salt: activeKey.salt,
        keyId: activeKey.keyId,
        seenNonces,
      });

      const patientId = await resolvePatientId(
        ctx.db,
        ctx.practiceId,
        outcome.payload,
      );

      const [stored] = await ctx.db
        .insert(extBridgeMessages)
        .values({
          practiceId: ctx.practiceId,
          endpointId,
          direction: outcome.direction ?? direction,
          sourceRuntime: runtime,
          messageType:
            outcome.messageType ?? String(rawHeader?.messageType ?? "unknown"),
          schemaVersion:
            typeof rawHeader?.schemaVersion === "string"
              ? rawHeader.schemaVersion
              : BRIDGE_SCHEMA_VERSIONS[0],
          status: outcome.status,
          externalId: String(rawHeader?.externalId ?? outcome.messageId ?? "unknown"),
          messageId: outcome.messageId ?? generateBridgeMessageId(),
          correlationId: outcome.correlationId,
          nonce: nonce ?? generateBridgeNonce(),
          keyId: outcome.keyId,
          algorithm: BRIDGE_ENCRYPTION_ALGORITHM,
          payloadHash: outcome.payloadHash,
          signatureVerified:
            outcome.status !== "rejected" &&
            outcome.failureCode !== "signature_invalid",
          payloadByteSize: outcome.plaintextBytes,
          failureCode: outcome.failureCode,
          validationIssues: outcome.issues,
          payloadSummary: outcome.redactedPayload,
          patientId,
          clinicalDraft: outcome.gates?.clinical ?? false,
          requiresVetSignoff: outcome.gates?.requiresVetSignoff ?? false,
          controlledSubstance: outcome.gates?.controlledSubstance ?? false,
          sympathySuppressed: outcome.gates?.sympathySuppressed ?? false,
          receivedAt: new Date(),
          processedAt: outcome.status === "validated" ? new Date() : null,
        })
        .returning({ id: extBridgeMessages.id });

      await recordBridgeEvent(ctx.db, {
        practiceId: ctx.practiceId,
        actor: `bridge:${runtime}`,
        eventType: "envelope_received",
        endpointId,
        messageId: stored.id,
        detail: outcome.messageType ?? "unparsable envelope",
      });
      await recordBridgeEvent(ctx.db, {
        practiceId: ctx.practiceId,
        actor: `bridge:${runtime}`,
        eventType:
          outcome.status === "validated"
            ? "schema_validated"
            : outcome.status === "quarantined"
              ? "quarantined"
              : "schema_rejected",
        severity: outcome.status === "validated" ? "info" : "warning",
        endpointId,
        messageId: stored.id,
        detail: outcome.failureCode,
      });
      if (outcome.gates?.blocked) {
        await recordBridgeEvent(ctx.db, {
          practiceId: ctx.practiceId,
          actor: `bridge:${runtime}`,
          eventType: "safety_gate_blocked",
          severity: "critical",
          endpointId,
          messageId: stored.id,
          detail: outcome.gates.blockCode,
        });
      }

      // Sympathy Gate: a suppression request for a deceased patient is
      // forwarded into the canonical suppression log so the automation engine
      // stops any queued outreach for that client immediately.
      if (
        outcome.status === "validated" &&
        outcome.messageType === "automation.suppression.request" &&
        outcome.payload
      ) {
        await forwardSuppression(
          ctx.db,
          ctx.practiceId,
          outcome.payload,
          stored.id,
        );
        await recordBridgeEvent(ctx.db, {
          practiceId: ctx.practiceId,
          actor: `bridge:${runtime}`,
          eventType: "suppression_forwarded",
          endpointId,
          messageId: stored.id,
          detail: "Sympathy Gate — automated outreach withheld",
        });
      }

      return {
        id: stored.id,
        status: outcome.status,
        failureCode: outcome.failureCode,
        issues: outcome.issues,
        messageId: outcome.messageId,
        messageType: outcome.messageType,
        direction: outcome.direction,
        gates: outcome.gates,
      };
    }),

  /**
   * Dispatch path: safety-gates, validates, encrypts and signs an outbound
   * message, then stores the sealed envelope for the delivery worker.
   */
  dispatch: bridgeProcedure
    .input(
      z.object({
        direction: directionSchema,
        messageType: z.enum(BRIDGE_MESSAGE_TYPES),
        externalId: z.string().trim().min(1).max(160),
        correlationId: z.string().trim().min(1).max(160).optional(),
        payload: z.record(z.unknown()),
        patientId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const senderRuntime: BridgeRuntime =
        input.direction === "v1_to_v2" ? "v1" : "v2";

      const [activeKey] = await ctx.db
        .select({
          keyId: extBridgeKeys.keyId,
          salt: extBridgeKeys.salt,
          secretRef: extBridgeKeys.secretRef,
        })
        .from(extBridgeKeys)
        .where(
          and(
            eq(extBridgeKeys.practiceId, ctx.practiceId),
            eq(extBridgeKeys.runtime, senderRuntime),
            eq(extBridgeKeys.status, "active"),
            isNull(extBridgeKeys.deletedAt),
          ),
        )
        .orderBy(desc(extBridgeKeys.activatedAt))
        .limit(1);

      if (!activeKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `No active bridge key registered for runtime "${senderRuntime}".`,
        });
      }
      const secret = resolveBridgeSecret(activeKey.secretRef, senderRuntime);

      const patientStatus = await resolvePatientStatus(
        ctx.db,
        ctx.practiceId,
        input.patientId ??
          (typeof input.payload.patientId === "string"
            ? input.payload.patientId
            : null),
      );

      const outcome = dispatchBridgeMessage({
        direction: input.direction,
        messageType: input.messageType,
        externalId: input.externalId,
        correlationId: input.correlationId,
        payload: input.payload,
        secret,
        salt: activeKey.salt,
        keyId: activeKey.keyId,
        patientStatus,
      });

      if (!outcome.ok || !outcome.envelope) {
        return {
          ok: false as const,
          status: "refused" as const,
          failureCode: outcome.failureCode,
          issues: outcome.issues,
          gates: outcome.gates,
          message: null,
        };
      }

      const envelope = outcome.envelope;
      const [stored] = await ctx.db
        .insert(extBridgeMessages)
        .values({
          practiceId: ctx.practiceId,
          direction: input.direction,
          sourceRuntime: senderRuntime,
          messageType: input.messageType,
          schemaVersion: envelope.header.schemaVersion,
          status: "processed",
          externalId: input.externalId,
          messageId: envelope.header.messageId,
          correlationId: envelope.header.correlationId,
          nonce: envelope.header.nonce,
          keyId: envelope.header.keyId,
          algorithm: envelope.encryption.algorithm,
          iv: envelope.encryption.iv,
          authTag: envelope.encryption.authTag,
          ciphertext: envelope.encryption.ciphertext,
          payloadHash: outcome.payloadHash,
          signatureVerified: true,
          payloadByteSize: envelope.encryption.byteSize,
          payloadSummary: null,
          clinicalDraft: outcome.gates?.clinical ?? false,
          requiresVetSignoff: outcome.gates?.requiresVetSignoff ?? false,
          controlledSubstance: outcome.gates?.controlledSubstance ?? false,
          sympathySuppressed: outcome.gates?.sympathySuppressed ?? false,
          sentAt: new Date(envelope.header.sentAt),
          processedAt: new Date(),
        })
        .returning({ id: extBridgeMessages.id });

      await recordBridgeEvent(ctx.db, {
        practiceId: ctx.practiceId,
        actor: actorOf(ctx),
        eventType: "dispatched",
        messageId: stored.id,
        detail: `${input.direction}:${input.messageType}`,
      });

      return {
        ok: true as const,
        status: "processed" as const,
        failureCode: null,
        issues: outcome.issues,
        gates: outcome.gates,
        message: {
          id: stored.id,
          messageId: envelope.header.messageId,
          payloadHash: outcome.payloadHash,
          envelope,
        },
      };
    }),

  /** Operator acknowledgement — closes the loop on a delivered message. */
  acknowledge: bridgeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extBridgeMessages)
        .set({ status: "acknowledged", acknowledgedAt: new Date() })
        .where(
          and(
            eq(extBridgeMessages.id, input.id),
            eq(extBridgeMessages.practiceId, ctx.practiceId),
          ),
        )
        .returning();
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bridge message not found.",
        });
      }

      await recordBridgeEvent(ctx.db, {
        practiceId: ctx.practiceId,
        actor: actorOf(ctx),
        eventType: "acknowledged",
        messageId: updated.id,
      });

      return updated;
    }),

  /** Security audit trail for the console's event surface. */
  listEvents: bridgeProcedure
    .input(
      z
        .object({
          severity: z.enum(["info", "warning", "critical"]).optional(),
          messageId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(extBridgeEvents.practiceId, ctx.practiceId)];
      if (input?.severity) {
        conditions.push(eq(extBridgeEvents.severity, input.severity));
      }
      if (input?.messageId) {
        conditions.push(eq(extBridgeEvents.messageId, input.messageId));
      }

      const items = await ctx.db
        .select()
        .from(extBridgeEvents)
        .where(and(...conditions))
        .orderBy(desc(extBridgeEvents.createdAt))
        .limit(input?.limit ?? 50);

      return { items, total: items.length };
    }),
});
