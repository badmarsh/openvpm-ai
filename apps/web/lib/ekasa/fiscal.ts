import { envFlagEnabled } from "@/lib/env-bool";

const ALLOWED_EKASA_HOSTS = new Set([
  "ekasa.financnasprava.sk",
]);

export function isEkasaFiscalizationEnabled(): boolean {
  return envFlagEnabled("EKASA_FISCALIZATION_ENABLED");
}

export function isPemPrivateKey(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  let decoded = trimmed;
  if (!decoded.includes("BEGIN")) {
    try {
      decoded = Buffer.from(trimmed, "base64").toString("utf8");
    } catch {
      return false;
    }
  }
  return /-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(decoded);
}

export function pemPrivateKeyFromCert(value: string | null | undefined): string | null {
  if (!isPemPrivateKey(value)) return null;
  const trimmed = value!.trim();
  if (trimmed.includes("BEGIN")) return trimmed;
  return Buffer.from(trimmed, "base64").toString("utf8");
}

/** SSRF guard: only HTTPS Financial Administration hosts. */
export function isAllowedEkasaApiUrl(apiUrl: string): boolean {
  try {
    const url = new URL(apiUrl);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_EKASA_HOSTS.has(host);
  } catch {
    return false;
  }
}

export function assertEkasaOutboundAllowed(apiUrl: string): string | null {
  if (!isEkasaFiscalizationEnabled()) {
    return "e-Kasa fiscalization is disabled until EKASA_FISCALIZATION_ENABLED=true and a FR SR RSA key are configured";
  }
  if (!isAllowedEkasaApiUrl(apiUrl)) {
    return "e-Kasa API URL is not an allowed Financial Administration HTTPS host";
  }
  return null;
}
