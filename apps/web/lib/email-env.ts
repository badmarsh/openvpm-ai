/**
 * Neutral sender identity for deployments that do not configure EMAIL_FROM.
 * Must never default to a specific customer's or staging domain — a
 * self-hosted practice sending from a foreign domain breaks deliverability
 * and misattributes mail.
 */
const DEFAULT_EMAIL_FROM = "OpenVPM <noreply@mail.openvpm.com>";

export function nonBlankEmailValue(
  value: string | null | undefined
): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function emailEnv(name: string): string | undefined {
  return nonBlankEmailValue(process.env[name]);
}

export function defaultEmailFrom(override?: string | null): string {
  return (
    nonBlankEmailValue(override) ??
    emailEnv("EMAIL_FROM") ??
    DEFAULT_EMAIL_FROM
  );
}

export function emailDemoMode(): boolean {
  return emailEnv("NEXT_PUBLIC_DEMO_MODE") === "true";
}
