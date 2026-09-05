import { readFileSync } from "node:fs";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  AgentNotConfiguredError,
  isAgentConfigured,
  buildFallbackSummary,
} from "../runner";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAgentConfigured (provider-agnostic)", () => {
  function stubVertexOidcConfiguration() {
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "openvpm-ai");
    vi.stubEnv("GOOGLE_VERTEX_LOCATION", "global");
    vi.stubEnv("GCP_PROJECT_NUMBER", "123456789012");
    vi.stubEnv(
      "GCP_SERVICE_ACCOUNT_EMAIL",
      "vertex@openvpm-ai.iam.gserviceaccount.com",
    );
    vi.stubEnv("GCP_WORKLOAD_IDENTITY_POOL_ID", "vercel");
    vi.stubEnv("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID", "vercel");
  }

  function stubVertexServiceAccountConfiguration() {
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "openvpm-ai");
    vi.stubEnv("GOOGLE_VERTEX_LOCATION", "global");
    vi.stubEnv(
      "GOOGLE_CLIENT_EMAIL",
      "vertex@openvpm-ai.iam.gserviceaccount.com",
    );
    vi.stubEnv("GOOGLE_PRIVATE_KEY", "synthetic-line-one\\nsynthetic-line-two");
  }

  it("a Gemini model accepts the complete Vertex AI OIDC boundary", () => {
    vi.stubEnv("AI_MODEL", " gemini-3.5-flash ");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test"); // wrong provider's key
    expect(isAgentConfigured()).toBe(false);

    stubVertexOidcConfiguration();
    expect(isAgentConfigured()).toBe(true);
  });

  it("keeps a complete service account boundary for non-Vercel self-hosting", () => {
    vi.stubEnv("AI_MODEL", "gemini-3.5-flash");
    stubVertexServiceAccountConfiguration();
    expect(isAgentConfigured()).toBe(true);
  });

  it("names Vertex AI in the not-configured error", () => {
    expect(new AgentNotConfiguredError().message).toContain(
      "Google Vertex AI for Gemini",
    );
  });

  it("a Claude model is configured only with a non-blank Anthropic API key", () => {
    vi.stubEnv("AI_MODEL", "claude-sonnet-4-6");
    vi.stubEnv("ANTHROPIC_API_KEY", "   ");
    stubVertexOidcConfiguration(); // wrong provider's credentials
    expect(isAgentConfigured()).toBe(false);
    vi.stubEnv("ANTHROPIC_API_KEY", " sk-ant-test ");
    expect(isAgentConfigured()).toBe(true);
  });

  it("defaults to Gemini on Vertex when AI_MODEL/AGENT_MODEL are blank", () => {
    vi.stubEnv("AI_MODEL", " ");
    vi.stubEnv("AGENT_MODEL", "   ");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(isAgentConfigured()).toBe(false);
    stubVertexOidcConfiguration();
    expect(isAgentConfigured()).toBe(true);
  });

  it("trims the legacy AGENT_MODEL fallback before choosing the provider", () => {
    vi.stubEnv("AI_MODEL", "");
    vi.stubEnv("AGENT_MODEL", " google/gemini-3.5-flash ");
    stubVertexOidcConfiguration();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(isAgentConfigured()).toBe(true);
  });

  it("rethrows stale-practice tool failures instead of returning them to the model", () => {
    const source = readFileSync(
      new URL("../runner.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain("AgentPracticeNotFoundError");
    expect(source).toContain("e instanceof AgentPracticeNotFoundError");
    expect(source).toContain("throw e");
  });
});

describe("buildFallbackSummary", () => {
  it("provides helpful Slovak diagnostic message when client found but patient not found", () => {
    const summary = buildFallbackSummary(
      [
        {
          name: "find_client",
          input: { query: "Keľová" },
          result: [{ id: "c1", firstName: "Margaréta", lastName: "Keľová" }],
        },
      ],
      "podrobnosti o Pupinka Margaréta Keľová",
    );

    expect(summary).toContain("Asistent dosiahol maximálny počet krokov");
    expect(summary).toContain("Klient bol v systéme nájdený, ale nepodarilo sa jednoznačne dohľadať");
    expect(summary).toContain("Skúste prosím overiť meno zvieraťa");
  });

  it("provides helpful Slovak diagnostic message when neither client nor patient found", () => {
    const summary = buildFallbackSummary(
      [
        {
          name: "find_patient",
          input: { query: "Pupinka" },
          result: [],
        },
      ],
      "podrobnosti o Pupinka",
    );

    expect(summary).toContain("Pre zadané kritériá sa v systéme nenašiel zodpovedajúci klient ani pacient");
  });

  it("provides helpful English diagnostic message for English instructions", () => {
    const summary = buildFallbackSummary(
      [
        {
          name: "find_client",
          input: { query: "Smith" },
          result: [],
        },
      ],
      "details about Fluffy Smith",
    );

    expect(summary).toContain("The agent reached the maximum number of steps");
    expect(summary).toContain("No matching client or patient was found");
  });

  it("handles empty tool calls gracefully", () => {
    const summarySk = buildFallbackSummary([], "otázka na kliniku");
    expect(summarySk).toContain("Asistent nedokázal vygenerovať odpoveď");

    const summaryEn = buildFallbackSummary([], "question about clinic");
    expect(summaryEn).toContain("The agent reached the step limit");
  });
});
