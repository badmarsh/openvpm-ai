import Anthropic from "@anthropic-ai/sdk";
import {
  AGENT_TOOLS,
  anthropicToolDefs,
  getTool,
  type AgentToolContext,
} from "./tools";

const DEFAULT_MODEL = process.env.AGENT_MODEL || "claude-sonnet-4-6";
const MAX_ITERATIONS = 8;

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
      "OpenVPM Agent is not configured. Set ANTHROPIC_API_KEY to enable agent runs."
    );
    this.name = "AgentNotConfiguredError";
  }
}

export function isAgentConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Run the OpenVPM Agent against a natural-language instruction. Executes a
 * tool-use loop with Claude, scoped to the caller's practice. Write tools are
 * gated behind `allowWrites` (default false) so a read-only run can never
 * mutate data.
 */
export async function runAgent(opts: {
  instruction: string;
  context: AgentToolContext;
  allowWrites?: boolean;
  model?: string;
}): Promise<AgentRunResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AgentNotConfiguredError();

  const client = new Anthropic({ apiKey });
  const allowWrites = opts.allowWrites ?? false;

  // Prompt caching: cache the (static) system prompt and tool defs across the
  // loop's turns so only the growing message tail is re-billed at full rate.
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];
  const toolDefs = anthropicToolDefs() as Anthropic.Tool[];
  if (toolDefs.length > 0) {
    toolDefs[toolDefs.length - 1]!.cache_control = { type: "ephemeral" };
  }

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: opts.instruction },
  ];

  const toolCalls: AgentToolCall[] = [];
  let stopReason: string | null = null;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    const response = await client.messages.create({
      model: opts.model || DEFAULT_MODEL,
      max_tokens: 1024,
      system,
      tools: toolDefs,
      messages,
    });
    stopReason = response.stop_reason;

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { text, toolCalls, iterations: iteration, stopReason };
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const use of toolUses) {
      const tool = getTool(use.name);
      const call: AgentToolCall = { name: use.name, input: use.input };

      if (!tool) {
        call.error = `Unknown tool: ${use.name}`;
      } else if (!tool.readOnly && !allowWrites) {
        call.error = "Write tools are disabled for this run.";
      } else {
        try {
          call.result = await tool.execute(use.input, opts.context);
        } catch (e) {
          call.error = e instanceof Error ? e.message : "Tool execution failed";
        }
      }

      toolCalls.push(call);
      toolResults.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: JSON.stringify(call.error ? { error: call.error } : call.result),
        is_error: Boolean(call.error),
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return {
    text: "Agent reached the maximum number of steps without finishing.",
    toolCalls,
    iterations: MAX_ITERATIONS,
    stopReason,
  };
}

/** Names of tools the agent can use, for surfacing in the UI/docs. */
export const AGENT_TOOL_NAMES = AGENT_TOOLS.map((t) => t.name);
