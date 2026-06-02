"use client";

import { useState } from "react";
import { Bot, Send, ChevronDown, ChevronRight, AlertTriangle, Wrench } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  "Which patients are overdue for vaccinations?",
  "Summarize today's appointments.",
  "What's the carprofen dose for a 12 kg dog?",
  "Pull a clinical summary for the next patient checked in.",
];

export default function AgentPage() {
  const status = trpc.agent.status.useQuery();
  const run = trpc.agent.run.useMutation();
  const [instruction, setInstruction] = useState("");
  const [allowWrites, setAllowWrites] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);

  const configured = status.data?.configured ?? true;

  function submit() {
    if (!instruction.trim() || run.isPending) return;
    run.mutate({ instruction: instruction.trim(), allowWrites });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold">OpenVPM Agent</h1>
          <p className="text-sm text-muted-foreground">
            Ask the agent to work on your practice data. It uses real tools and
            never invents records.
          </p>
        </div>
      </div>

      {!configured && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            The agent is not configured yet. Set <code className="font-mono">ANTHROPIC_API_KEY</code>{" "}
            in your environment to enable agent runs.
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          rows={3}
          placeholder="Ask the agent to do something…  (⌘/Ctrl + Enter to run)"
          className="w-full resize-none rounded-md border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={allowWrites}
              onChange={(e) => setAllowWrites(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Allow writes (e.g. booking appointments)
          </label>
          <Button onClick={submit} disabled={!instruction.trim() || run.isPending}>
            <Send className="mr-1.5 h-4 w-4" />
            {run.isPending ? "Working…" : "Run"}
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setInstruction(s)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            {s}
          </button>
        ))}
      </div>

      {run.error && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {run.error.message}
        </div>
      )}

      {run.data && (
        <div className="mt-6 rounded-xl border border-border bg-background p-5">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {run.data.text}
          </div>

          {run.data.toolCalls.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <button
                onClick={() => setTraceOpen((o) => !o)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {traceOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                <Wrench className="h-3.5 w-3.5" />
                {run.data.toolCalls.length} tool call
                {run.data.toolCalls.length === 1 ? "" : "s"}
              </button>
              {traceOpen && (
                <ul className="mt-2 space-y-2">
                  {run.data.toolCalls.map((call, i) => (
                    <li
                      key={i}
                      className={cn(
                        "rounded-md border p-2 font-mono text-xs",
                        call.error
                          ? "border-destructive/30 bg-destructive/5 text-destructive"
                          : "border-border bg-surface text-muted-foreground"
                      )}
                    >
                      <div className="font-semibold text-foreground">{call.name}</div>
                      <div className="mt-1 break-all">
                        {JSON.stringify(call.input)}
                      </div>
                      {call.error && <div className="mt-1">⚠ {call.error}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
