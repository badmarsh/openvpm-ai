/**
 * Sprint 27 — Schema Validation Middleware.
 *
 * Unit tests for the Ajv-backed VPM input contract validation layer and its
 * clinical guardrails (Zákon 39/2007 Z. z., Zákon 139/1998 Z. z., Sympathy
 * Gate).
 */

import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";

import {
  CONTRACT_IDS,
  REGISTRY_SOURCE,
  contractCount,
  evaluateGuardrails,
  findNarcoticMatches,
  getContract,
  hasAiOrigin,
  isContractId,
  isPatientDeceased,
  listContractSummaries,
  normalizeAjvError,
  pointerToPath,
  summarizeOutcome,
  validateContract,
  withSchemaValidation,
  withSchemaValidationFromInput,
} from "../index";

const UUID = "6f9c1c2a-0000-4000-8000-000000000001";

describe("registry", () => {
  it("lists every vendored openvpm/schemas master contract exactly once", () => {
    expect(contractCount()).toBe(8);
    expect(new Set(CONTRACT_IDS).size).toBe(CONTRACT_IDS.length);
    for (const id of CONTRACT_IDS) {
      const contract = getContract(id);
      expect(contract.id).toBe(id);
      expect(contract.source).toBe(REGISTRY_SOURCE);
      expect(contract.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("compiles every contract with Ajv in strict mode", () => {
    for (const id of CONTRACT_IDS) {
      const outcome = validateContract(id, {});
      // An empty payload is rejected (required fields) but must never throw.
      expect(outcome.ok).toBe(false);
      expect(outcome.contractId).toBe(id);
      expect(outcome.result).toBe("rejected");
    }
  });

  it("rejects unknown contract ids", () => {
    expect(isContractId("openvpm.nope")).toBe(false);
    expect(isContractId(42)).toBe(false);
    expect(() =>
      // @ts-expect-error — intentionally invalid id
      getContract("openvpm.nope"),
    ).toThrow(/Unknown VPM schema contract/);
  });

  it("exposes summaries without raw schema bodies", () => {
    const summaries = listContractSummaries();
    expect(summaries).toHaveLength(8);
    for (const summary of summaries) {
      expect(summary.schemaBytes).toBeGreaterThan(100);
      expect("schema" in summary).toBe(false);
    }
  });
});

describe("client registration contract", () => {
  const valid = {
    firstName: "Jana",
    lastName: "Kováčová",
    email: "jana.kovac@example.com",
    phone: "+421901234567",
    marketingConsent: false,
  };

  it("accepts a valid client registration", () => {
    const outcome = validateContract("openvpm.client-registration", valid);
    expect(outcome.ok).toBe(true);
    expect(outcome.issues).toHaveLength(0);
  });

  it("reports missing required fields with i18n keys", () => {
    const outcome = validateContract("openvpm.client-registration", {
      firstName: "Jana",
    });
    expect(outcome.ok).toBe(false);
    const fields = outcome.issues.map((issue) => issue.field);
    expect(fields).toEqual(expect.arrayContaining(["lastName", "email", "phone"]));
    for (const issue of outcome.issues) {
      expect(issue.messageKey).toBe("schemaValidation.error.required");
    }
  });

  it("enforces email format", () => {
    const outcome = validateContract("openvpm.client-registration", {
      ...valid,
      email: "not-an-email",
    });
    const emailIssue = outcome.issues.find((issue) => issue.field === "email");
    expect(emailIssue?.code).toBe("format");
  });

  it("rejects unknown properties (contract surface is closed)", () => {
    const outcome = validateContract("openvpm.client-registration", {
      ...valid,
      vipScore: 10,
    });
    const issue = outcome.issues.find((item) => item.field.includes("vipScore"));
    expect(issue?.code).toBe("additionalProperties");
  });
});

describe("patient registration contract", () => {
  it("accepts a valid patient", () => {
    const outcome = validateContract("openvpm.patient-registration", {
      clientId: UUID,
      name: "Rex",
      species: "dog",
      sex: "male",
      weightKg: 24.5,
      status: "active",
    });
    expect(outcome.ok).toBe(true);
  });

  it("rejects an unknown species via enum", () => {
    const outcome = validateContract("openvpm.patient-registration", {
      clientId: UUID,
      name: "Rex",
      species: "dragon",
    });
    const issue = outcome.issues.find((item) => item.field === "species");
    expect(issue?.code).toBe("enum");
    expect(issue?.messageKey).toBe("schemaValidation.error.enum");
  });

  it("rejects non-positive weight", () => {
    const outcome = validateContract("openvpm.patient-registration", {
      clientId: UUID,
      name: "Rex",
      species: "dog",
      weightKg: 0,
    });
    const issue = outcome.issues.find((item) => item.field === "weightKg");
    expect(issue?.code).toBe("exclusiveMinimum");
  });
});

describe("AI draft guardrail (Zákon 39/2007 Z. z.)", () => {
  it("locks AI clinical suggestions to draft by schema", () => {
    const outcome = validateContract("openvpm.ai-clinical-suggestion", {
      patientId: UUID,
      suggestionType: "treatment_plan",
      content: "Odporúčaný postup",
      status: "signed",
      origin: { source: "ai" },
    });
    expect(outcome.ok).toBe(false);
    const codes = outcome.issues.map((issue) => issue.code);
    expect(codes).toContain("enum"); // schema: status must be "draft"
    expect(codes).toContain("guardrail.ai_draft_only");
    expect(outcome.triggeredGuardrails).toContain("ai-draft-only");
  });

  it("accepts a draft AI suggestion awaiting veterinarian signature", () => {
    const outcome = validateContract("openvpm.ai-clinical-suggestion", {
      patientId: UUID,
      suggestionType: "diagnosis",
      content: "Diferenciálna diagnóza",
      status: "draft",
      signature: null,
      modelId: "openvpm-copilot-1",
      confidence: 0.9,
      origin: { source: "ai" },
    });
    expect(outcome.ok).toBe(true);
  });

  it("blocks AI-originated prescriptions that are already active", () => {
    const outcome = validateContract("openvpm.prescription-order", {
      patientId: UUID,
      medication: "Amoxicilín 250 mg",
      dosage: "1 tbl",
      frequency: "2x denne",
      quantity: 20,
      status: "active",
      origin: { source: "ai" },
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.triggeredGuardrails).toContain("ai-draft-only");
  });

  it("allows manually entered prescriptions to go active", () => {
    const outcome = validateContract("openvpm.prescription-order", {
      patientId: UUID,
      medication: "Amoxicilín 250 mg",
      dosage: "1 tbl",
      frequency: "2x denne",
      quantity: 20,
      status: "active",
      origin: { source: "manual" },
    });
    expect(outcome.ok).toBe(true);
  });
});

describe("narcotic zero-AI-prefill guardrail (Zákon 139/1998 Z. z.)", () => {
  const base = {
    patientId: UUID,
    quantity: 2,
    unit: "ml",
    reason: "Anestézia pri zákroku",
    recordedBy: UUID,
  };

  it("accepts manual ketamine entry", () => {
    const outcome = validateContract("openvpm.controlled-substance-record", {
      ...base,
      substance: "Ketamín 100 mg/ml",
      origin: { source: "manual" },
    });
    expect(outcome.ok).toBe(true);
  });

  it("rejects AI-prefilled ketamine with the narcotic guardrail", () => {
    const outcome = validateContract("openvpm.controlled-substance-record", {
      ...base,
      substance: "Ketamín 100 mg/ml",
      origin: { source: "ai-prefill" },
    });
    expect(outcome.ok).toBe(false);
    const issue = outcome.issues.find(
      (item) => item.guardrail === "narcotic-zero-ai-prefill",
    );
    expect(issue).toBeDefined();
    expect(issue?.messageKey).toBe("schemaValidation.error.narcoticAiPrefill");
    expect(issue?.params?.substances).toContain("ketamine");
  });

  it("rejects AI-prefilled opioids regardless of diacritics", () => {
    const outcome = validateContract("openvpm.controlled-substance-record", {
      ...base,
      substance: "Morfín 10 mg/ml",
      origin: { source: "ai" },
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.triggeredGuardrails).toContain("narcotic-zero-ai-prefill");
  });

  it("rejects AI-prefilled propofol on prescriptions", () => {
    const outcome = validateContract("openvpm.prescription-order", {
      patientId: UUID,
      medication: "Propofol 10 mg/ml",
      dosage: "indukcia",
      frequency: "jednorazovo",
      quantity: 1,
      status: "draft",
      origin: { source: "ai-prefill" },
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.triggeredGuardrails).toContain("narcotic-zero-ai-prefill");
  });

  it("allows AI prefill for non-narcotic medication", () => {
    const outcome = validateContract("openvpm.prescription-order", {
      patientId: UUID,
      medication: "Amoxicilín 250 mg",
      dosage: "1 tbl",
      frequency: "2x denne",
      quantity: 20,
      status: "draft",
      origin: { source: "ai-prefill" },
    });
    expect(outcome.ok).toBe(true);
  });

  it("matches narcotic aliases case- and diacritic-insensitively on word boundaries", () => {
    expect(findNarcoticMatches("Ketamín 100 mg/ml")).toContain("ketamine");
    expect(findNarcoticMatches("PROPofol")).toContain("propofol");
    expect(findNarcoticMatches("morfín")).toContain("opioids");
    expect(findNarcoticMatches("tramadol HCl")).toContain("opioids");
    // Word-boundary protection: unrelated look-alikes must not match.
    expect(findNarcoticMatches("ketoprofen")).toEqual([]);
    expect(findNarcoticMatches("propolis")).toEqual([]);
  });
});

describe("sympathy gate", () => {
  it("suppresses automated reminders for deceased patients", () => {
    const outcome = validateContract("openvpm.care-reminder", {
      patientId: UUID,
      title: "Kontrola",
      dueDate: "2026-10-01",
      automated: true,
      channels: ["email"],
      patientStatus: "deceased",
    });
    expect(outcome.ok).toBe(false);
    const issue = outcome.issues.find(
      (item) => item.guardrail === "sympathy-gate",
    );
    expect(issue).toBeDefined();
    expect(issue?.messageKey).toBe("schemaValidation.error.sympathyGate");
  });

  it("still allows manual (non-automated) notes for deceased patients", () => {
    const outcome = validateContract("openvpm.care-reminder", {
      patientId: UUID,
      title: "Posledná rozlúčka — dokumentácia",
      dueDate: "2026-10-01",
      automated: false,
      channels: [],
      patientStatus: "deceased",
    });
    expect(outcome.ok).toBe(true);
  });

  it("keeps automation available for active patients", () => {
    const outcome = validateContract("openvpm.care-reminder", {
      patientId: UUID,
      title: "Ročné očkovanie",
      dueDate: "2026-10-01",
      automated: true,
      channels: ["email", "sms"],
      patientStatus: "active",
    });
    expect(outcome.ok).toBe(true);
  });

  it("blocks AI reminder suggestions for deceased patients", () => {
    const outcome = validateContract("openvpm.ai-clinical-suggestion", {
      patientId: UUID,
      suggestionType: "care_reminder",
      content: "Pripomenúť kontrolu",
      status: "draft",
      patientStatus: "deceased",
      origin: { source: "ai" },
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.triggeredGuardrails).toContain("sympathy-gate");
  });
});

describe("lab result import contract", () => {
  it("accepts a valid import batch", () => {
    const outcome = validateContract("openvpm.lab-result-import", {
      patientId: UUID,
      sourceLab: "VetLab Košice",
      collectedAt: "2026-09-20T08:30:00Z",
      results: [
        { testName: "ALT", value: 42, unit: "ukat/l", status: "normal" },
        { testName: "Kreatinín", value: "110", unit: "umol/l", status: "abnormal" },
      ],
      origin: { source: "integration" },
    });
    expect(outcome.ok).toBe(true);
  });

  it("rejects empty result batches", () => {
    const outcome = validateContract("openvpm.lab-result-import", {
      patientId: UUID,
      sourceLab: "VetLab Košice",
      results: [],
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.issues.some((issue) => issue.code === "minItems")).toBe(true);
  });

  it("reports nested item errors with dotted paths", () => {
    const outcome = validateContract("openvpm.lab-result-import", {
      patientId: UUID,
      sourceLab: "VetLab Košice",
      results: [{ value: 5 }],
    });
    const issue = outcome.issues.find(
      (item) => item.field === "results.0.testName",
    );
    expect(issue?.code).toBe("required");
  });
});

describe("helpers", () => {
  it("detects AI origins anywhere in the payload", () => {
    expect(hasAiOrigin({ origin: { source: "ai" } })).toBe(true);
    expect(hasAiOrigin({ items: [{ origin: { source: "AI-PREFILL" } }] })).toBe(
      true,
    );
    expect(hasAiOrigin({ origin: { source: "manual" } })).toBe(false);
    expect(hasAiOrigin(null)).toBe(false);
  });

  it("detects deceased patients", () => {
    expect(isPatientDeceased({ patientStatus: "deceased" })).toBe(true);
    expect(isPatientDeceased({ patientStatus: "active" })).toBe(false);
    expect(isPatientDeceased("deceased")).toBe(false);
  });

  it("converts JSON pointers to dotted paths", () => {
    expect(pointerToPath("/items/0/dosage")).toBe("items.0.dosage");
    expect(pointerToPath("")).toBe("");
    expect(pointerToPath("/a~1b")).toBe("a/b");
  });

  it("normalizes unknown Ajv keywords to a generic i18n key", () => {
    const issue = normalizeAjvError({
      keyword: "something-new",
      instancePath: "/field",
      schemaPath: "#/properties/field/something-new",
      params: {},
      message: "boom",
    });
    expect(issue.code).toBe("something-new");
    expect(issue.messageKey).toBe("schemaValidation.error.invalid");
  });

  it("summarizes outcomes without leaking payload values", () => {
    const outcome = validateContract("openvpm.client-registration", {
      firstName: "Jana",
    });
    const summary = summarizeOutcome(outcome);
    expect(summary).toContain("openvpm.client-registration: rejected");
    expect(summary).not.toContain("Jana");
  });

  it("evaluates only guardrails declared by the contract", () => {
    const contract = getContract("openvpm.client-registration");
    const issues = evaluateGuardrails(contract, {
      patientStatus: "deceased",
      automated: true,
      origin: { source: "ai" },
    });
    expect(issues).toHaveLength(0);
  });
});

describe("tRPC middleware adapter", () => {
  /** tRPC v11 wraps middleware in a builder object; extract the raw fn. */
  function unwrap(
    middleware: unknown,
  ): (opts: unknown) => Promise<unknown> {
    const inner = (middleware as { _middlewares?: unknown[] })?._middlewares?.[0];
    if (typeof inner === "function") {
      return inner as (opts: unknown) => Promise<unknown>;
    }
    return middleware as (opts: unknown) => Promise<unknown>;
  }

  function buildOpts(rawInput: unknown, ctx: Record<string, unknown> = {}) {
    let nextCalled = false;
    const opts = {
      ctx,
      getRawInput: async () => [rawInput],
      path: "test.procedure",
      type: "mutation" as const,
      next: async () => {
        nextCalled = true;
        return { ok: true };
      },
      wasNextCalled: () => nextCalled,
    };
    return opts;
  }

  it("passes valid input through to the resolver", async () => {
    const middleware = unwrap(
      withSchemaValidation("openvpm.client-registration"),
    );
    const opts = buildOpts({
      firstName: "Jana",
      lastName: "Kováčová",
      email: "jana@example.com",
      phone: "+421901234567",
    });
    const result = await middleware(opts as never);
    expect(opts.wasNextCalled()).toBe(true);
    expect(result).toEqual({ ok: true });
  });

  it("rejects invalid input with BAD_REQUEST before the resolver runs", async () => {
    const middleware = unwrap(
      withSchemaValidation("openvpm.client-registration"),
    );
    const opts = buildOpts({ firstName: "Jana" });
    await expect(middleware(opts as never)).rejects.toSatisfy((error) => {
      return (
        error instanceof TRPCError &&
        error.code === "BAD_REQUEST" &&
        error.message.includes("openvpm.client-registration")
      );
    });
    expect(opts.wasNextCalled()).toBe(false);
  });

  it("rejects AI-prefilled narcotics at the middleware boundary", async () => {
    const middleware = unwrap(
      withSchemaValidation("openvpm.controlled-substance-record"),
    );
    const opts = buildOpts({
      patientId: UUID,
      substance: "Ketamín 100 mg/ml",
      quantity: 2,
      unit: "ml",
      reason: "Anestézia",
      recordedBy: UUID,
      origin: { source: "ai-prefill" },
    });
    await expect(middleware(opts as never)).rejects.toSatisfy((error) => {
      return (
        error instanceof TRPCError &&
        error.message.includes("narcotic_ai_prefill")
      );
    });
  });

  it("refuses to build for unknown contracts", () => {
    expect(() =>
      // @ts-expect-error — intentionally invalid id
      withSchemaValidation("openvpm.does-not-exist"),
    ).toThrow(/Unknown VPM schema contract/);
  });
});

describe("tRPC envelope middleware (withSchemaValidationFromInput)", () => {
  function unwrap(
    middleware: unknown,
  ): (opts: unknown) => Promise<unknown> {
    const inner = (middleware as { _middlewares?: unknown[] })?._middlewares?.[0];
    if (typeof inner === "function") {
      return inner as (opts: unknown) => Promise<unknown>;
    }
    return middleware as (opts: unknown) => Promise<unknown>;
  }

  function buildOpts(rawInput: unknown) {
    let nextCalled = false;
    const opts = {
      ctx: {},
      getRawInput: async () => [rawInput],
      path: "test.submitPayload",
      type: "mutation" as const,
      next: async () => {
        nextCalled = true;
        return { ok: true };
      },
      wasNextCalled: () => nextCalled,
    };
    return opts;
  }

  it("validates the nested payload of a { contractId, payload } envelope", async () => {
    const middleware = unwrap(withSchemaValidationFromInput());
    const opts = buildOpts({
      contractId: "openvpm.care-reminder",
      payload: {
        patientId: UUID,
        title: "Kontrola",
        dueDate: "2026-10-01",
        automated: true,
        channels: ["email"],
        patientStatus: "deceased",
      },
    });
    await expect(middleware(opts)).rejects.toSatisfy((error) => {
      return (
        error instanceof TRPCError &&
        error.code === "BAD_REQUEST" &&
        error.message.includes("sympathy_gate")
      );
    });
    expect(opts.wasNextCalled()).toBe(false);
  });

  it("lets valid envelopes through to the resolver", async () => {
    const middleware = unwrap(withSchemaValidationFromInput());
    const opts = buildOpts({
      contractId: "openvpm.care-reminder",
      payload: {
        patientId: UUID,
        title: "Ročné očkovanie",
        dueDate: "2026-10-01",
        automated: true,
        channels: ["email"],
        patientStatus: "active",
      },
    });
    await middleware(opts);
    expect(opts.wasNextCalled()).toBe(true);
  });

  it("defers to the input parser when the envelope is malformed", async () => {
    const middleware = unwrap(withSchemaValidationFromInput());
    const opts = buildOpts({ contractId: "openvpm.unknown-contract" });
    await middleware(opts);
    expect(opts.wasNextCalled()).toBe(true);
  });
});
