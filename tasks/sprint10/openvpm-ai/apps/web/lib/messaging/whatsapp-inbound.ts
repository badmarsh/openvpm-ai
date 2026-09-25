import Twilio from "twilio";
import { appBaseUrl } from "@/lib/app-url";
import { normalizeE164 } from "@/lib/messaging/phone";
import { envValue } from "@/lib/messaging/env";

/**
 * Pure inbound-WhatsApp helpers shared by the Twilio webhook route and unit
 * tests. Kept free of any database access so the webhook security contract
 * (signature verification, E.164 normalisation, wildcard-safe lookup,
 * idempotent dedupe keys) can be verified without a live Postgres.
 */

/** Strip the "whatsapp:" prefix Twilio prepends to WA numbers. */
export function normalizeWaNumber(raw: string | undefined): string | null {
  if (!raw) return null;
  const stripped = raw.replace(/^whatsapp:/i, "");
  return normalizeE164(stripped);
}

/**
 * Escape the LIKE/ILIKE wildcards (`%`, `_`) plus the escape character
 * itself so a caller-controlled value can never widen a pattern match.
 * The escaped value is meant to be embedded in a pattern with an explicit
 * `ESCAPE '\\'` clause (or, for drizzle `ilike`, used only after strict
 * digits-only validation — see `phoneDigitsForMatch`).
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Digits-only phone fragment for the inbound client lookup. Accepts strictly
 * `+<digits>` (the output shape of `normalizeE164`) and returns the digits;
 * anything else yields `null` so the caller fails safe instead of guessing.
 *
 * Because the result matches `/^[0-9]+$/`, it can never smuggle `%`/`_`
 * wildcards into the `ILIKE '%digits%'` lookup.
 */
export function phoneDigitsForMatch(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const trimmed = e164.trim();
  if (!/^\+\d+$/.test(trimmed)) return null;
  const digits = trimmed.slice(1);
  return digits.length > 0 ? digits : null;
}

/** Build the `ILIKE '%digits%'` pattern for inbound phone matching. */
export function phoneMatchPattern(e164: string | null | undefined): string | null {
  const digits = phoneDigitsForMatch(e164);
  if (!digits) return null;
  return `%${escapeLikePattern(digits)}%`;
}

/** Idempotency key for an inbound WhatsApp message (`wa:<Twilio SID>`). */
export function whatsappDedupeKey(twilioSid: string | null | undefined): string | null {
  const sid = twilioSid?.trim();
  return sid ? `wa:${sid}` : null;
}

/** Whether a stored communication row is a WhatsApp message. */
export function isWhatsAppDedupeKey(dedupeKey: string | null | undefined): boolean {
  return dedupeKey?.startsWith("wa:") === true;
}

export function nonBlankParam(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Candidate URLs for Twilio signature validation: the raw request URL plus
 * the canonical app URL. The canonical candidate covers deployments behind a
 * reverse proxy where the public host differs from the internal one.
 */
export function requestValidationUrls(request: Request): string[] {
  const url = new URL(request.url);
  const canonical = new URL(`${url.pathname}${url.search}`, appBaseUrl());
  return Array.from(new Set([url.toString(), canonical.toString()]));
}

/** HMAC verification of a Twilio webhook request (any candidate URL may match). */
export function verifyTwilioRequest(
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
