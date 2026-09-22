import { OUTBOUND_EMAIL_ERROR_MESSAGES } from "@/lib/outbound-email-security";

type TranslateFn = (
  key: string,
  fallback?: string,
  params?: Record<string, string | number>
) => string;

/**
 * Translates server-side email, communication, and messaging errors into
 * localized user-friendly messages via useI18n().
 */
export function translateOutboundEmailError(
  message: string | null | undefined,
  t: TranslateFn
): string {
  if (!message) {
    return t("inbox.errorDeliveryFailed", "Message delivery failed.");
  }

  const trimmed = message.trim();

  if (trimmed === OUTBOUND_EMAIL_ERROR_MESSAGES.FREE_FORM_DISABLED) {
    return t(
      "inbox.errorFreeFormEmailDisabled",
      "Free-form email sending from the inbox is disabled for account safety."
    );
  }

  if (trimmed === OUTBOUND_EMAIL_ERROR_MESSAGES.VERIFY_EMAIL) {
    return t(
      "inbox.errorVerifyEmailBeforeSending",
      "Verify your email address before sending external email."
    );
  }

  if (trimmed === OUTBOUND_EMAIL_ERROR_MESSAGES.TEMPORARILY_UNAVAILABLE) {
    return t(
      "inbox.errorEmailTemporarilyUnavailable",
      "Email sending is temporarily unavailable."
    );
  }

  if (trimmed === OUTBOUND_EMAIL_ERROR_MESSAGES.RATE_LIMITED) {
    return t(
      "inbox.errorEmailTemporarilyLimited",
      "Email sending is temporarily limited for account safety. Try again after the limit resets or contact OpenVPM support."
    );
  }

  if (trimmed.startsWith("Client email is suppressed after a spam complaint")) {
    return t(
      "inbox.errorEmailSuppressedSpam",
      "Client email is suppressed after a spam complaint. Update the client email before sending."
    );
  }

  if (trimmed.startsWith("Client email is suppressed after provider suppression")) {
    return t(
      "inbox.errorEmailSuppressedProvider",
      "Client email is suppressed after provider suppression. Update the client email before sending."
    );
  }

  if (trimmed.startsWith("Client email is suppressed after manual suppression")) {
    return t(
      "inbox.errorEmailSuppressedManual",
      "Client email is suppressed after manual suppression. Update the client email before sending."
    );
  }

  if (trimmed.startsWith("Client email is suppressed after a delivery bounce")) {
    return t(
      "inbox.errorEmailSuppressedBounce",
      "Client email is suppressed after a delivery bounce. Update the client email before sending."
    );
  }

  if (trimmed.startsWith("Client email is suppressed")) {
    return t(
      "inbox.errorEmailSuppressedGeneric",
      "Client email is suppressed. Update the client email before sending."
    );
  }

  if (trimmed === "Client does not have an email address on file") {
    return t(
      "inbox.errorNoEmailOnFile",
      "Client does not have an email address on file."
    );
  }

  if (trimmed === "Only email attachments are supported") {
    return t(
      "inbox.errorOnlyEmailAttachments",
      "Only email attachments are supported."
    );
  }

  if (trimmed === "No provider email ID for this communication") {
    return t(
      "inbox.errorNoProviderEmailId",
      "No provider email ID for this communication."
    );
  }

  if (trimmed === "Client does not have a phone number on file") {
    return t(
      "inbox.errorNoPhoneOnFile",
      "Client does not have a phone number on file."
    );
  }

  if (trimmed === "Client has not consented to SMS messages") {
    return t(
      "inbox.errorNoSmsConsent",
      "Client has not consented to SMS messages."
    );
  }

  if (trimmed === "SMS sending is blocked during quiet hours") {
    return t(
      "inbox.errorQuietHours",
      "SMS sending is blocked during quiet hours."
    );
  }

  if (
    trimmed.includes(
      "Sympathy Gate: Cannot send messages for a deceased patient"
    )
  ) {
    return t(
      "inbox.errorSympathyGate",
      "Sympathy Gate: Cannot send messages for a deceased patient."
    );
  }

  if (trimmed === "Message content is required") {
    return t("inbox.errorContentRequired", "Message content is required.");
  }

  if (trimmed === "Message delivery failed") {
    return t("inbox.errorDeliveryFailed", "Message delivery failed.");
  }

  return trimmed;
}
