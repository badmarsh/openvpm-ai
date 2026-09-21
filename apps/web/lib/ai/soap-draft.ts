import { generateText, type LanguageModel } from "ai";
import { configuredModel } from "@/lib/agent/runner";
import { SOAP_SECTION_MAX_LENGTH } from "@/lib/records/soap-content";
import {
  UNTRUSTED_DATA_PROMPT_RULE,
  wrapUntrustedRecord,
} from "@/lib/ai/untrusted-data";

/**
 * One-shot AI draft of a SOAP visit note. Unlike ai.createSoapFromAI (the
 * inbound hook external scribes POST finished notes to), this generates a
 * DRAFT from chart context and returns it to the editor without saving
 * anything; the clinician reviews, edits, and saves.
 */

export const SOAP_DRAFT_MAX_OUTPUT_TOKENS = 1024;
export const SOAP_DRAFT_VISIT_CONTEXT_MAX_LENGTH = 2000;

export const SOAP_DRAFT_SYSTEM_PROMPT = `You draft veterinary SOAP notes for a clinician to review and edit.
Rules:
- Return ONLY a JSON object with the string keys "subjective", "objective", "assessment", and "plan". No markdown fences, no commentary.
- Ground every statement in the provided chart context. NEVER invent exam findings, vitals, doses, or owner reports.
- Where information is missing, write a short prompt for the clinician instead (for example "Owner reports: [add]").
- Keep each section short, factual, and clinical.
- ${UNTRUSTED_DATA_PROMPT_RULE}`;

export interface SoapDraft {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface SoapDraftContext {
  patient: {
    name: string;
    species: string | null;
    breed: string | null;
    sex: string | null;
    dob: string | null;
  };
  allergies: Array<{ allergen: string; severity: string | null }>;
  activeProblems: Array<{ description: string; status: string | null }>;
  latestVitals: {
    temperatureC: string | number | null;
    heartRateBpm: number | null;
    respiratoryRateBpm: number | null;
    weightKg: string | number | null;
  } | null;
  visitContext?: string;
}

function line(label: string, value: string | number | null | undefined): string {
  return value === null || value === undefined || value === ""
    ? ""
    : `${label}: ${value}\n`;
}

export function buildSoapDraftPrompt(context: SoapDraftContext): string {
  const { patient, allergies, activeProblems, latestVitals } = context;

  // Every block below is untrusted input (patient/owner text may originate from
  // the public booking form, the rest from free-form staff entry). It is
  // wrapped in a <db_record> boundary so the model can never mistake it for an
  // instruction — see lib/ai/untrusted-data.ts.
  let patientBlock = "";
  patientBlock += line("Name", patient.name);
  patientBlock += line("Species", patient.species);
  patientBlock += line("Breed", patient.breed);
  patientBlock += line("Sex", patient.sex);
  patientBlock += line("Date of birth", patient.dob);

  let prompt =
    "Draft a SOAP note for this veterinary visit.\n\n" +
    `Patient (untrusted chart data):\n${wrapUntrustedRecord(patientBlock.trimEnd())}\n`;

  if (allergies.length > 0) {
    let allergiesBlock = "";
    for (const allergy of allergies) {
      allergiesBlock += `- ${allergy.allergen}${allergy.severity ? ` (${allergy.severity})` : ""}\n`;
    }
    prompt += `\nKnown allergies:\n${wrapUntrustedRecord(allergiesBlock.trimEnd())}\n`;
  }

  if (activeProblems.length > 0) {
    let problemsBlock = "";
    for (const problem of activeProblems) {
      problemsBlock += `- ${problem.description}${problem.status ? ` [${problem.status}]` : ""}\n`;
    }
    prompt += `\nProblem list:\n${wrapUntrustedRecord(problemsBlock.trimEnd())}\n`;
  }

  if (latestVitals) {
    let vitalsBlock = "";
    vitalsBlock += line("Temperature (C)", latestVitals.temperatureC);
    vitalsBlock += line("Heart rate (bpm)", latestVitals.heartRateBpm);
    vitalsBlock += line("Respiratory rate (bpm)", latestVitals.respiratoryRateBpm);
    vitalsBlock += line("Weight (kg)", latestVitals.weightKg);
    prompt += `\nMost recent vitals:\n${wrapUntrustedRecord(vitalsBlock.trimEnd())}\n`;
  }

  if (context.visitContext) {
    // Fail-closed bound: visitContext is free-form staff input (prompt-injection
    // and token-cost vector). Truncate to the documented limit so an oversized
    // paste can neither smuggle in trailing instructions nor blow up cost.
    prompt += `\nVisit context from staff:\n${wrapUntrustedRecord(
      context.visitContext,
      SOAP_DRAFT_VISIT_CONTEXT_MAX_LENGTH,
    )}\n`;
  }

  prompt +=
    "\nReturn the JSON object with subjective, objective, assessment, and plan.";
  return prompt;
}

function draftSection(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, SOAP_SECTION_MAX_LENGTH);
}

/**
 * Parse the model's response into the four SOAP sections. Tolerates markdown
 * fences and prose around the JSON object. Returns null when no usable
 * object is found or every section is empty.
 */
export function parseSoapDraft(text: string): SoapDraft | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const draft: SoapDraft = {
    subjective: draftSection(record.subjective),
    objective: draftSection(record.objective),
    assessment: draftSection(record.assessment),
    plan: draftSection(record.plan),
  };

  const hasContent = Object.values(draft).some((section) => section.length > 0);
  return hasContent ? draft : null;
}

export class SoapDraftUnavailableError extends Error {
  constructor() {
    super("The AI draft did not come back in a usable shape. Try again.");
    this.name = "SoapDraftUnavailableError";
  }
}

/** Generate a SOAP draft. Throws AgentNotConfiguredError when no AI key is set. */
export async function draftSoapNote(
  context: SoapDraftContext,
  customModel?: LanguageModel,
): Promise<SoapDraft> {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(new Error("SOAP draft timed out after 30s")), 30_000);

  let result;
  try {
    result = await generateText({
      model: customModel ?? configuredModel(),
      system: SOAP_DRAFT_SYSTEM_PROMPT,
      prompt: buildSoapDraftPrompt(context),
      temperature: 0,
      maxOutputTokens: SOAP_DRAFT_MAX_OUTPUT_TOKENS,
      abortSignal: ac.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const draft = parseSoapDraft(result.text);
  if (!draft) {
    throw new SoapDraftUnavailableError();
  }
  return draft;
}
