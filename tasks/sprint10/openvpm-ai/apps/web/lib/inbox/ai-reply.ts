import {
  sanitizeUntrustedText,
  UNTRUSTED_DATA_PROMPT_RULE,
  wrapUntrustedRecord,
} from "@/lib/ai/untrusted-data";

/**
 * Omnichannel Inbox — AI reply assistant helpers (Modul 5).
 *
 * Pure functions shared by the `communications.suggestReply` tRPC procedure
 * and unit tests:
 *  - Sympathy Gate evaluation (deceased patient → pietny tone, no marketing)
 *  - Prompt-injection sanitisation for inbound client text
 *  - Supplier PDF-invoice detection for the "Dodávatelia" inbox filter
 *  - Deterministic fallback drafts (used when AI is unavailable AND as the
 *    safe replacement when a sympathy-mode AI draft slips into a cheerful or
 *    marketing tone)
 */

export type InboxReplyLocale = "sk" | "en";

export type SympathyPatient = {
  id: string;
  name: string | null;
  species: string | null;
  status: string | null;
};

export type SympathyEvaluation = {
  /** True when the client owns at least one deceased patient. */
  sympathyActive: boolean;
  deceasedPatients: Array<{ id: string; name: string | null; species: string | null }>;
};

/**
 * Sympathy Gate: if the client owns ANY patient in state `deceased`
 * (uhynuté/eutanazované), AI drafts and automated templates must use a
 * pietny (condolence) tone — never cheerful, never marketing.
 */
export function evaluateSympathyGate(patients: SympathyPatient[]): SympathyEvaluation {
  const deceased = (patients ?? []).filter((p) => p?.status === "deceased");
  return {
    sympathyActive: deceased.length > 0,
    deceasedPatients: deceased.map((p) => ({
      id: p.id,
      name: p.name,
      species: p.species,
    })),
  };
}

/** Maximum inbound characters forwarded to the model (cost + smuggling bound). */
export const INBOUND_PROMPT_MAX_LENGTH = 4000;

/**
 * Sanitise inbound client text before it enters an AI prompt.
 * The text is untrusted by definition: it must never be able to rewrite the
 * system instructions (prompt injection). Defence in depth:
 *  1. Neutralise the `<db_record>` closing tag so the wrapper can't be broken.
 *  2. Bound the length.
 * Callers must additionally wrap the result with `wrapUntrustedRecord` (done
 * by `buildInboxReplyPrompt`) and keep `UNTRUSTED_DATA_PROMPT_RULE` in the
 * system prompt.
 */
export function sanitizeInboundForPrompt(
  raw: string | null | undefined,
  maxLength: number = INBOUND_PROMPT_MAX_LENGTH,
): string {
  if (!raw) return "";
  return sanitizeUntrustedText(raw, maxLength);
}

/** Marketing / cheerful markers that are forbidden in sympathy-mode drafts. */
const SYMPATHY_FORBIDDEN_PATTERNS: RegExp[] = [
  // SK + EN marketing vocabulary
  /zľav/i,
  /akci[au]/i,
  /výpredaj/i,
  /promo/i,
  /kupón/i,
  /kupon/i,
  /vernostn/i,
  /odporu[čc]te.*zn[áa]mym/i,
  /discount/i,
  /sale\b/i,
  /offer\b/i,
  /coupon/i,
  /loyalty/i,
  /refer a friend/i,
  // Cheerful tone markers
  /🎉|🥳|😄|😃|🤩|🎊|🎁|💥|👏/,
  /!{2,}/,
  /\bsuper\b/i,
  /\bskvel[áaá]/i,
  /\búžasn/i,
  /\bpar[áa]da\b/i,
  /\bhur[áa]\b/i,
  /\bawesome\b/i,
  /\bgreat news\b/i,
];

/**
 * Returns true when a draft contains cheerful/marketing markers that must
 * never reach a grieving owner. Used to reject sympathy-mode AI output and
 * fall back to the deterministic condolence template.
 */
export function draftViolatesSympathy(draft: string | null | undefined): boolean {
  if (!draft) return false;
  return SYMPATHY_FORBIDDEN_PATTERNS.some((re) => re.test(draft));
}

export const INBOX_REPLY_SYSTEM_PROMPT_SK = `Si AI asistent veterinárnej kliniky v systéme OpenVPM. Navrhuješ odpoveď zamestnancovi kliniky (recepcia / veterinár), ktorý ju pred odoslaním skontroluje a upraví — nikdy nekomunikuješ priamo s majiteľom.

Pravidlá:
${UNTRUSTED_DATA_PROMPT_RULE}
- Odpovedaj po slovensky, slušne a vecne, v mene kliniky.
- Nepredpisuj diagnózu ani dávkovanie liekov; pri zdravotných otázkach navrhni objednanie na vyšetrenie alebo telefonickú konzultáciu.
- Neuvádzaj kontaktné údaje, ktoré nemáš v kontexte.
- Návrh je koncept: krátky (maximálne 120 slov), bez predmetu, bez oslovenia navyše — oslovenie použi len ak poznáš meno klienta.
- Nikdy negeneruj marketingové ponuky, zľavy ani emotikony.`;

