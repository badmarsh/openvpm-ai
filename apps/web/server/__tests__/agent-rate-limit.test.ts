import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class AgentNotConfiguredError extends Error {
    constructor() {
      super("OpenVPM Agent is not configured.");
      this.name = "AgentNotConfiguredError";
    }
  }

  class AgentRateLimitedError extends Error {
    readonly retryAfterSeconds: number;

    constructor(retryAfterSeconds: number) {
      super("Too many agent runs. Try again later.");
      this.name = "AgentRateLimitedError";
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }

  class AgentPracticeNotFoundError extends Error {
    constructor() {
      super("Practice not found");
      this.name = "AgentPracticeNotFoundError";
    }
  }

  class AgentRecoveryHoldError extends Error {
    constructor() {
      super("Practice recovery is in progress.");
      this.name = "AgentRecoveryHoldError";
    }
  }

  class AgentBillingAccessError extends Error {
    constructor(message = "Add a card to your trial to try OpenVPM AI.") {
      super(message);
      this.name = "AgentBillingAccessError";
    }
  }

  return {
    AgentNotConfiguredError,
    AgentPracticeNotFoundError,
    AgentRecoveryHoldError,
    AgentBillingAccessError,
    AgentRateLimitedError,
    runAgent: vi.fn(),
    readHostedAiAccess: vi.fn(
      async (): Promise<{
        allowed: boolean;
        reason: string;
        message: string | null;
      } | null> => ({
        allowed: true,
        reason: "allowed",
        message: null,
      }),
    ),
  };
});

vi.mock("@/lib/agent", () => ({
  runAgent: mocks.runAgent,
  isAgentConfigured: vi.fn(() => true),
  AGENT_TOOL_NAMES: ["find_client"],
  AgentNotConfiguredError: mocks.AgentNotConfiguredError,
  AgentPracticeNotFoundError: mocks.AgentPracticeNotFoundError,
  AgentRecoveryHoldError: mocks.AgentRecoveryHoldError,
  AgentBillingAccessError: mocks.AgentBillingAccessError,
  AgentRateLimitedError: mocks.AgentRateLimitedError,
}));

vi.mock("@/lib/billing/ai-access", () => ({
  readHostedAiAccess: mocks.readHostedAiAccess,
}));

const { AGENT_INSTRUCTION_MAX_LENGTH, agentRouter } =
  await import("../routers/agent");

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const HOSTED_TRIAL_PRACTICE = {
  tier: "cloud",
  billingStatus: "trialing",
  trialEndsAt: new Date("2099-01-01T00:00:00.000Z"),
  recoveryHold: false,
};

function caller(opts?: { selectResults?: unknown[][] }) {
  const selectResults = [...(opts?.selectResults ?? [[{ id: PRACTICE_ID }]])];
  const select = vi.fn(() => {
    const result = selectResults.shift() ?? [];
    const afterWhere = {
      limit: vi.fn(async () => result),
      then: (
        resolve: (value: unknown[]) => unknown,
        reject?: (error: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject),
    };
    const builder = {
      from: vi.fn(() => builder),
      where: vi.fn(() => afterWhere),
      limit: vi.fn(async () => result),
    };
    return builder;
  });
  const tx = {
    execute: vi.fn(async () => undefined),
    select,
  };
  const db = {
    transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
    select,
  };
  const session = {
    user: {
      id: USER_ID,
      email: "doctor@example.com",
      name: "Doctor",
      role: "veterinarian",
      practiceId: PRACTICE_ID,
    },
  };
  return agentRouter.createCaller({ db, session } as never);
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.readHostedAiAccess.mockReset().mockResolvedValue({
    allowed: true,
    reason: "allowed",
    message: null,
  });
});

describe("agent router rate limits", () => {
  it("rejects oversized instructions before agent work", async () => {
    await expect(
      caller().run({
        instruction: "A".repeat(AGENT_INSTRUCTION_MAX_LENGTH + 1),
        allowWrites: false,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(mocks.runAgent).not.toHaveBeenCalled();
  });

  it("rejects blank instructions before agent work", async () => {
    await expect(
      caller().run({
        instruction: "   \n\t  ",
        allowWrites: false,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(mocks.runAgent).not.toHaveBeenCalled();
  });

  it("maps agent run throttles to TOO_MANY_REQUESTS", async () => {
    mocks.runAgent.mockRejectedValueOnce(new mocks.AgentRateLimitedError(60));

    await expect(
      caller().run({
        instruction: "Summarize today's schedule",
        allowWrites: false,
      }),
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "Too many agent runs. Try again later.",
    });
  });

  it("rejects agent runs when the practice is missing or deleted", async () => {
    await expect(
      caller({ selectResults: [[]] }).run({
        instruction: "Summarize today's schedule",
        allowWrites: false,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Practice not found",
    });

    expect(mocks.runAgent).not.toHaveBeenCalled();
  });

  it("fails closed when hosted feature gating cannot find the active practice", async () => {
    vi.stubEnv("HOSTED_BILLING_ENABLED", "true");
    mocks.readHostedAiAccess.mockResolvedValueOnce(null);

    await expect(
      caller({ selectResults: [[HOSTED_TRIAL_PRACTICE]] }).run({
        instruction: "Summarize today's schedule",
        allowWrites: false,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Practice not found",
    });

    expect(mocks.runAgent).not.toHaveBeenCalled();
  });

  it("blocks card-free hosted trials before any model call", async () => {
    vi.stubEnv("HOSTED_BILLING_ENABLED", "true");
    mocks.readHostedAiAccess.mockResolvedValue({
      allowed: false,
      reason: "billing_setup_required",
      message:
        "Add a card to your trial to try OpenVPM AI. The rest of your free trial stays available.",
    });

    await expect(
      caller({
        selectResults: [[HOSTED_TRIAL_PRACTICE]],
      }).run({
        instruction: "Summarize today's schedule",
        allowWrites: false,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("Add a card to your trial"),
    });

    expect(mocks.runAgent).not.toHaveBeenCalled();
  });

  it("maps stale practice failures from agent tools to NOT_FOUND", async () => {
    mocks.runAgent.mockRejectedValueOnce(
      new mocks.AgentPracticeNotFoundError(),
    );

    await expect(
      caller().run({
        instruction: "Summarize today's schedule",
        allowWrites: false,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Practice not found",
    });
  });

  it("maps a provider-boundary entitlement change to FORBIDDEN", async () => {
    mocks.runAgent.mockRejectedValueOnce(new mocks.AgentBillingAccessError());

    await expect(
      caller().run({
        instruction: "Summarize today's schedule",
        allowWrites: false,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("Add a card to your trial"),
    });
  });
});
