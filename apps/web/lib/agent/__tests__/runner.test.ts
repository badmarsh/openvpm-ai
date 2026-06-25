import { describe, it, expect, vi, afterEach } from "vitest";
import { isAgentConfigured } from "../runner";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAgentConfigured (provider-agnostic)", () => {
  it("a Gemini model is configured only with GOOGLE_API_KEY", () => {
    vi.stubEnv("AI_MODEL", "gemini-2.5-flash");
    vi.stubEnv("GOOGLE_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test"); // wrong provider's key
    expect(isAgentConfigured()).toBe(false);
    vi.stubEnv("GOOGLE_API_KEY", "AIza-test");
    expect(isAgentConfigured()).toBe(true);
  });

  it("a Claude model is configured only with ANTHROPIC_API_KEY", () => {
    vi.stubEnv("AI_MODEL", "claude-sonnet-4-6");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GOOGLE_API_KEY", "AIza-test"); // wrong provider's key
    expect(isAgentConfigured()).toBe(false);
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(isAgentConfigured()).toBe(true);
  });

  it("defaults to Claude when AI_MODEL/AGENT_MODEL are unset", () => {
    vi.stubEnv("AI_MODEL", "");
    vi.stubEnv("AGENT_MODEL", "");
    vi.stubEnv("GOOGLE_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(isAgentConfigured()).toBe(true);
  });
});