export const INBOX_REPLY_SYSTEM_PROMPT_EN = `You are an AI assistant of a veterinary clinic in the OpenVPM system. You draft a reply for a clinic staff member (reception / veterinarian) who reviews and edits it before sending — you never communicate with the owner directly.

Rules:
${UNTRUSTED_DATA_PROMPT_RULE}
- Reply in English, politely and factually, on behalf of the clinic.
- Never diagnose or dose medication; for health questions suggest booking an examination or a phone consultation.
- Do not invent contact details that are not in the context.
- The draft is a concept: short (max 120 words), no subject line; greet by name only if the client name is known.
- Never generate marketing offers, discounts, or emojis.`;

export const INBOX_REPLY_SYMPATHY_ADDENDUM_SK = `PIETNY REŽIM (Sympathy Gate): Majiteľ smúti za uhynutým zvieraťom. Použi výhradne súcitný, pokojný a úctivý tón. Zakázaný je veselý tón, humor, marketing, ponuky, zľavy aj emotikony. Vyjadri úprimnú sústrasť a ponúkni pomoc kliniky.`;

export const INBOX_REPLY_SYMPATHY_ADDENDUM_EN = `CONDOLENCE MODE (Sympathy Gate): The owner is grieving a deceased pet. Use an exclusively compassionate, calm, and respectful tone. A cheerful tone, humour, marketing, offers, discounts, and emojis are all forbidden. Express sincere condolences and offer the clinic's support.`;

export function inboxReplySystemPrompt(
  locale: InboxReplyLocale,
  sympathyActive: boolean,
): string {
  const base =
    locale === "sk" ? INBOX_REPLY_SYSTEM_PROMPT_SK : INBOX_REPLY_SYSTEM_PROMPT_EN;
  if (!sympathyActive) return base;
  const addendum =
    locale === "sk" ? INBOX_REPLY_SYMPATHY_ADDENDUM_SK : INBOX_REPLY_SYMPATHY_ADDENDUM_EN;
  return `${base}\n\n${addendum}`;
}

export type InboxReplyContext = {
  clientName: string | null;
  patients: Array<{ name: string | null; species: string | null; status: string | null }>;
  /** Most recent messages, oldest first, already cleaned for display. */
  recentMessages: Array<{
    direction: string | null;
    channel: string | null;
    content: string | null;
  }>;
  locale: InboxReplyLocale;
  sympathyActive: boolean;
};

/**
 * Build the user prompt for the reply model. All client-originated text is
 * forwarded exclusively inside `<db_record>` boundaries (see
 * `UNTRUSTED_DATA_PROMPT_RULE` in the system prompt) so injected
 * instructions such as "ignore previous instructions" are treated as data.
 */
export function buildInboxReplyPrompt(ctx: InboxReplyContext): string {
  const lines: string[] = [];
  lines.push(ctx.locale === "sk" ? "Kontext kliniky:" : "Clinic context:");
  lines.push(`- ${ctx.locale === "sk" ? "Klient" : "Client"}: ${ctx.clientName ?? "—"}`);
  const patientLine =
    ctx.patients.length > 0
      ? ctx.patients
          .map((p) => `${p.name ?? "—"} (${p.species ?? "—"})`)
          .join(", ")
      : "—";
  lines.push(`- ${ctx.locale === "sk" ? "Zvieratá" : "Patients"}: ${patientLine}`);
  if (ctx.sympathyActive) {
    lines.push(
      `- ${ctx.locale === "sk" ? "POZNÁMKA: pietny režim — klient smúti za uhynutým zvieraťom" : "NOTE: condolence mode — the client is grieving a deceased pet"}`,
    );
  }
  const history = ctx.recentMessages
    .slice(-6)
    .map((m) => {
      const who =
        m.direction === "outbound"
          ? ctx.locale === "sk"
            ? "Klinika"
            : "Clinic"
          : (ctx.clientName ?? (ctx.locale === "sk" ? "Klient" : "Client"));
      const text = sanitizeInboundForPrompt(m.content ?? "", 800);
      return `${who} [${m.channel ?? "?"}]: ${text}`;
    })
    .join("\n");
  lines.push("");
  lines.push(wrapUntrustedRecord(history || "—", INBOUND_PROMPT_MAX_LENGTH));
  lines.push("");
  lines.push(
    ctx.locale === "sk"
      ? "Navrhni odpoveď zamestnancovi kliniky:"
      : "Draft a reply for the clinic staff member:",
  );
  return lines.join("\n");
}

/**
 * Deterministic fallback drafts. Used when the AI provider is unavailable
 * and as the guaranteed-safe replacement when a sympathy-mode AI draft
 * violates the condolence tone. Always human-in-the-loop: the UI inserts the
 * draft as an editable concept that staff must review before sending.
 */
