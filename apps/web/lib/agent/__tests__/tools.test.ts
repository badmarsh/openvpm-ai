import { describe, it, expect } from "vitest";
import { AGENT_TOOLS, getTool, anthropicToolDefs } from "../tools";
import type { AgentToolContext } from "../tools";

// The DB is never touched by these tests — only pure tools (calculate_drug_dose)
// are executed; DB-backed tools are exercised at the validation layer.
const fakeCtx = { practiceId: "p", userId: "u" } as unknown as AgentToolContext;

describe("agent tool registry", () => {
  it("has unique tool names", () => {
    const names = AGENT_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("flags exactly the write tools as not read-only", () => {
    const writeTools = AGENT_TOOLS.filter((t) => !t.readOnly).map((t) => t.name).sort();
    expect(writeTools).toEqual(["book_appointment", "record_vital_signs"]);
  });

  it("exposes Anthropic-format defs with required fields", () => {
    for (const def of anthropicToolDefs()) {
      expect(typeof def.name).toBe("string");
      expect(typeof def.description).toBe("string");
      expect(def.input_schema).toMatchObject({ type: "object" });
    }
  });

  it("getTool resolves by name and returns undefined otherwise", () => {
    expect(getTool("find_client")?.name).toBe("find_client");
    expect(getTool("nope")).toBeUndefined();
  });
});

describe("calculate_drug_dose tool (pure)", () => {
  const tool = getTool("calculate_drug_dose")!;

  it("returns a dose range for valid input", async () => {
    const result = (await tool.execute(
      { drugId: "carprofen", species: "canine", weightKg: 10 },
      fakeCtx
    )) as { doseLowMg: number; doseHighMg: number };
    expect(result.doseLowMg).toBe(22);
    expect(result.doseHighMg).toBe(44);
  });

  it("rejects invalid args via its zod schema", () => {
    const parsed = tool.zod.safeParse({ drugId: "carprofen", species: "canine", weightKg: -1 });
    expect(parsed.success).toBe(false);
  });
});

describe("book_appointment validation", () => {
  const tool = getTool("book_appointment")!;

  it("rejects end before start", () => {
    const parsed = tool.zod.safeParse({
      startTime: "2026-03-01T10:00:00.000Z",
      endTime: "2026-03-01T09:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a valid window", () => {
    const parsed = tool.zod.safeParse({
      startTime: "2026-03-01T09:00:00.000Z",
      endTime: "2026-03-01T09:30:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });
});
