import { readFileSync } from "node:fs";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  AgentNotConfiguredError,
  isAgentConfigured,
  buildFallbackSummary,
  isProxyFormatError,
} from "../runner";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAgentConfigured (provider-agnostic)", () => {
  const GEMINI_MODEL = "google/gemini-3.5-flash";

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
    vi.stubEnv("AT_PROXY_URL", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test"); // wrong provider's key
    // Env no longer selects the model, so the model under test is passed in.
    expect(isAgentConfigured(GEMINI_MODEL)).toBe(false);

    stubVertexOidcConfiguration();
    expect(isAgentConfigured(GEMINI_MODEL)).toBe(true);
  });

  it("keeps a complete service account boundary for non-Vercel self-hosting", () => {
    vi.stubEnv("AT_PROXY_URL", "");
    stubVertexServiceAccountConfiguration();
    expect(isAgentConfigured(GEMINI_MODEL)).toBe(true);
  });

  it("names every provider boundary in the not-configured error", () => {
    const message = new AgentNotConfiguredError().message;
    expect(message).toContain("AT_PROXY_URL");
    expect(message).toContain("Google Vertex AI");
    expect(message).toContain("ANTHROPIC_API_KEY");
  });

  it("a Gemini model requires a complete Vertex boundary even when an Anthropic key is present", () => {
    vi.stubEnv("AT_PROXY_URL", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(isAgentConfigured(GEMINI_MODEL)).toBe(false);

    stubVertexOidcConfiguration();
    expect(isAgentConfigured(GEMINI_MODEL)).toBe(true);
  });

  it("a blank Anthropic key alone is never a complete boundary", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "   ");
    expect(isAgentConfigured()).toBe(false);
  });

  it("ignores AI_MODEL/AGENT_MODEL and resolves the proxy-served default", () => {
    // Env vars no longer select the model: the default qwen-max is served only
    // by the inference proxy, so a Vertex or Anthropic boundary must not make it
    // look configured.
    vi.stubEnv("AI_MODEL", "google/gemini-3.5-flash");
    vi.stubEnv("AGENT_MODEL", " google/gemini-3.5-flash ");
    stubVertexOidcConfiguration();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("AT_PROXY_URL", "");
    expect(isAgentConfigured()).toBe(false);

    vi.stubEnv("AT_PROXY_URL", "https://ai-proxy.example/v1");
    expect(isAgentConfigured()).toBe(true);
  });

  it("never routes a non-Claude model to the Anthropic boundary", () => {
    // The trap this guards: "not Gemini" used to mean "Anthropic", so qwen-max
    // was reported configured whenever an Anthropic key happened to be set and
    // then sent to api.anthropic.com.
    vi.stubEnv("AT_PROXY_URL", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(isAgentConfigured("qwen-max")).toBe(false);

    // A real Claude id does take the Anthropic boundary.
    expect(isAgentConfigured("claude-sonnet-4-5")).toBe(true);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(isAgentConfigured("claude-sonnet-4-5")).toBe(false);
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

describe("isProxyFormatError", () => {
  it("detects the Chinese proxy format error message", () => {
    const msg =
      "很抱歉，当前模型在尝试调取实时信息时遇到了格式异常。若需要查询实时天气或最新资讯，请尝试使用联网模式（模型名带 -online 后缀）或配置天气/搜索插件。";
    expect(isProxyFormatError(msg)).toBe(true);
  });

  it("detects individual keywords from proxy format exceptions", () => {
    expect(isProxyFormatError("格式异常")).toBe(true);
    expect(isProxyFormatError("调取实时信息")).toBe(true);
    expect(isProxyFormatError("联网模式")).toBe(true);
    expect(isProxyFormatError("model-online")).toBe(true);
  });

  it("returns false for regular Slovak/English natural language answers", () => {
    expect(
      isProxyFormatError("Pre 12 kg psa je dávka karprofénu 48 mg denne."),
    ).toBe(false);
    expect(
      isProxyFormatError("The recommended dose of carprofen is 4 mg/kg."),
    ).toBe(false);
    expect(isProxyFormatError(null)).toBe(false);
    expect(isProxyFormatError(undefined)).toBe(false);
    expect(isProxyFormatError("")).toBe(false);
  });
});

