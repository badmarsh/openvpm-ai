import { NextResponse } from "next/server";
import Twilio from "twilio";
import { and, eq, ilike, isNull } from "drizzle-orm";
import { appBaseUrl } from "@/lib/app-url";
import { readRequestTextWithLimit } from "@/lib/request-json";
import {
  MESSAGING_WEBHOOK_BODY_MAX_BYTES,
  messagingWebhookContentLengthTooLarge,
} from "@/lib/messaging-webhook-limits";
import { normalizeE164 } from "@/lib/messaging";
import { envValue } from "@/lib/messaging/env";
import { db } from "@openpims/db/client";
import { clients, communications, extWhatsappMessages, practices } from "@openpims/db";
import { withSystem, withTenant } from "@/lib/tenant-db";
import { latestAssignedToForClient } from "@/lib/communications/assignment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Strip the "whatsapp:" prefix Twilio prepends to WA numbers. */
function normalizeWaNumber(raw: string | undefined): string | null {
  if (!raw) return null;
  const stripped = raw.replace(/^whatsapp:/i, "");
  return normalizeE164(stripped);
}

function payloadTooLargeResponse() {
  return NextResponse.json(
    { error: "WhatsApp webhook payload too large" },
    { status: 413 },
  );
}

function nonBlankParam(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requestValidationUrls(request: Request): string[] {
  const url = new URL(request.url);
  const canonical = new URL(`${url.pathname}${url.search}`, appBaseUrl());
  return Array.from(new Set([url.toString(), canonical.toString()]));
}

function verifyTwilioRequest(
  request: Request,
  params: Record<string, string>,
): boolean {
  const authToken = envValue("TWILIO_AUTH_TOKEN");
  const signature = request.headers.get("x-twilio-signature");
  if (!authToken || !signature) return false;
  return requestValidationUrls(request).some((url) =>
    Twilio.validateRequest(authToken, signature, url, params),
  );
}

export async function POST(request: Request) {
  if (messagingWebhookContentLengthTooLarge(request.headers)) {
    return payloadTooLargeResponse();
  }

  const rawBody = await readRequestTextWithLimit(
    request,
    MESSAGING_WEBHOOK_BODY_MAX_BYTES,
  );
  if (!rawBody.ok) {
    return payloadTooLargeResponse();
  }

  const form = new URLSearchParams(rawBody.text);
  const params = Object.fromEntries(form.entries());

  if (!verifyTwilioRequest(request, params)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Only handle inbound messages (received status or no status)
  const rawStatus = params.MessageStatus ?? params.SmsStatus ?? null;
  if (rawStatus && rawStatus.toLowerCase() !== "received") {
    // Delivery callback — not yet tracked for WA; ack and move on
    return NextResponse.json({ ok: true });
  }

  const fromRaw = params.From ?? "";
  const toRaw = params.To ?? "";
  // Validate this is actually a WhatsApp message
  if (!fromRaw.toLowerCase().startsWith("whatsapp:")) {
    return NextResponse.json({ error: "not a whatsapp message" }, { status: 400 });
  }

  const fromWaId = normalizeWaNumber(fromRaw);
  const toWaId = normalizeWaNumber(toRaw);
  const body = (params.Body ?? "").trim();
  const twilioSid = nonBlankParam(params.MessageSid ?? params.SmsMessageSid ?? params.SmsSid);
  const profileName = nonBlankParam(params.ProfileName);
  const numMedia = nonBlankParam(params.NumMedia);
  const mediaContentType0 = nonBlankParam(params.MediaContentType0);
  const mediaUrl0 = nonBlankParam(params.MediaUrl0);

  if (!fromWaId || !twilioSid) {
    return NextResponse.json({ error: "missing required whatsapp fields" }, { status: 400 });
  }

  const dedupeKey = `wa:${twilioSid}`;
  const displayBody = body || (numMedia && numMedia !== "0" ? "[Media attachment]" : "[WhatsApp message]");
  const subject = `WhatsApp from ${profileName ?? fromWaId}`;

  await withSystem(db, async (tx) => {
    // Match client by phone number
    const matchedClients = await tx
      .select({ id: clients.id, practiceId: clients.practiceId })
      .from(clients)
      .where(
        and(
          ilike(clients.phone, `%${fromWaId.replace("+", "")}`),
          isNull(clients.deletedAt),
        ),
      )
      .limit(5);

    const insertForPractice = async (
      practiceId: string,
      clientId: string | null,
    ) => {
      await withTenant(db, practiceId, async (tenantTx) => {
        // Insert into generic communications (channel=sms, dedupeKey="wa:{sid}")
        const [comm] = await tenantTx
          .insert(communications)
          .values({
            practiceId,
            clientId: clientId ?? undefined,
            channel: "sms",
            direction: "inbound",
            subject,
            content: displayBody,
            status: "delivered",
            providerMessageId: twilioSid,
            dedupeKey,
            ...(clientId
              ? { assignedTo: latestAssignedToForClient(practiceId, clientId) }
              : {}),
          })
          .onConflictDoNothing({ target: communications.dedupeKey })
          .returning({ id: communications.id });

        const commId = comm?.id;
        // Insert WhatsApp-specific metadata
        await tenantTx
          .insert(extWhatsappMessages)
          .values({
            practiceId,
            communicationId: commId ?? undefined,
            clientId: clientId ?? undefined,
            fromWaId,
            toWaId: toWaId ?? fromWaId,
            profileName: profileName ?? undefined,
            body: displayBody,
            twilioSid,
            numMedia: numMedia ?? undefined,
            mediaContentType0: mediaContentType0 ?? undefined,
            mediaUrl0: mediaUrl0 ?? undefined,
          })
          .onConflictDoNothing({ target: extWhatsappMessages.twilioSid });
      });
    };

    if (matchedClients.length > 0) {
      for (const matched of matchedClients) {
        await insertForPractice(matched.practiceId, matched.id);
      }
    } else {
      const activePractices = await tx
        .select({ id: practices.id })
        .from(practices)
        .where(isNull(practices.deletedAt))
        .limit(1);
      if (activePractices.length > 0) {
        await insertForPractice(activePractices[0]!.id, null);
      }
    }
  });

  return NextResponse.json({ ok: true });
}
