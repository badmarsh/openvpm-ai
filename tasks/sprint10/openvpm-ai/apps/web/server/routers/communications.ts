import { parseSenderIdentity } from "@/lib/inbox-cleaner";
import {
  buildInboxReplyPrompt,
  detectSupplierInvoice,
  draftViolatesSympathy,
  evaluateSympathyGate,
  fallbackReplyDraft,
  inboxReplySystemPrompt,
} from "@/lib/inbox/ai-reply";
import { generateText } from "ai";
import {
  resolveFeatureConfig,
  resolvePracticeLanguageModel,
} from "@/lib/ai/ai-config-resolver";
import { recordUsage } from "@/lib/billing/usage";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, sql, isNull, or, ne, isNotNull, ilike } from "drizzle-orm";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  communications,
  clients,
  patients,
  emailSuppressions,
  practices,
  locationMessaging,
  locations,
  users,
} from "@openpims/db";
import type { Database } from "@openpims/db/client";
import { alertOps } from "@/lib/alerts";
import { sendEmail } from "@/lib/email";
import { normalizeE164 } from "@/lib/messaging";
import { hasNonBlankMessagingSender } from "@/lib/messaging/sender-query";
import { isQuietHours } from "@/lib/messaging/reminders";
import { sendSms } from "@/lib/sms";
import { withDurableSmsCommunication } from "@/lib/messaging/durable-sms-communication";
import { listOffsetInput } from "./pagination";
import {
  emailSuppressionSendBlockMessage,
  normalizeEmailSuppressionAddress,
} from "@/lib/email-suppression";
import {
  COMMUNICATION_CONTENT_MAX_LENGTH,
  COMMUNICATION_SUBJECT_MAX_LENGTH,
  SMS_COMMUNICATION_CONTENT_MAX_LENGTH,
} from "@/lib/communications/policy";
import {
  lockPracticeForExternalSideEffects,
  RECOVERY_HOLD_BLOCK_MESSAGE,
} from "@/lib/recovery-hold";
import { assertOutboundEmailAllowed } from "@/lib/outbound-email-security";
import { parsePdfInvoice, extractPdfText, type PdfInvoiceExtraction, type InvoiceParserAiConfig } from "@/lib/inventory/pdf-invoice-parser";


export {
  COMMUNICATION_CONTENT_MAX_LENGTH,
  COMMUNICATION_SUBJECT_MAX_LENGTH,
  SMS_COMMUNICATION_CONTENT_MAX_LENGTH,
} from "@/lib/communications/policy";

const inboxStaffProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician", "front_desk"),
);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderComposedEmail(opts: {
  practiceName: string;
  content: string;
  replyToEmail?: string | null;
}): string {
  const safePracticeName = escapeHtml(opts.practiceName);
  const safeReplyToEmail = opts.replyToEmail
    ? escapeHtml(opts.replyToEmail)
    : null;
  const body = escapeHtml(opts.content).replace(/\n/g, "<br />");
  const replyNotice = safeReplyToEmail
    ? `Reply directly to this email — your message will arrive in our inbox.`
    : `To reply, contact ${safePracticeName} directly.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safePracticeName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#0d9488;padding:20px 28px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">${safePracticeName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-size:15px;line-height:1.6;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">This email was sent by ${safePracticeName}.</p>
              <p style="margin:8px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">${replyNotice}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function validReplyToEmail(
  value: string | null | undefined,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return z.string().email().safeParse(trimmed).success ? trimmed : undefined;
}

function inboxAssignmentLockKey(practiceId: string, clientId: string) {
  return `inbox-assignment:${practiceId}:${clientId}`;
}

type CommunicationsContext = {
  db: Pick<Database, "select">;
  practiceId: string;
};

function activePracticeWhere(practiceId: string) {
  return and(eq(practices.id, practiceId), isNull(practices.deletedAt));
}

function activePracticePredicate(practiceId: string) {
  return sql`exists (
    select 1
    from ${practices}
    where ${practices.id} = ${practiceId}
      and ${practices.deletedAt} is null
  )`;
}

function practiceNotFound(): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message: "Practice not found" });
}

type InboxConversationRow = {
  id: string;
  clientId: string | null;
  channel: "phone" | "sms" | "email" | "portal";
  direction: "inbound" | "outbound";
  subject: string | null;
  content: string | null;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  assignedTo: string | null;
  assignedToName: string | null;
  readAt: Date | string | null;
  providerMessageId: string | null;
  dedupeKey: string | null;
  createdAt: Date | string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  senderDisplay: string | null;
  senderGroupKey: string | null;
  patientId: string | null;
  patientName: string | null;
  patientSpecies: string | null;
  sympathyActive: boolean | null;
  unreadCount: number | string | bigint | null;
  total: number | string | bigint | null;
};

function rowsFromExecute<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown[] } | null)?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function dbNumber(value: number | string | bigint | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

async function practiceTimeZone(
  ctx: CommunicationsContext,
): Promise<string | null> {
  const [practice] = await ctx.db
    .select({ timezone: practices.timezone })
    .from(practices)
    .where(activePracticeWhere(ctx.practiceId))
    .limit(1);
  if (!practice) {
    throw practiceNotFound();
  }
  return practice.timezone ?? null;
}

const createCommunicationInput = z
  .object({
    clientId: z.string().uuid(),
    channel: z.enum(["phone", "sms", "email", "portal", "whatsapp"]),
    direction: z.enum(["inbound", "outbound"]),
    subject: z.string().trim().max(COMMUNICATION_SUBJECT_MAX_LENGTH).optional(),
    content: z
      .string()
      .trim()
      .min(1, "Message content is required")
      .max(
        COMMUNICATION_CONTENT_MAX_LENGTH,
        `Message content must be at most ${COMMUNICATION_CONTENT_MAX_LENGTH} characters.`,
      ),
    status: z
      .enum(["pending", "sent", "delivered", "read", "failed"])
      .optional(),
    requestId: z.string().uuid().optional(),
    patientId: z.string().uuid().optional(),
  })
  .superRefine((input, ctx) => {
    if (
      input.channel === "sms" &&
      input.content.length > SMS_COMMUNICATION_CONTENT_MAX_LENGTH
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: `SMS messages must be at most ${SMS_COMMUNICATION_CONTENT_MAX_LENGTH} characters.`,
      });
    }
    if (
      (input.channel === "sms" || input.channel === "email") &&
      input.direction === "outbound" &&
      !input.requestId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requestId"],
        message: "A stable request ID is required to send an external message.",
      });
    }
  });

export const communicationsRouter = createRouter({
  settings: protectedProcedure.query(async ({ ctx }) => ({
    timezone: await practiceTimeZone(ctx),
  })),

  list: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid().optional(),
        status: z
          .enum(["pending", "sent", "delivered", "read", "failed"])
          .optional(),
        inboxFilter: z.enum(["all", "unread", "sent"]).optional(),
        limit: z.number().int().min(1).max(100).default(25),
        offset: listOffsetInput,
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(communications.practiceId, ctx.practiceId),
        activePracticePredicate(ctx.practiceId),
        isNull(communications.deletedAt),
        or(
          isNull(communications.clientId),
          and(
            eq(clients.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(clients.deletedAt),
          ),
        )!,
      ];

      if (input.clientId) {
        conditions.push(eq(communications.clientId, input.clientId));
      }

      if (input.status) {
        conditions.push(eq(communications.status, input.status));
      }

      if (input.inboxFilter === "unread") {
        conditions.push(
          eq(communications.direction, "inbound"),
          isNull(communications.readAt),
          ne(communications.status, "read"),
        );
      } else if (input.inboxFilter === "sent") {
        conditions.push(
          eq(communications.direction, "outbound"),
          or(
            eq(communications.status, "sent"),
            eq(communications.status, "delivered"),
            eq(communications.status, "read"),
          )!,
        );
      }

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            id: communications.id,
            clientId: communications.clientId,
            channel: communications.channel,
            direction: communications.direction,
            subject: communications.subject,
            content: communications.content,
            status: communications.status,
            assignedTo: communications.assignedTo,
            assignedToName: users.name,
            readAt: communications.readAt,
            providerMessageId: communications.providerMessageId,
            createdAt: communications.createdAt,
            clientFirstName: clients.firstName,
            clientLastName: clients.lastName,
          })
          .from(communications)
          .leftJoin(
            clients,
            and(
              eq(communications.clientId, clients.id),
              eq(clients.practiceId, ctx.practiceId),
              activePracticePredicate(ctx.practiceId),
              isNull(clients.deletedAt),
            ),
          )
          .leftJoin(
            users,
            and(
              eq(communications.assignedTo, users.id),
              eq(users.practiceId, ctx.practiceId),
              activePracticePredicate(ctx.practiceId),
              isNull(users.deletedAt),
            ),
          )
          .where(and(...conditions))
          .orderBy(desc(communications.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(communications)
          .leftJoin(
            clients,
            and(
              eq(communications.clientId, clients.id),
              eq(clients.practiceId, ctx.practiceId),
              activePracticePredicate(ctx.practiceId),
              isNull(clients.deletedAt),
            ),
          )
          .where(and(...conditions)),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
      };
    }),

  listConversations: protectedProcedure
    .input(
      z.object({
        inboxFilter: z.enum(["all", "unread", "sent"]).optional(),
        channelFilter: z
          .enum(["all", "whatsapp", "email", "sms", "portal", "phone"])
          .optional(),
        suppliersOnly: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).default(25),
        offset: listOffsetInput,
      }),
    )
    .query(async ({ ctx, input }) => {
      const filterClause =
        input.inboxFilter === "unread"
          ? sql`and c.direction = 'inbound' and c.read_at is null and c.status <> 'read'`
          : input.inboxFilter === "sent"
            ? sql`and c.direction = 'outbound' and c.status in ('sent', 'delivered', 'read')`
            : sql``;

      // WhatsApp rows are stored as channel='sms' with dedupe_key 'wa:*'.
      const channelClause =
        input.channelFilter === "whatsapp"
          ? sql`and c.channel = 'sms' and c.dedupe_key like 'wa:%'`
          : input.channelFilter === "sms"
            ? sql`and c.channel = 'sms' and (c.dedupe_key is null or c.dedupe_key not like 'wa:%')`
            : input.channelFilter === "email"
              ? sql`and c.channel = 'email'`
              : input.channelFilter === "portal"
                ? sql`and c.channel = 'portal'`
                : input.channelFilter === "phone"
                  ? sql`and c.channel = 'phone'`
                  : sql``;

      // Supplier filter: conversations whose latest message carries inbound
      // attachments metadata (supplier PDF invoices arrive as email
      // attachments and embed <!--INBOX_ATTACHMENTS:…--> in the content).
      const supplierClause = input.suppliersOnly
        ? sql`and c.content like '%INBOX_ATTACHMENTS%'`
        : sql``;

      const result = await ctx.db.execute(sql`
        with base as (
          select
            c.id as "id",
            c.client_id as "clientId",
            c.channel as "channel",
            c.direction as "direction",
            c.subject as "subject",
            c.content as "content",
            c.status as "status",
            coalesce(latest_assignment.assigned_to, c.assigned_to) as "assignedTo",
            coalesce(latest_assignment.assigned_to_name, u.name) as "assignedToName",
            c.read_at as "readAt",
            c.provider_message_id as "providerMessageId",
            c.dedupe_key as "dedupeKey",
            c.created_at as "createdAt",
            cl.first_name as "clientFirstName",
            cl.last_name as "clientLastName",
            latest_patient.id as "patientId",
            latest_patient.name as "patientName",
            latest_patient.species as "patientSpecies",
            exists (
              select 1
              from patients sympathy_p
              where sympathy_p.practice_id = ${ctx.practiceId}
                and sympathy_p.client_id = c.client_id
                and sympathy_p.status = 'deceased'
                and sympathy_p.deleted_at is null
            ) as "sympathyActive",
            coalesce(
              case when cl.id is not null then concat(cl.first_name, ' ', cl.last_name) end,
              substring(c.content from 'From:[ \t]*([^\r\n]+)'),
              c.subject,
              'Neznámy odosielateľ'
            ) as "senderDisplay",
            coalesce(
              c.client_id::text,
              substring(c.content from 'From:[ \t]*([^\r\n]+)'),
              c.id::text
            ) as "senderGroupKey",
            count(*) filter (
              where c.direction = 'inbound'
                and c.read_at is null
                and c.status <> 'read'
            ) over (
              partition by coalesce(
                c.client_id::text,
                substring(c.content from 'From:[ \t]*([^\r\n]+)'),
                c.id::text
              )
            ) as "unreadCount",
            row_number() over (
              partition by coalesce(
                c.client_id::text,
                substring(c.content from 'From:[ \t]*([^\r\n]+)'),
                c.id::text
              )
              order by c.created_at desc, c.id desc
            ) as row_num
          from communications c
          left join clients cl
            on c.client_id = cl.id
            and cl.practice_id = ${ctx.practiceId}
            and cl.deleted_at is null
          left join users u
            on c.assigned_to = u.id
            and u.practice_id = ${ctx.practiceId}
            and u.deleted_at is null
          left join lateral (
            select
              ca.assigned_to,
              au.name as assigned_to_name
            from communications ca
            left join users au
              on ca.assigned_to = au.id
              and au.practice_id = ${ctx.practiceId}
              and au.deleted_at is null
            where ca.practice_id = ${ctx.practiceId}
              and ca.client_id = c.client_id
              and ca.assigned_to is not null
              and ca.deleted_at is null
            order by ca.created_at desc, ca.id desc
            limit 1
          ) latest_assignment on true
          left join lateral (
            select p.id, p.name, p.species
            from patients p
            where p.practice_id = ${ctx.practiceId}
              and p.client_id = c.client_id
              and p.deleted_at is null
            order by p.created_at desc, p.id desc
            limit 1
          ) latest_patient on true
          where c.practice_id = ${ctx.practiceId}
            and c.deleted_at is null
            and exists (
              select 1
              from practices p
              where p.id = ${ctx.practiceId}
                and p.deleted_at is null
            )
            and (c.client_id is null or cl.id is not null)
            ${filterClause}
            ${channelClause}
            ${supplierClause}
        ),
        latest as (
          select *
          from base
          where row_num = 1
        )
        select
          latest."id",
          latest."clientId",
          latest."channel",
          latest."direction",
          latest."subject",
          latest."content",
          latest."status",
          latest."assignedTo",
          latest."assignedToName",
          latest."readAt",
          latest."providerMessageId",
          latest."createdAt",
          latest."clientFirstName",
          latest."clientLastName",
          latest."patientId",
          latest."patientName",
          latest."patientSpecies",
          latest."sympathyActive",
          latest."unreadCount",
          latest."senderDisplay",
          latest."senderGroupKey",
          count(*) over() as "total"
        from latest
        order by "createdAt" desc, "id" desc
        limit ${input.limit}
        offset ${input.offset}
      `);

      const rows = rowsFromExecute<InboxConversationRow>(result);
      return {
        items: rows.map(({ total: _total, unreadCount, sympathyActive, ...row }) => ({
          ...row,
          sympathyActive: Boolean(sympathyActive),
          unreadCount: dbNumber(unreadCount),
        })),
        total: dbNumber(rows[0]?.total),
      };
    }),

  getBySender: protectedProcedure
    .input(
      z.object({
        senderGroupKey: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.execute(sql`
        select
          c.id,
          c.client_id as "clientId",
          c.channel,
          c.direction,
          c.subject,
          c.content,
          c.status,
          c.assigned_to as "assignedTo",
          u.name as "assignedToName",
          c.read_at as "readAt",
          c.provider_message_id as "providerMessageId",
          c.dedupe_key as "dedupeKey",
          c.created_at as "createdAt"
        from communications c
        left join users u
          on c.assigned_to = u.id
          and u.practice_id = ${ctx.practiceId}
          and u.deleted_at is null
        where c.practice_id = ${ctx.practiceId}
          and c.deleted_at is null
          and (
            coalesce(
              c.client_id::text,
              substring(c.content from 'From:[ \t]*([^\r\n]+)'),
              c.id::text
            ) = ${input.senderGroupKey}
            or c.id::text = ${input.senderGroupKey}
          )
        order by c.created_at asc, c.id asc;
      `);
      return result as unknown as Array<{
        id: string;
        clientId: string | null;
        channel: string;
        direction: string;
        subject: string | null;
        content: string | null;
        status: string;
        assignedTo: string | null;
        assignedToName: string | null;
        readAt: Date | string | null;
        providerMessageId: string | null;
        dedupeKey: string | null;
        createdAt: Date | string | null;
      }>;
    }),

  getByClient: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: communications.id,
          channel: communications.channel,
          direction: communications.direction,
          subject: communications.subject,
          content: communications.content,
          status: communications.status,
          assignedTo: communications.assignedTo,
          assignedToName: users.name,
          readAt: communications.readAt,
          providerMessageId: communications.providerMessageId,
          dedupeKey: communications.dedupeKey,
          createdAt: communications.createdAt,
        })
        .from(communications)
        .innerJoin(
          clients,
          and(
            eq(communications.clientId, clients.id),
            eq(clients.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(clients.deletedAt),
          ),
        )
        .leftJoin(
          users,
          and(
            eq(communications.assignedTo, users.id),
            eq(users.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(users.deletedAt),
          ),
        )
        .where(
          and(
            eq(communications.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            eq(communications.clientId, input.clientId),
            isNull(communications.deletedAt),
          ),
        )
        .orderBy(desc(communications.createdAt));
    }),

  markClientRead: inboxStaffProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [client] = await ctx.db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.id, input.clientId),
            eq(clients.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(clients.deletedAt),
          ),
        )
        .limit(1);

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      const updated = await ctx.db
        .update(communications)
        .set({ status: "read", readAt: new Date() })
        .where(
          and(
            eq(communications.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            eq(communications.clientId, input.clientId),
            eq(communications.direction, "inbound"),
            isNull(communications.readAt),
            ne(communications.status, "read"),
            isNull(communications.deletedAt),
          ),
        )
        .returning({ id: communications.id });

      return { ok: true, updated: updated.length };
    }),

  assignClient: inboxStaffProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        action: z.enum(["assign_to_me", "unassign"]),
        expectedAssignedTo: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${inboxAssignmentLockKey(
            ctx.practiceId,
            input.clientId,
          )}::text))`,
        );

        const [client] = await tx
          .select({ id: clients.id })
          .from(clients)
          .where(
            and(
              eq(clients.id, input.clientId),
              eq(clients.practiceId, ctx.practiceId),
              activePracticePredicate(ctx.practiceId),
              isNull(clients.deletedAt),
            ),
          )
          .limit(1);

        if (!client) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Client not found",
          });
        }

        const [latest] = await tx
          .select({ assignedTo: communications.assignedTo })
          .from(communications)
          .where(
            and(
              eq(communications.practiceId, ctx.practiceId),
              activePracticePredicate(ctx.practiceId),
              eq(communications.clientId, input.clientId),
              isNotNull(communications.assignedTo),
              isNull(communications.deletedAt),
            ),
          )
          .orderBy(desc(communications.createdAt), desc(communications.id))
          .limit(1);

        const currentAssignedTo = latest?.assignedTo ?? null;
        if (currentAssignedTo !== input.expectedAssignedTo) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Conversation assignment changed. Refresh and try again.",
          });
        }

        const assignedTo = input.action === "assign_to_me" ? ctx.user.id : null;
        const updated = await tx
          .update(communications)
          .set({ assignedTo })
          .where(
            and(
              eq(communications.practiceId, ctx.practiceId),
              activePracticePredicate(ctx.practiceId),
              eq(communications.clientId, input.clientId),
              isNull(communications.deletedAt),
            ),
          )
          .returning({ id: communications.id });

        return {
          ok: true,
          assignedTo,
          assignedToName: assignedTo ? ctx.user.name : null,
          updated: updated.length,
        };
      });
    }),

  suggestClientAction: inboxStaffProcedure
    .input(
      z.object({
        senderGroupKey: z.string().min(1),
        content: z.string().optional().nullable(),
        subject: z.string().optional().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const parsed = parseSenderIdentity(input.senderGroupKey, input.content);

      const matchedCandidates: Array<{
        id: string;
        firstName: string;
        lastName: string;
        email: string | null;
        phone: string | null;
        matchReason: string;
      }> = [];

      if (parsed.email) {
        const emailMatches = await ctx.db
          .select({
            id: clients.id,
            firstName: clients.firstName,
            lastName: clients.lastName,
            email: clients.email,
            phone: clients.phone,
          })
          .from(clients)
          .where(
            and(
              eq(clients.practiceId, ctx.practiceId),
              activePracticePredicate(ctx.practiceId),
              isNull(clients.deletedAt),
              ilike(clients.email, parsed.email),
            ),
          )
          .limit(3);

        emailMatches.forEach((m) => {
          matchedCandidates.push({
            ...m,
            matchReason: "Zhodný email",
          });
        });
      }

      if (parsed.lastName && parsed.lastName !== "Klient") {
        const nameMatches = await ctx.db
          .select({
            id: clients.id,
            firstName: clients.firstName,
            lastName: clients.lastName,
            email: clients.email,
            phone: clients.phone,
          })
          .from(clients)
          .where(
            and(
              eq(clients.practiceId, ctx.practiceId),
              activePracticePredicate(ctx.practiceId),
              isNull(clients.deletedAt),
              ilike(clients.lastName, parsed.lastName),
            ),
          )
          .limit(4);

        nameMatches.forEach((m) => {
          if (!matchedCandidates.some((existing) => existing.id === m.id)) {
            const sameFirst = parsed.firstName && m.firstName.toLowerCase().includes(parsed.firstName.toLowerCase());
            matchedCandidates.push({
              ...m,
              matchReason: sameFirst ? "Zhoda mena a priezviska" : "Rovnaké priezvisko",
            });
          }
        });
      }

      return {
        suggestedNewClient: {
          firstName: parsed.firstName || "",
          lastName: parsed.lastName || "",
          email: parsed.email || "",
          phone: "",
        },
        matchedCandidates,
      };
    }),

  /**
   * AI reply assistant (Modul 5 — Smart Reply Box).
   *
   * Generates a draft reply with clinical context (client + patients + recent
   * thread) for staff review. Human-in-the-loop: the draft is returned as an
   * editable concept (`requiresReview: true`) and is NEVER sent automatically.
   *
   * Safety gates:
   *  - Sympathy Gate: any deceased patient of the client forces pietny
   *    (condolence) tone; AI output that slips into cheerful/marketing tone
   *    is discarded and replaced by the deterministic condolence template.
   *  - Prompt injection: all client-originated text travels inside
   *    `<db_record>` boundaries and can never rewrite system instructions.
   */
  suggestReply: inboxStaffProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        locale: z.enum(["sk", "en"]).default("sk"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const limited = await rateLimit({
        key: `inbox-reply:${ctx.practiceId}:actor:${ctx.user.id}`,
        limit: 20,
        windowMs: 60_000,
      });
      if (!limited.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many reply suggestions at once. Wait a minute and try again.",
        });
      }

      const [client] = await ctx.db
        .select({
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
        })
        .from(clients)
        .where(
          and(
            eq(clients.id, input.clientId),
            eq(clients.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(clients.deletedAt),
          ),
        )
        .limit(1);
      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      const clientPatients = await ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
          status: patients.status,
        })
        .from(patients)
        .where(
          and(
            eq(patients.clientId, input.clientId),
            eq(patients.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(patients.deletedAt),
          ),
        )
        .orderBy(desc(patients.createdAt))
        .limit(10);

      const sympathy = evaluateSympathyGate(clientPatients);

      const recent = await ctx.db
        .select({
          direction: communications.direction,
          channel: communications.channel,
          content: communications.content,
        })
        .from(communications)
        .where(
          and(
            eq(communications.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            eq(communications.clientId, input.clientId),
            isNull(communications.deletedAt),
          ),
        )
        .orderBy(desc(communications.createdAt))
        .limit(6);

      const clientName = `${client.firstName} ${client.lastName}`.trim() || null;
      const system = inboxReplySystemPrompt(input.locale, sympathy.sympathyActive);
      const prompt = buildInboxReplyPrompt({
        clientName,
        patients: clientPatients,
        recentMessages: [...recent].reverse(),
        locale: input.locale,
        sympathyActive: sympathy.sympathyActive,
      });

      let modelId = "template-fallback";
      let usedAi = false;
      let aiDraft: string | null = null;
      try {
        const featureConfig = await resolveFeatureConfig(
          ctx.db,
          ctx.practiceId,
          "assistant",
        );
        modelId = featureConfig.modelId;
        const model = await resolvePracticeLanguageModel(
          ctx.db,
          ctx.practiceId,
          "assistant",
        );
        const result = await generateText({
          model,
          system,
          prompt,
          temperature: 0.3,
        });
        const text = result.text.trim();
        if (text.length > 0) {
          aiDraft = text.slice(0, 2000);
          usedAi = true;
          await recordUsage({ practiceId: ctx.practiceId, kind: "ai_run" });
        }
      } catch {
        aiDraft = null;
      }

      // Sympathy enforcement: a grieving owner must never receive a cheerful
      // or marketing-toned draft. Reject violating AI output.
      let sympathyFiltered = false;
      let draft = aiDraft;
      if (sympathy.sympathyActive && draft && draftViolatesSympathy(draft)) {
        draft = null;
        sympathyFiltered = true;
      }
      if (!draft) {
        draft = fallbackReplyDraft({
          clientFirstName: client.firstName,
          patientName: clientPatients[0]?.name ?? null,
          sympathyActive: sympathy.sympathyActive,
          locale: input.locale,
        });
        if (!usedAi || sympathyFiltered) {
          usedAi = false;
          if (!sympathyFiltered) modelId = "template-fallback";
        }
      }

      return {
        draft,
        sympathyActive: sympathy.sympathyActive,
        sympathyFiltered,
        deceasedPatients: sympathy.deceasedPatients,
        model: modelId,
        usedAi,
        requiresReview: true as const,
      };
    }),

  /**
   * Supplier-invoice flag for a single communication (shared heuristic with
   * the inbox UI badge). Pure metadata check — no AI, no side effects.
   */
  detectSupplierInvoice: protectedProcedure
    .input(z.object({ communicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [comm] = await ctx.db
        .select({
          subject: communications.subject,
          content: communications.content,
        })
        .from(communications)
        .where(
          and(
            eq(communications.id, input.communicationId),
            eq(communications.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(communications.deletedAt),
          ),
        )
        .limit(1);
      if (!comm) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Communication not found" });
      }
      return detectSupplierInvoice(comm.content, comm.subject);
    }),

  createClientAndLink: inboxStaffProcedure
    .input(
      z.object({
        communicationId: z.string().uuid(),
        senderGroupKey: z.string().optional(),
        firstName: z.string().trim().min(1, "Meno je povinné").max(128),
        lastName: z.string().trim().min(1, "Priezvisko je povinné").max(128),
        email: z.string().trim().email().optional().or(z.literal("")),
        phone: z.string().trim().max(32).optional().or(z.literal("")),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedEmail = input.email ? input.email.toLowerCase() : null;
      const normalizedPhone = input.phone ? normalizeE164(input.phone) || input.phone : null;

      const [newClient] = await ctx.db
        .insert(clients)
        .values({
          practiceId: ctx.practiceId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: normalizedEmail,
          phone: normalizedPhone,
        })
        .returning({
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          email: clients.email,
        });

      if (!newClient) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nepodarilo sa vytvoriť profil klienta",
        });
      }

      await ctx.db
        .update(communications)
        .set({
          clientId: newClient.id,
          assignedTo: ctx.user.id,
        })
        .where(
          and(
            eq(communications.id, input.communicationId),
            eq(communications.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(communications.deletedAt),
          ),
        );

      if (input.senderGroupKey) {
        await ctx.db
          .update(communications)
          .set({
            clientId: newClient.id,
            assignedTo: ctx.user.id,
          })
          .where(
            and(
              eq(communications.practiceId, ctx.practiceId),
              activePracticePredicate(ctx.practiceId),
              isNull(communications.clientId),
              isNull(communications.deletedAt),
              or(
                eq(communications.id, input.communicationId),
                ilike(communications.content, "%" + input.senderGroupKey + "%"),
              ),
            ),
          );
      }

      return {
        client: newClient,
      };
    }),

  linkCommunicationToClient: inboxStaffProcedure
    .input(
      z.object({
        communicationId: z.string().uuid(),
        clientId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [comm] = await ctx.db
        .select({
          id: communications.id,
          clientId: communications.clientId,
          direction: communications.direction,
          content: communications.content,
        })
        .from(communications)
        .where(
          and(
            eq(communications.id, input.communicationId),
            eq(communications.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(communications.deletedAt),
          ),
        )
        .limit(1);

      if (!comm) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Communication not found",
        });
      }

      if (comm.clientId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Communication is already linked to a client",
        });
      }

      if (comm.direction !== "inbound") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only inbound messages can be linked from the inbox",
        });
      }

      const [client] = await ctx.db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.id, input.clientId),
            eq(clients.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(clients.deletedAt),
          ),
        )
        .limit(1);

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      const [latestAssignment] = await ctx.db
        .select({ assignedTo: communications.assignedTo })
        .from(communications)
        .where(
          and(
            eq(communications.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            eq(communications.clientId, input.clientId),
            isNotNull(communications.assignedTo),
            isNull(communications.deletedAt),
          ),
        )
        .orderBy(desc(communications.createdAt))
        .limit(1);
      const assignedTo = latestAssignment?.assignedTo ?? ctx.user.id;

      const [updated] = await ctx.db
        .update(communications)
        .set({
          clientId: input.clientId,
          assignedTo,
        })
        .where(
          and(
            eq(communications.id, input.communicationId),
            eq(communications.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(communications.clientId),
            isNull(communications.deletedAt),
          ),
        )
        .returning({
          id: communications.id,
          clientId: communications.clientId,
          assignedTo: communications.assignedTo,
        });

      if (!updated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Communication was already linked by another staff member",
        });
      }

      return {
        ok: true,
        communicationId: updated.id,
        clientId: updated.clientId,
        assignedTo: updated.assignedTo,
        assignedToName:
          updated.assignedTo === ctx.user.id ? ctx.user.name : null,
      };
    }),

  create: inboxStaffProcedure
    .input(createCommunicationInput)
    .mutation(async ({ ctx, input }) => {
      const content = input.content.trim();
      if (!content) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Message content is required",
        });
      }

      const isDeliverableOutbound =
        input.direction === "outbound" &&
        (input.channel === "sms" || input.channel === "email" || input.channel === "whatsapp");

      if (isDeliverableOutbound) {
        if (
          !(await lockPracticeForExternalSideEffects(
            ctx.db,
            ctx.practiceId,
          ))
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: RECOVERY_HOLD_BLOCK_MESSAGE,
          });
        }
      }

      const [client] = await ctx.db
        .select({
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          email: clients.email,
          phone: clients.phone,
          smsConsent: clients.smsConsent,
          emailSuppressionReason: emailSuppressions.reason,
        })
        .from(clients)
        .leftJoin(
          emailSuppressions,
          and(
            eq(emailSuppressions.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            sql`${emailSuppressions.email} = lower(trim(${clients.email}))`,
            isNull(emailSuppressions.deletedAt),
          ),
        )
        .where(
          and(
            eq(clients.id, input.clientId),
            eq(clients.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            isNull(clients.deletedAt),
          ),
        )
        .limit(1);

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      const [practice] = await ctx.db
        .select({
          name: practices.name,
          timezone: practices.timezone,
          email: practices.email,
          createdAt: practices.createdAt,
        })
        .from(practices)
        .where(activePracticeWhere(ctx.practiceId))
        .limit(1);

      if (!practice) {
        throw practiceNotFound();
      }

      const practiceName = practice.name?.trim() || "OpenVPM";
      const replyToEmail = validReplyToEmail(practice.email);
      const subject =
        input.channel === "email"
          ? input.subject?.trim() || `Message from ${practiceName}`
          : input.subject?.trim() || undefined;

      if (input.direction === "outbound" && input.channel === "email") {
        await assertOutboundEmailAllowed({
          practiceId: ctx.practiceId,
          practiceCreatedAt: practice.createdAt,
          userId: ctx.user.id,
          userEmailVerifiedAt: ctx.user.emailVerifiedAt,
          ip: ctx.ip,
          operation: "inbox",
        });
      }

      const [latestAssignment] = await ctx.db
        .select({ assignedTo: communications.assignedTo })
        .from(communications)
        .where(
          and(
            eq(communications.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            eq(communications.clientId, input.clientId),
            isNotNull(communications.assignedTo),
            isNull(communications.deletedAt),
          ),
        )
        .orderBy(desc(communications.createdAt))
        .limit(1);
      const assignedTo = latestAssignment?.assignedTo ?? ctx.user.id;

      let smsRecipient: string | null = null;
      let smsSenderLocationId: string | undefined;
      if (input.direction === "outbound" && (input.channel === "sms" || input.channel === "whatsapp")) {
        if (input.patientId) {
          const [patient] = await ctx.db
            .select({ status: patients.status })
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
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Sympathy Gate: Cannot send messages for a deceased patient.",
            });
          }
        } else {
          const clientPatients = await ctx.db
            .select({ status: patients.status })
            .from(patients)
            .where(
              and(
                eq(patients.clientId, input.clientId),
                eq(patients.practiceId, ctx.practiceId),
                isNull(patients.deletedAt),
              ),
            );
          if (
            clientPatients.length > 0 &&
            clientPatients.every((p) => p.status === "deceased")
          ) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Sympathy Gate: Cannot send messages for a deceased patient.",
            });
          }
        }
        if (!client.phone) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Client does not have a phone number on file",
          });
        }
        if (!client.smsConsent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Client has not consented to SMS messages",
          });
        }
        if (isQuietHours(new Date(), practice.timezone)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "SMS sending is blocked during quiet hours",
          });
        }
        smsRecipient = normalizeE164(client.phone);
        if (!smsRecipient) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Client phone number must be a valid E.164 or US/CA number",
          });
        }

        const smsSenders = await ctx.db
          .select({ locationId: locationMessaging.locationId })
          .from(locationMessaging)
          .innerJoin(
            locations,
            and(
              eq(locations.id, locationMessaging.locationId),
              eq(locations.practiceId, ctx.practiceId),
              activePracticePredicate(ctx.practiceId),
              isNull(locations.deletedAt),
            ),
          )
          .where(
            and(
              eq(locationMessaging.practiceId, ctx.practiceId),
              activePracticePredicate(ctx.practiceId),
              isNull(locationMessaging.deletedAt),
              eq(locations.practiceId, ctx.practiceId),
              isNull(locations.deletedAt),
              eq(locationMessaging.enabled, true),
              eq(locationMessaging.registrationStatus, "active"),
              hasNonBlankMessagingSender(),
            ),
          )
          .limit(2);

        const smsSender = smsSenders.length === 1 ? smsSenders[0] : null;

        if (!smsSender) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Set up an active texting number before sending SMS from the inbox",
          });
        }

        smsSenderLocationId = smsSender.locationId;
      }

      const clientEmail =
        input.direction === "outbound" && input.channel === "email"
          ? normalizeEmailSuppressionAddress(client.email)
          : null;
      if (
        input.direction === "outbound" &&
        input.channel === "email" &&
        !clientEmail
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Client does not have an email address on file",
        });
      }
      if (
        input.direction === "outbound" &&
        input.channel === "email" &&
        client.emailSuppressionReason
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: emailSuppressionSendBlockMessage(
            client.emailSuppressionReason,
          ),
        });
      }

      const outboundDedupeKey = isDeliverableOutbound
          ? input.channel === "whatsapp"
            ? `wa:out:${ctx.practiceId}:${input.requestId!}`
            : `${input.channel}:inbox:${ctx.practiceId}:${input.requestId!}`
          : undefined;
      const insertCommunication = async (
        tx: Pick<Database, "insert" | "select">,
      ) => {
        const insert = tx.insert(communications).values({
          practiceId: ctx.practiceId,
          clientId: input.clientId,
          channel: input.channel === "whatsapp" ? "sms" : input.channel,
          direction: input.direction,
          subject,
          content,
          assignedTo,
          dedupeKey: outboundDedupeKey,
          readAt: input.status === "read" ? new Date() : undefined,
          status: isDeliverableOutbound
            ? "pending"
            : (input.status ??
              (input.direction === "outbound"
                ? input.channel === "portal"
                  ? "delivered"
                  : "sent"
                : "pending")),
        });
        if (!outboundDedupeKey) {
          const [communication] = await insert.returning();
          return { communication, replayed: false };
        }

        const [inserted] = await insert
          .onConflictDoNothing({ target: communications.dedupeKey })
          .returning();
        if (inserted) return { communication: inserted, replayed: false };

        const [existing] = await tx
          .select()
          .from(communications)
          .where(
            and(
              eq(communications.practiceId, ctx.practiceId),
              eq(communications.dedupeKey, outboundDedupeKey),
              eq(communications.clientId, input.clientId),
              eq(communications.channel, input.channel === "whatsapp" ? "sms" : input.channel),
              eq(communications.direction, "outbound"),
              isNull(communications.deletedAt),
            ),
          )
          .for("update")
          .limit(1);
        if (!existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Message request ID is already in use.",
          });
        }
        if (
          existing.content !== content ||
          (existing.subject ?? undefined) !== subject
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Message request ID was already used for different message data.",
          });
        }
        return { communication: existing, replayed: true };
      };
      const durableSmsCommunication =
        isDeliverableOutbound && input.channel === "sms";
      const claim = durableSmsCommunication
        ? await withDurableSmsCommunication(ctx.practiceId, insertCommunication)
        : await insertCommunication(ctx.db);
      const comm = claim.communication;

      if (!comm) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create communication",
        });
      }

      if (
        claim.replayed &&
        new Set(["sent", "delivered", "read"]).has(comm.status)
      ) {
        return comm;
      }
      if (claim.replayed && comm.status === "failed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This message request failed definitively. Start a new send to create a new request ID.",
        });
      }

      if (!isDeliverableOutbound) return comm;

      let deliveryResult: {
        success: boolean;
        id?: string;
        sid?: string;
        error?: string;
        outcome?: "accepted" | "definite_failure" | "outcome_unknown";
      };
      let providerMessageId: string | undefined;
      try {
        if (input.channel === "sms" || input.channel === "whatsapp") {
          deliveryResult = await sendSms({
            to: smsRecipient!,
            body: content,
            practiceId: ctx.practiceId,
            locationId: smsSenderLocationId,
            clientId: input.clientId,
            communicationId: comm.id,
            source: "inbox",
            sourceId: input.requestId!,
            idempotencyKey: outboundDedupeKey!,
          });
          providerMessageId = deliveryResult.sid;
        } else {
          deliveryResult = await sendEmail({
            to: clientEmail!,
            subject: subject!,
            html: renderComposedEmail({
              practiceName,
              content,
              replyToEmail,
            }),
            ...(replyToEmail ? { replyTo: replyToEmail } : {}),
            idempotencyKey: outboundDedupeKey!,
          });
          providerMessageId = deliveryResult.id;
        }
      } catch (error) {
        deliveryResult = {
          success: false,
          outcome:
            (input.channel === "sms" || input.channel === "whatsapp") ? "outcome_unknown" : "definite_failure",
          error:
            error instanceof Error && error.message
              ? error.message
              : "Message delivery failed",
        };
      }

      if (
        input.channel === "sms" &&
        !deliveryResult.success &&
        deliveryResult.outcome === "outcome_unknown"
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "The texting provider outcome is unknown. This message will not be retried automatically; contact OpenVPM support before sending it again.",
        });
      }

      const status = deliveryResult.success ? "sent" : "failed";
      const updatePatch: {
        status: "sent" | "failed";
        providerMessageId?: string;
      } = { status };
      if (providerMessageId) {
        updatePatch.providerMessageId = providerMessageId;
      }

      const projectCommunication = (tx: Pick<Database, "update">) =>
        tx
          .update(communications)
          .set(updatePatch)
          .where(
            and(
              eq(communications.id, comm.id),
              eq(communications.practiceId, ctx.practiceId),
              activePracticePredicate(ctx.practiceId),
              or(
                eq(communications.status, "pending"),
                and(
                  eq(communications.status, "sent"),
                  providerMessageId
                    ? eq(communications.providerMessageId, providerMessageId)
                    : undefined,
                ),
              ),
              isNull(communications.deletedAt),
            ),
          )
          .returning();
      const [updated] = durableSmsCommunication
        ? await withDurableSmsCommunication(
            ctx.practiceId,
            projectCommunication,
          )
        : await projectCommunication(ctx.db);

      if (!updated) {
        await alertOps(
          "Communication delivery status update failed",
          [
            `practice=${ctx.practiceId}`,
            `communication=${comm.id}`,
            `channel=${input.channel}`,
            `status=${status}`,
            `providerMessageId=${providerMessageId ?? "none"}`,
          ].join(" "),
        );

        if (deliveryResult.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Message was delivered, but the inbox status could not be updated. Refresh before sending again.",
          });
        }
      }

      if (!deliveryResult.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: deliveryResult.error ?? "Message delivery failed",
        });
      }

      return updated;
    }),

  updateStatus: inboxStaffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["pending", "sent", "delivered", "read", "failed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.status !== "read") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Inbox status updates can only mark messages read",
        });
      }

      const [comm] = await ctx.db
        .update(communications)
        .set({
          status: "read",
          readAt: new Date(),
        })
        .where(
          and(
            eq(communications.id, input.id),
            eq(communications.practiceId, ctx.practiceId),
            activePracticePredicate(ctx.practiceId),
            eq(communications.direction, "inbound"),
            isNull(communications.readAt),
            ne(communications.status, "read"),
            isNull(communications.deletedAt),
          ),
        )
        .returning();
      if (!comm) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Unread inbound communication not found",
        });
      }
      return comm;
    }),

  replyToUnmatched: inboxStaffProcedure
    .input(
      z.object({
        communicationId: z.string().uuid(),
        senderGroupKey: z.string().optional(),
        toEmail: z.string().email(),
        subject: z.string().trim().max(COMMUNICATION_SUBJECT_MAX_LENGTH).optional(),
        content: z
          .string()
          .trim()
          .min(1, 'Message content is required')
          .max(COMMUNICATION_CONTENT_MAX_LENGTH),
        requestId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const msgContent = input.content.trim();

      if (!(await lockPracticeForExternalSideEffects(ctx.db, ctx.practiceId))) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: RECOVERY_HOLD_BLOCK_MESSAGE });
      }

      const [practice] = await ctx.db
        .select({ name: practices.name, email: practices.email, createdAt: practices.createdAt })
        .from(practices)
        .where(activePracticeWhere(ctx.practiceId))
        .limit(1);

      if (!practice) throw practiceNotFound();

      await assertOutboundEmailAllowed({
        practiceId: ctx.practiceId,
        practiceCreatedAt: practice.createdAt,
        userId: ctx.user.id,
        userEmailVerifiedAt: ctx.user.emailVerifiedAt,
        ip: ctx.ip,
        operation: 'inbox',
      });

      const practiceName = practice.name?.trim() || 'OpenVPM';
      const replyToEmail = validReplyToEmail(practice.email);
      const replySubject = input.subject?.trim() || ('Message from ' + practiceName);
      const dedupeKey = 'email:inbox:' + ctx.practiceId + ':' + input.requestId;

      const [inserted] = await ctx.db
        .insert(communications)
        .values({
          practiceId: ctx.practiceId,
          clientId: null,
          channel: 'email',
          direction: 'outbound',
          subject: replySubject,
          content: msgContent,
          assignedTo: ctx.user.id,
          dedupeKey,
          status: 'pending',
        })
        .onConflictDoNothing({ target: communications.dedupeKey })
        .returning();

      let comm = inserted;
      if (!comm) {
        const [existing] = await ctx.db
          .select()
          .from(communications)
          .where(and(eq(communications.practiceId, ctx.practiceId), eq(communications.dedupeKey, dedupeKey)))
          .limit(1);
        if (!existing) throw new TRPCError({ code: 'CONFLICT', message: 'Message request ID is already in use.' });
        comm = existing;
      }

      let deliveryResult: { success: boolean; id?: string; error?: string };
      let providerMessageId: string | undefined;

      try {
        deliveryResult = await sendEmail({
          to: input.toEmail,
          subject: replySubject,
          html: renderComposedEmail({ practiceName, content: msgContent, replyToEmail }),
          ...(replyToEmail ? { replyTo: replyToEmail } : {}),
          idempotencyKey: dedupeKey,
        });
        providerMessageId = deliveryResult.id;
      } catch (error) {
        deliveryResult = { success: false, error: error instanceof Error ? error.message : 'Message delivery failed' };
      }

      const deliveryStatus = deliveryResult.success ? ('sent' as const) : ('failed' as const);
      const updatePatch: { status: 'sent' | 'failed'; providerMessageId?: string } = { status: deliveryStatus };
      if (providerMessageId) updatePatch.providerMessageId = providerMessageId;

      await ctx.db
        .update(communications)
        .set(updatePatch)
        .where(and(eq(communications.id, comm.id), eq(communications.practiceId, ctx.practiceId), isNull(communications.deletedAt)));

      if (!deliveryResult.success) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: deliveryResult.error ?? 'Message delivery failed' });
      }

      return { ok: true, communicationId: comm.id };
    }),
  parseAttachmentAsInvoice: inboxStaffProcedure
    .input(
      z.object({
        communicationId: z.string().uuid(),
        attachmentId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Load communication to get providerMessageId (email_id from Resend)
      const [comm] = await ctx.db
        .select({
          id: communications.id,
          practiceId: communications.practiceId,
          providerMessageId: communications.providerMessageId,
          channel: communications.channel,
        })
        .from(communications)
        .where(
          and(
            eq(communications.id, input.communicationId),
            eq(communications.practiceId, ctx.practiceId),
            isNull(communications.deletedAt)
          )
        )
        .limit(1);

      if (!comm) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Communication not found" });
      }
      if (comm.channel !== "email") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only email attachments are supported" });
      }
      if (!comm.providerMessageId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No provider email ID for this communication" });
      }

      // 2. Fetch PDF binary from Resend receiving API
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Resend API key not configured" });

      const attRes = await fetch(
        `https://api.resend.com/emails/receiving/${comm.providerMessageId}/attachments/${input.attachmentId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (!attRes.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to fetch attachment from Resend: ${attRes.status}`,
        });
      }

      const attData = (await attRes.json()) as { download_url?: string };
      const downloadUrl = attData.download_url;
      if (!downloadUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Resend attachment download URL not found",
        });
      }

      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to download PDF binary from Resend CDN: ${fileRes.status}`,
        });
      }

      const pdfBuffer = Buffer.from(await fileRes.arrayBuffer());

      // 3. Parse via AI + rule-based fallback
      // Resolve AI config from practice settings (Nastavenia → AI)
      let aiConfig: InvoiceParserAiConfig | undefined;
      try {
        const resolved = await resolveFeatureConfig(ctx.db, ctx.practiceId, "invoiceParser");
        if (resolved.baseUrl && resolved.apiKey) {
          aiConfig = {
            baseUrl: resolved.baseUrl,
            apiKey: resolved.apiKey,
            model: resolved.modelId,
          };
        }
      } catch (err) {
        console.warn("[parseAttachmentAsInvoice] Could not resolve AI config, using rule-based only:", err);
      }

      const extraction = await parsePdfInvoice(pdfBuffer, aiConfig);

      return extraction;
    }),

});
