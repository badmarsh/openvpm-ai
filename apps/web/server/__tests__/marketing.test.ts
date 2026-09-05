import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configuredModel: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("@/lib/agent/runner", () => ({
  configuredModel: mocks.configuredModel,
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
}));

const { marketingRouter } = await import("../routers/extensions/marketing");

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";

function caller() {
  const db: Record<string, unknown> = {
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
    expect(result.instagram).toContain("AI Instagram post");
    expect(result.facebook).toContain("Kliešte sú opäť");
    expect(result.sms).toContain("Klinika: Kliešte");
    expect(result.emailSubject).toContain("Pozor na kliešte");
    expect(result.emailBody).toContain("Vážení klienti");
  });

  it("generatePost falls back to pre-configured templates when LLM throws error", async () => {
    mocks.generateText.mockRejectedValueOnce(new Error("Gemini quota exceeded"));

    const trpcCaller = caller();
    const result = await trpcCaller.generatePost({
      topic: "Ochrana pred kliešťami a blchami",
      channel: "all",
      tone: "professional",
      clinicName: "VetClinic",
    });

    expect(result.usedAi).toBe(false);
    expect(result.instagram).toContain("kliešťov");
    expect(result.facebook).toContain("ektoparazitov");
    expect(result.sms).toBeDefined();
  });

  it("generatePost creates generic veterinary post when topic does not match any template and LLM is unavailable", async () => {
    mocks.generateText.mockRejectedValueOnce(new Error("Network offline"));

    const trpcCaller = caller();
    const result = await trpcCaller.generatePost({
      topic: "Strihanie pazúrikov a čistenie uší",
      channel: "all",
      tone: "friendly",
      clinicName: "Moja Klinika",
      phoneNumber: "+421 911 222 333",
    });

    expect(result.usedAi).toBe(false);
    expect(result.instagram).toContain("Strihanie pazúrikov a čistenie uší");
    expect(result.sms).toContain("Moja Klinika");
    expect(result.sms).toContain("+421 911 222 333");
  });
});
