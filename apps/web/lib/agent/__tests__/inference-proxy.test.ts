import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgentNotConfiguredError,
  configuredModel,
  isAgentConfigured,
} from "../runner";

const mocks = vi.hoisted(() => {
  const proxyModel = vi.fn((modelId: string) => ({
    provider: "openvpm-inference-proxy",
    modelId,
  }));
  return {
    proxyModel,
    createOpenAICompatible: vi.fn(() => proxyModel),
  };
});

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: mocks.createOpenAICompatible,
}));

const PROXY_URL = "http://127.0.0.1:8045/v1";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OpenAI-compatible inference proxy (AI_BASE_URL)", () => {
  it("resolves a Gemini model through the proxy without any Google credential", () => {
    vi.stubEnv("AI_MODEL", "gemini-3.8-flash-medium");
    vi.stubEnv("AI_BASE_URL", PROXY_URL);
    vi.stubEnv("AI_API_KEY", "sk-proxy-test");
    // Vertex and Anthropic boundaries are deliberately absent.
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    expect(isAgentConfigured()).toBe(true);
    expect(configuredModel()).toEqual({
      provider: "openvpm-inference-proxy",
      modelId: "gemini-3.8-flash-medium",
    });

    expect(mocks.createOpenAICompatible).toHaveBeenCalledWith({
      name: "openvpm-inference-proxy",
      baseURL: PROXY_URL,
      apiKey: "sk-proxy-test",
    });
  });

  it("takes precedence over Vertex AI for a Gemini model id", () => {
    vi.stubEnv("AI_MODEL", " gemini-3.8-flash-medium ");
    vi.stubEnv("AI_BASE_URL", ` ${PROXY_URL} `);
    vi.stubEnv("AI_API_KEY", "sk-proxy-test");
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
      name: "openvpm-inference-proxy",
      baseURL: PROXY_URL,
      apiKey: "sk-proxy-test",
    });
    expect(mocks.proxyModel).toHaveBeenCalledWith("gemini-3.8-flash-medium");
  });

  it("also serves Claude model ids, stripping the provider prefix", () => {
    vi.stubEnv("AI_MODEL", "anthropic/claude-sonnet-4-6");
    vi.stubEnv("AI_BASE_URL", PROXY_URL);
    vi.stubEnv("AI_API_KEY", "sk-proxy-test");
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    expect(isAgentConfigured()).toBe(true);
    expect(mocks.proxyModel).not.toHaveBeenCalled();

    configuredModel();
    expect(mocks.proxyModel).toHaveBeenCalledWith("claude-sonnet-4-6");
  });

  it("omits the Authorization key when AI_API_KEY is blank", () => {
    vi.stubEnv("AI_MODEL", "gemini-3.8-flash-medium");
    vi.stubEnv("AI_BASE_URL", PROXY_URL);
    vi.stubEnv("AI_API_KEY", "   ");

    configuredModel();

    expect(mocks.createOpenAICompatible).toHaveBeenCalledWith({
      name: "openvpm-inference-proxy",
      baseURL: PROXY_URL,
      apiKey: undefined,
    });
  });

  it("stays inert when AI_BASE_URL is unset, keeping the Vertex boundary required", () => {
    vi.stubEnv("AI_MODEL", "gemini-3.8-flash-medium");
    vi.stubEnv("AI_BASE_URL", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    expect(isAgentConfigured()).toBe(false);
    expect(() => configuredModel()).toThrow(AgentNotConfiguredError);
    expect(mocks.createOpenAICompatible).not.toHaveBeenCalled();
  });

  it("does not treat a whitespace-only AI_BASE_URL as configuration", () => {
    vi.stubEnv("AI_MODEL", "gemini-3.8-flash-medium");
    vi.stubEnv("AI_BASE_URL", "   ");

    expect(isAgentConfigured()).toBe(false);
    expect(mocks.createOpenAICompatible).not.toHaveBeenCalled();
  });
});
