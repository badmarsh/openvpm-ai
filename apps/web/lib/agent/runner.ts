import { generateText, stepCountIs, tool, type ToolSet } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { AGENT_TOOLS, type AgentToolContext } from "./tools";
import { recordUsage } from "@/lib/billing/usage";

/**
 * Provider-agnostic agent runner (Vercel AI SDK). The active model is chosen by
 * `AI_MODEL` (falling back to the legacy `AGENT_MODEL`); the provider is inferred
 * from the model id, so the same code runs on Gemini or Claude with only an env
 * change. Each tool already carries a Zod schema, which the AI SDK consumes
 * directly, and the SDK runs the tool-use loop for us up to MAX_ITERATIONS.
 */
const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_ITERATIONS = 8;
const MAX_OUTPUT_TOKENS = 1024;

const SYSTEM_PROMPT = `You are the OpenVPM Agent, an operations assistant embedded in an open-source veterinary practice management system.

You help practice staff by using the provided tools to read and act on practice data. Guidelines:
- Always use tools to ground answers in real data. Never invent client names, patient records, appointment times, or doses.
- You operate on a single practice's data; you cannot see other practices.
- For any drug dose, use calculate_drug_dose and present it as a reference range that the prescribing clinician must verify. Never present a dose as a final prescribing decision.
- Before booking an appointment, confirm you have the right client and patient (use find_client / get_patient_summary first when ids are not given).
- Be concise and clinical. Surface warnings the tools return.`;

export interface AgentToolCall {
  name: string;
  input: unknown;
  result?: unknown;
  error?: string;
}

export interface AgentRunResult {
  text: string;
  toolCalls: AgentToolCall[];
  iterations: number;
  stopReason: string | null;
}

export class AgentNotConfiguredError extends Error {
  constructor() {
    super(
      "OpenVPM Agent is not configured. Set an AI key (GOOGLE_API_KEY for Gemini, or ANTHROPIC_API_KEY for Claude) to enable agent runs."
    );
    this.name = "AgentNotConfiguredError";
  }
}

/** Resolve the model id from request override → AI_MODEL → legacy AGENT_MODEL → default. */
function activeModelId(override?: string): string {
  return override || process.env.AI_MODEL || process.env.AGENT_MODEL || DEFAULT_MODEL;
}

/** Google (Gemini) vs Anthropic (Claude) inferred from the model id. */
function isGoogleModel(modelId: string): boolean {
  return /^(google\/|models\/)?gemini/i.test(modelId);
}

function googleApiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

/** Whether the configured provider has its API key set. */
export function isAgentConfigured(): boolean {
  return isGoogleModel(activeModelId())
    ? Boolean(googleApiKey())
    : Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Build an AI SDK model instance for the given model id. */
function resolveModel(modelId: string) {
  if (isGoogleModel(modelId)) {
    const google = createGoogleGenerativeAI({ apiKey: googleApiKey() });
    return google(modelId.replace(/^google\//, ""));
  }
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic(modelId.replace(/^anthropic\//, ""));
}

/**
 * Build the AI SDK tool set from AGENT_TOOLS. Write tools are gated behind
 * `allowWrites`; every call (and any error) is captured into `sink` so the
 * caller can report exactly what the agent did, mirroring the prior runner.
 */
function buildToolSet(
  ctx: AgentToolContext,
  allowWrites: boolean,
  sink: AgentToolCall[]
): ToolSet {
  const entries = AGENT_TOOLS.map((t) => [
    t.name,
    tool({
      description: t.description,
      inputSchema: t.zod,
      execute: async (args: unknown) => {
        const call: AgentToolCall = { name: t.name, input: args };
        try {
          if (!t.readOnly && !allowWrites) {
            call.error = "Write tools are disabled for this run.";
          } else {
            call.result = await t.execute(args, ctx);
          }
        } catch (e) {
          call.error = e instanceof Error ? e.message : "Tool execution failed";
        }
        sink.push(call);
        return call.error ? { error: call.error } : call.result;
      },
    }),
  ] as const);
  return Object.fromEntries(entries) as ToolSet;
}

/**
 * Run the OpenVPM Agent against a natural-language instruction. Executes a
 * tool-use loop scoped to the caller's practice. Write tools are gated behind
 * `allowWrites` (default false) so a read-only run can never mutate data.
 */
export async function runAgent(opts: {
  instruction: string;
  context: AgentToolContext;
  allowWrites?: boolean;
  model?: string;
}): Promise<AgentRunResult> {
  const modelId = activeModelId(opts.model);
  const hasKey = isGoogleModel(modelId)
    ? Boolean(googleApiKey())
    : Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasKey) throw new AgentNotConfiguredError();

  const allowWrites = opts.allowWrites ?? false;

  // Meter the agent run for hosted billing (no-op on self-host).
  void recordUsage({ practiceId: opts.context.practiceId, kind: "ai_run" });

  const toolCalls: AgentToolCall[] = [];
  const result = await generateText({
    model: resolveModel(modelId),
    system: SYSTEM_PROMPT,
    prompt: opts.instruction,
    tools: buildToolSet(opts.context, allowWrites, toolCalls),
    stopWhen: stepCountIs(MAX_ITERATIONS),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });

  return {
    text: result.text.trim(),
    toolCalls,
    iterations: result.steps.length,
    stopReason: result.finishReason ?? null,
  };
}

/** Names of tools the agent can use, for surfacing in the UI/docs. */
export const AGENT_TOOL_NAMES = AGENT_TOOLS.map((t) => t.name);
