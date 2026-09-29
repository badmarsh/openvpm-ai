import { normalizeE164 } from "./phone";

/**
 * The disclosure a staff member must show or read to a client before recording
 * SMS consent. The server owns this value: clients submit only the explicit
 * consent decision, never the evidence snapshot or its source.
 *
 * Keep `source` versioned because the existing client schema has no separate
 * disclosure-version column. `snapshot` is stored verbatim and rendered by the
 * staff-facing client forms so the persisted evidence matches what was shown.
 */
export const SMS_CONSENT_DISCLOSURE = Object.freeze({
  version: "v1",
  source: "staff_attested_form:v1",
  snapshot:
    "The client agrees that this veterinary practice may send appointment reminders, vaccination and care updates, and two-way service messages by text, including automated messages, to the mobile number provided. Message frequency varies. Message and data rates may apply. Consent is not a condition of purchase. Reply STOP to opt out or HELP for help.",
});

/**
 * Evidence recorded when a client re-subscribes from their own phone with an
 * accepted carrier keyword. The inbound communication retains the original
 * message; this concise snapshot makes the current consent row self-describing.
 */
export const SMS_INBOUND_OPT_IN = Object.freeze({
  version: "v1",
  source: "inbound_keyword:v1",
});

export function inboundSmsOptInEvidence(keyword: string): string {
  return `Client sent the accepted SMS opt-in keyword "${keyword}" to resume transactional text messages from this veterinary practice. Reply STOP to opt out or HELP for help.`;
}

function trimmedPhone(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  return value ? value : null;
}

/**
 * Compare the destination represented by two phone strings. Valid numbers use
 * their E.164 identity so formatting-only edits preserve consent. Invalid or
 * ambiguous values compare exactly after trimming, which fails safe instead of
 * treating two unrelated invalid numbers as the same `null` identity.
 */
export function phoneNumbersMatchForConsent(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const normalizedLeft = normalizeE164(left);
  const normalizedRight = normalizeE164(right);

  if (normalizedLeft || normalizedRight) {
    return normalizedLeft !== null && normalizedLeft === normalizedRight;
  }

  return trimmedPhone(left) === trimmedPhone(right);
}