export function fallbackReplyDraft(opts: {
  clientFirstName: string | null;
  patientName: string | null;
  sympathyActive: boolean;
  locale: InboxReplyLocale;
}): string {
  const { clientFirstName, patientName, sympathyActive, locale } = opts;
  if (sympathyActive) {
    if (locale === "sk") {
      const greeting = clientFirstName ? `Vážená pani / vážený pán ${clientFirstName}` : "Vážení smútiaci";
      const pet = patientName ? ` ${patientName}` : "";
      return `${greeting},\n\nprijmite, prosím, našu úprimnú sústrasť pri strate Vášho milovaného spoločníka${pet}. Veľmi nás to mrzí a myslíme na Vás v tejto ťažkej chvíli.\n\nAk by ste čokoľvek potrebovali, sme Vám k dispozícii.\n\nS úctou,\ntím kliniky`;
    }
    const greeting = clientFirstName ? `Dear ${clientFirstName}` : "Dear grieving family";
    const pet = patientName ? ` ${patientName}` : "";
    return `${greeting},\n\nplease accept our sincere condolences on the loss of your beloved companion${pet}. We are very sorry for your loss and our thoughts are with you during this difficult time.\n\nIf there is anything you need, we are here for you.\n\nWith sympathy,\nthe clinic team`;
  }
  if (locale === "sk") {
    const greeting = clientFirstName ? `Dobrý deň, ${clientFirstName}` : "Dobrý deň";
    const pet = patientName ? ` ohľadom ${patientName}` : "";
    return `${greeting},\n\nďakujeme za Vašu správu${pet}. Radi Vám pomôžeme — prosím, upresnite, či preferujete telefonickú konzultáciu alebo osobné vyšetrenie, a navrhneme Vám najbližší vhodný termín.\n\nS pozdravom,\ntím kliniky`;
  }
  const greeting = clientFirstName ? `Hello ${clientFirstName}` : "Hello";
  const pet = patientName ? ` regarding ${patientName}` : "";
  return `${greeting},\n\nthank you for your message${pet}. We are happy to help — please let us know whether you prefer a phone consultation or an in-person examination, and we will suggest the nearest suitable appointment.\n\nKind regards,\nthe clinic team`;
}

// ---------------------------------------------------------------------------
// Supplier PDF-invoice detection ("Dodávatelia" inbox filter)
// ---------------------------------------------------------------------------

const SUPPLIER_ATTACHMENT_RE = /<!--INBOX_ATTACHMENTS:([\s\S]*?)-->/;

export type SupplierInvoiceDetection = {
  isSupplier: boolean;
  hasPdfAttachment: boolean;
  attachmentCount: number;
  reasons: string[];
};

/**
 * Heuristic detection of supplier PDF invoices inside a stored communication.
 * Looks at the embedded `<!--INBOX_ATTACHMENTS:…-->` metadata (PDF filenames)
 * plus invoice vocabulary (faktúra / invoice / IČO / DIČ). Pure and
 * dependency-free so both the API filter and the UI badge share one rule.
 */
export function detectSupplierInvoice(
  content: string | null | undefined,
  subject: string | null | undefined = null,
): SupplierInvoiceDetection {
  const reasons: string[] = [];
  let hasPdfAttachment = false;
  let attachmentCount = 0;
  if (content) {
    const match = content.match(SUPPLIER_ATTACHMENT_RE);
    if (match?.[1]) {
      try {
        const attachments = JSON.parse(match[1]) as Array<{
          filename?: string | null;
          content_type?: string | null;
        }>;
        attachmentCount = attachments.length;
        hasPdfAttachment = attachments.some((a) => {
          const name = (a.filename ?? "").toLowerCase();
          const type = (a.content_type ?? "").toLowerCase();
          return name.endsWith(".pdf") || type === "application/pdf";
        });
        if (hasPdfAttachment) reasons.push("pdf-attachment");
      } catch {
        // Malformed metadata — ignore, invoice vocabulary may still match.
      }
    }
  }
  const haystack = `${subject ?? ""}\n${content ?? ""}`.toLowerCase();
  const invoicePhrases = [
    "faktúr",
    "faktur",
    "invoice",
    "dodávateľ",
    "dodavatel",
    "dodací list",
    "dodaci list",
    "dobropis",
    "splatnosť",
    "splatnost",
    "variabilný symbol",
    "variabilny symbol",
  ];
  // Short tokens need word boundaries — "dic" must not match "medical".
  const invoiceTokens = ["ičo", "ico", "dič", "dic", "dph", "vat"];
  const vocabularyHits = [
    ...invoicePhrases.filter((word) => haystack.includes(word.toLowerCase())),
    ...invoiceTokens.filter((token) =>
      new RegExp(`(^|[^a-zá-ž0-9])${token}([^a-zá-ž0-9]|$)`, "i").test(haystack),
    ),
  ];
  if (vocabularyHits.length > 0) {
    reasons.push(`invoice-vocabulary:${vocabularyHits.slice(0, 3).join(",")}`);
  }
  // A supplier invoice needs either a PDF attachment or strong vocabulary
  // evidence (2+ distinct hits) to avoid flagging casual client messages that
  // merely mention "faktúra".
  const isSupplier =
    hasPdfAttachment || vocabularyHits.length >= 2 || (vocabularyHits.length >= 1 && attachmentCount > 0);
  return { isSupplier, hasPdfAttachment, attachmentCount, reasons };
}
