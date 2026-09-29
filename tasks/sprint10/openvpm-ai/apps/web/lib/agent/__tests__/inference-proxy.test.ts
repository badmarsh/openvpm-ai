import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgentNotConfiguredError,
  configuredModel,
  isAgentConfigured,
} from "../runner";
import {
  inferenceProxyBaseUrl,
  inferenceProxyModel,
} from "../inference-proxy";
import { DEFAULT_AI_MODEL } from "@/lib/ai-models";

const mocks = vi.hoisted(() => {
  const proxyModel = vi.fn((modelId: string) => ({
    provider: "openvpm-inference-proxy",
    modelId,
  }));
  return {
    proxyModel,
    createOpenAICompatible: vi.fn(() => proxyModel),
    createVertex: vi.fn(() => vi.fn()),
  };
});

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: mocks.createOpenAICompatible,
}));

vi.mock("@ai-sdk/google-vertex", () => ({
  createVertex: mocks.createVertex,
}));

const PROXY_URL = "http://127.0.0.1:8045/v1";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OpenAI-compatible inference proxy (AT_PROXY_URL)", () => {
  it("resolves the default Gemini model through the proxy without any Google credential", () => {
    vi.stubEnv("AT_PROXY_URL", PROXY_URL);
    vi.stubEnv("AT_PROXY_KEY", "sk-proxy-test");
    // Vertex and Anthropic boundaries are deliberately absent.
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    expect(isAgentConfigured()).toBe(true);
    expect(configuredModel()).toEqual({
      provider: "openvpm-inference-proxy",
      modelId: DEFAULT_AI_MODEL,
    });

    expect(mocks.createOpenAICompatible).toHaveBeenCalledWith({
      name: "openvpm-at-proxy",
      baseURL: PROXY_URL,
      apiKey: "sk-proxy-test",
    });
  });

  it("takes precedence over Vertex AI for the default Gemini model id", () => {
    vi.stubEnv("AT_PROXY_URL", ` ${PROXY_URL} `);
    vi.stubEnv("AT_PROXY_KEY", "sk-proxy-test");
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "openvpm-ai");
    vi.stubEnv("GOOGLE_VERTEX_LOCATION", "global");
    vi.stubEnv(
      "GOOGLE_CLIENT_EMAIL",
      "vertex@openvpm-ai.iam.gserviceaccount.com",
    );
    vi.stubEnv(
      "GOOGLE_PRIVATE_KEY",
      "synthetic-line-one\\nsynthetic-line-two",
    );

    configuredModel();

    expect(mocks.createOpenAICompatible).toHaveBeenCalledWith({
      name: "openvpm-at-proxy",
      baseURL: PROXY_URL,
      apiKey: "sk-proxy-test",
    });
    expect(mocks.proxyModel).toHaveBeenCalledWith(DEFAULT_AI_MODEL);
    expect(mocks.createVertex as any).not.toHaveBeenCalled();
  });

  it("also serves Claude model ids, stripping the provider prefix", () => {
    vi.stubEnv("AT_PROXY_URL", PROXY_URL);
    vi.stubEnv("AT_PROXY_KEY", "sk-proxy-test");
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    expect(isAgentConfigured()).toBe(true);
    expect(mocks.proxyModel).not.toHaveBeenCalled();

    inferenceProxyModel("anthropic/claude-sonnet-4-6");
    expect(mocks.proxyModel).toHaveBeenCalledWith("claude-sonnet-4-6");
  });

  it("defaults the bearer token to 'at-proxy' when AT_PROXY_KEY is blank", () => {
    vi.stubEnv("AT_PROXY_URL", PROXY_URL);
    vi.stubEnv("AT_PROXY_KEY", "   ");

    configuredModel();

    expect(mocks.createOpenAICompatible).toHaveBeenCalledWith({
      name: "openvpm-at-proxy",
      baseURL: PROXY_URL,
      apiKey: "at-proxy",
    });
  });

  it("stays inert when AT_PROXY_URL is unset, keeping the Vertex boundary required", () => {
    vi.stubEnv("AT_PROXY_URL", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    expect(isAgentConfigured()).toBe(false);
    expect(() => configuredModel()).toThrow(AgentNotConfiguredError);
    expect(mocks.createOpenAICompatible).not.toHaveBeenCalled();
  });

  it("does not treat a whitespace-only AT_PROXY_URL as configuration", () => {
    vi.stubEnv("AT_PROXY_URL", "   ");

    expect(isAgentConfigured()).toBe(false);
    expect(mocks.createOpenAICompatible).not.toHaveBeenCalled();
  });

  it("normalizes URLs lacking /v1 and strips trailing slashes", () => {
    vi.stubEnv("AT_PROXY_URL", "https://call-fly-cabinet-namely.trycloudflare.com");
    expect(inferenceProxyBaseUrl()).toBe("https://call-fly-cabinet-namely.trycloudflare.com/v1");

    vi.stubEnv("AT_PROXY_URL", "https://call-fly-cabinet-namely.trycloudflare.com/");
    expect(inferenceProxyBaseUrl()).toBe("https://call-fly-cabinet-namely.trycloudflare.com/v1");

    vi.stubEnv("AT_PROXY_URL", "https://call-fly-cabinet-namely.trycloudflare.com/v1");
    expect(inferenceProxyBaseUrl()).toBe("https://call-fly-cabinet-namely.trycloudflare.com/v1");

    vi.stubEnv("AT_PROXY_URL", "https://call-fly-cabinet-namely.trycloudflare.com/v1/");
    expect(inferenceProxyBaseUrl()).toBe("https://call-fly-cabinet-namely.trycloudflare.com/v1");
  });
});
