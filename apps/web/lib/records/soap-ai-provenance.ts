import { createHash } from "node:crypto";
import { soapSectionText } from "@/lib/records/soap-content";

/**
 * Sprint 32 (GT-001 / F-04-1): per-section AI provenance for SOAP notes.
 *
 * Pure helpers, no DB access. AI output is hashed when it is handed to a draft
 * (a "receipt"), and the finalized note is classified against those hashes
 * when the clinician signs it. Only hashes are ever persisted, never text.
 *
 * All hashing runs over the *plain text* of a section, so the editor's HTML
 * (`<p>`, `<br>`, entities) and whitespace changes don't count as edits.
 */

export const SOAP_SECTION_KEYS = [
  "subjective",
  "objective",
  "assessment",
  "plan",
] as const;

export type SoapSectionKey = (typeof SOAP_SECTION_KEYS)[number];

export type SoapSectionInput = Partial<
  Record<SoapSectionKey, string | null | undefined>
>;

export type SoapSectionHashes = Record<SoapSectionKey, string | null>;

export type SectionProvenance =
  | "ai_verbatim"
  | "ai_edited"
  | "ai_removed"
  | "manual";

export type SoapSectionProvenance = Partial<
  Record<SoapSectionKey, SectionProvenance>
>;

export type SoapAiSource = "soap_draft" | "imaging_findings";

export interface SoapAiReceiptForEvent {
  source: SoapAiSource;
  draftHash: string;
  sectionHashes: Partial<Record<SoapSectionKey, string | null | undefined>>;
}

export interface SoapAiFinalizationEvent {
  originalDraftHash: string;
  confirmedContentHash: string;
  wasEditedByClinician: boolean;
  sections: SoapSectionProvenance;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Plain text of a SOAP section: tags stripped, entities decoded, whitespace collapsed. */
export function soapSectionPlainText(value: string | null | undefined): string {
  return soapSectionText(value);
}

/** sha256 hex of each section's plain text, or `null` when the section is empty. */
export function hashSoapSections(sections: SoapSectionInput): SoapSectionHashes {
  const out = {} as SoapSectionHashes;
  for (const key of SOAP_SECTION_KEYS) {
    const text = soapSectionPlainText(sections[key]);
    out[key] = text ? sha256(text) : null;
  }
  return out;
}

/** sha256 over the canonical JSON of the four plain-text sections (fixed key order). */
export function hashSoapDraft(sections: SoapSectionInput): string {
  const canonical: Record<SoapSectionKey, string> = {
    subjective: soapSectionPlainText(sections.subjective),
    objective: soapSectionPlainText(sections.objective),
    assessment: soapSectionPlainText(sections.assessment),
    plan: soapSectionPlainText(sections.plan),
  };
  return sha256(JSON.stringify(canonical));
}

/**
 * Classify each section of the final note against one receipt's section hashes.
 * Sections empty in both the draft and the final note are omitted.
 */
export function classifySectionProvenance(
  draftHashes: Partial<Record<SoapSectionKey, string | null | undefined>>,
  finalSections: SoapSectionInput,
): SoapSectionProvenance {
  const finalHashes = hashSoapSections(finalSections);
  const result: SoapSectionProvenance = {};
  for (const key of SOAP_SECTION_KEYS) {
    const draft = draftHashes[key] ?? null;
    const final = finalHashes[key];
    if (draft && final) {
      result[key] = draft === final ? "ai_verbatim" : "ai_edited";
    } else if (draft) {
      result[key] = "ai_removed";
    } else if (final) {
      result[key] = "manual";
    }
  }
  return result;
}

const PROVENANCE_RANK: Record<SectionProvenance, number> = {
  manual: 0,
  ai_removed: 1,
  ai_edited: 2,
  ai_verbatim: 3,
};

/**
 * Build the ledger payload for a finalization. Returns `null` when no AI
 * receipt is linked to the note (a manual note writes no ledger event).
 */
export function buildSoapAiFinalizationEvent(
  receipts: readonly SoapAiReceiptForEvent[],
  finalSections: SoapSectionInput,
): SoapAiFinalizationEvent | null {
  if (receipts.length === 0) return null;

  const originalDraftHash =
    receipts.length === 1
      ? receipts[0]!.draftHash
      : sha256(
          receipts
            .map((receipt) => receipt.draftHash)
            .sort()
            .join("\n"),
        );

  // Merge per-receipt classifications. Where several receipts touch a section
  // the strongest AI signal wins (verbatim > edited > removed > manual).
  const sections: SoapSectionProvenance = {};
  for (const receipt of receipts) {
    const perReceipt = classifySectionProvenance(
      receipt.sectionHashes ?? {},
      finalSections,
    );
    for (const key of SOAP_SECTION_KEYS) {
      const next = perReceipt[key];
      if (!next) continue;
      const current = sections[key];
      if (!current || PROVENANCE_RANK[next] > PROVENANCE_RANK[current]) {
        sections[key] = next;
      }
    }
  }

  const aiTouched = Object.values(sections).filter(
    (value) => value !== "manual",
  );
  const wasEditedByClinician = !(
    aiTouched.length > 0 && aiTouched.every((value) => value === "ai_verbatim")
  );

  return {
    originalDraftHash,
    confirmedContentHash: hashSoapDraft(finalSections),
    wasEditedByClinician,
    sections,
  };
}

/**
 * Hash columns for a new `ext_soap_ai_provenance` receipt, computed
 * server-side from the AI output as it is handed to the draft.
 */
export function soapAiReceiptHashes(sections: SoapSectionInput): {
  draftHash: string;
  sectionHashes: SoapSectionHashes;
} {
  return {
    draftHash: hashSoapDraft(sections),
    sectionHashes: hashSoapSections(sections),
  };
}

/** Best-effort model identity for a receipt (never throws, never a secret). */
export function describeAiModel(model: unknown): {
  modelId: string;
  provider: string | null;
} {
  if (typeof model === "string" && model.trim()) {
    return { modelId: model, provider: null };
  }
  if (model && typeof model === "object") {
    const record = model as { modelId?: unknown; provider?: unknown };
    if (typeof record.modelId === "string" && record.modelId.trim()) {
      return {
        modelId: record.modelId,
        provider:
          typeof record.provider === "string" && record.provider.trim()
            ? record.provider
            : null,
      };
    }
  }
  return { modelId: "configured", provider: null };
}
