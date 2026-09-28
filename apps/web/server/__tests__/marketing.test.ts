import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configuredModel: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("@/lib/agent/runner", () => ({
  configuredModel: mocks.configuredModel,
  configuredModelId: () => "gemini-mock",
  isAgentConfigured: () => true,
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
}));

vi.mock("@/lib/billing/ai-gate", () => ({
  assertHostedAiGate: vi.fn().mockResolvedValue(undefined),
}));

const { marketingRouter } = await import("../routers/extensions/marketing");

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";

function caller(customDb?: Record<string, unknown>) {
  const db: Record<string, unknown> = customDb ?? {
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
    execute: vi.fn(async () => undefined),
  };
  const session = {
    user: {
      id: USER_ID,
      email: "marketing@example.com",
      name: "Veterinarian",
      role: "veterinarian",
      practiceId: PRACTICE_ID,
    },
  };
  return marketingRouter.createCaller({ db, session } as never);
}

describe("marketingRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configuredModel.mockReturnValue("gemini-mock");
  });

  it("listTemplates returns pre-configured Slovak veterinary campaign templates", async () => {
    const trpcCaller = caller();
    const templates = await trpcCaller.listTemplates();

    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThanOrEqual(6);

    const templateIds = templates.map((t) => t.id);
    expect(templateIds).toContain("ticks_fleas");
    expect(templateIds).toContain("dental_hygiene");
    expect(templateIds).toContain("rabies_awareness");
    expect(templateIds).toContain("geriatric_senior");
    expect(templateIds).toContain("neutering_program");
    expect(templateIds).toContain("fireworks_anxiety");

    const rabiesTemplate = templates.find((t) => t.id === "rabies_awareness");
    expect(rabiesTemplate?.sampleInstagram).toContain("besnote");
    expect(rabiesTemplate?.sampleEmailSubject).toBeDefined();
  });

  it("generatePost returns AI-generated multi-channel content when LLM succeeds", async () => {
    mocks.generateText.mockResolvedValueOnce({
      text: JSON.stringify({
        instagram: "🐾 AI Instagram post pre kliešte #veterinar",
        facebook: "Kliešte sú opäť hrozbou pre vašich psov...",
        sms: "Klinika: Kliešte sú späť! Zastavte sa pre antiparazitiká.",
        emailSubject: "Pozor na kliešte v jarných mesiacoch",
        emailBody: "Vážení klienti, začína sezóna kliešťov...",
      }),
    });

    const trpcCaller = caller();
    const result = await trpcCaller.generatePost({
      topic: "Kliešte a blchy",
      channel: "all",
      tone: "friendly",
      clinicName: "VetClinic Bratislava",
      phoneNumber: "+421 900 123 456",
    });

    expect(result.usedAi).toBe(true);
    // The toast must not claim a provider the deployment does not use.
    expect(result.model).toBe("gemini-mock");
    expect(result.instagram).toContain("AI Instagram post");
    expect(result.facebook).toContain("Kliešte sú opäť");
    expect(result.sms).toContain("Klinika: Kliešte");
    expect(result.emailSubject).toContain("Pozor na kliešte");
    expect(result.emailBody).toContain("Vážení klienti");
  });

  it("generatePost fails visibly when the provider is not configured (no template substitute)", async () => {
    // Owner decision 2026-09-28: no silent substitution. A clinic that has not
    // configured an engine must see that, not a canned clinical template that
    // looks like the model wrote it.
    mocks.generateText.mockRejectedValueOnce(
      new Error("OpenVPM Agent is not configured. Configure Google Vertex AI for Gemini."),
    );

    const trpcCaller = caller();
    await expect(
      trpcCaller.generatePost({
        topic: "Ochrana pred kliešťami a blchami",
        channel: "all",
        tone: "professional",
        clinicName: "VetClinic",
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      cause: { code: "ai_not_configured", kind: "text" },
    });
  });

  it("generatePost reports a provider failure instead of inventing a generic post", async () => {
    mocks.generateText.mockRejectedValueOnce(new Error("socket hang up"));

    const trpcCaller = caller();
    await expect(
      trpcCaller.generatePost({
        topic: "Strihanie pazúrikov a čistenie uší",
        channel: "all",
        tone: "friendly",
        clinicName: "Moja Klinika",
        phoneNumber: "+421 911 222 333",
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("generatePost refuses to hand back a canned body when the model answers without JSON", async () => {
    mocks.generateText.mockResolvedValueOnce({ text: "Prepáč, neviem." });

    const trpcCaller = caller();
    await expect(
      trpcCaller.generatePost({ topic: "Kliešte", channel: "all", tone: "friendly" }),
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  });

  it("syncExternalReviews pulls reviews from connected channels and tags negative reviews for escalation", async () => {
    const insertedReviews: any[] = [];
    let selectCallCount = 0;

    const mockDb: any = {
      transaction: async (fn: (tx: unknown) => unknown) => fn(mockDb),
      execute: vi.fn(async () => undefined),
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              // 1st select: channels query
              return Promise.resolve([
                { id: "ch-gmb", provider: "google_business", status: "connected" },
                { id: "ch-fb", provider: "facebook", status: "connected" },
              ]);
            }
            // subsequent selects: deduplication check returning []
            return {
              limit: vi.fn().mockResolvedValue([]),
            };
          }),
        })),
      })),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((val) => {
          insertedReviews.push(val);
          return Promise.resolve([val]);
        }),
      })),
    };

    const trpcCaller = caller(mockDb);
    const result = await trpcCaller.syncExternalReviews({
      platform: "all",
      simulateNewReviews: true,
    });

    expect(result.success).toBe(true);
    expect(result.channelsChecked).toBe(2);
    expect(result.insertedCount).toBeGreaterThan(0);
    expect(result.escalatedCount).toBeGreaterThanOrEqual(1);

    // Verify negative review was tagged with escalationStatus = "pending"
    const negative = insertedReviews.find((r) => r.rating <= 2);
    expect(negative).toBeDefined();
    expect(negative?.escalationStatus).toBe("pending");
    expect(negative?.sentimentLabel).toBe("negative");
  });

  it("generateImage fails visibly when no image engine is configured (no stock substitute)", async () => {
    // The curated clinical fallback photos used to be returned as if the model
    // had generated them. They are still shipped as assets a user can attach
    // deliberately; they are just no longer passed off as AI output.
    const trpcCaller = caller();

    await expect(
      trpcCaller.generateImage({
        prompt: "Dentálna hygiena a čistenie zubov ultrazvukom",
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      cause: { code: "ai_not_configured", kind: "image" },
    });

    await expect(
      trpcCaller.generateImage({ prompt: "Starostlivosť o psíka seniora" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("getAlibabaProxyStatus reports the text engine the copy generator will use", async () => {
    const trpcCaller = caller();
    const status = await trpcCaller.getAlibabaProxyStatus();

    expect(status.text).toEqual({ isConfigured: true, modelId: "gemini-mock" });
    expect(typeof status.anyMediaProviderOnline).toBe("boolean");
  });
});


