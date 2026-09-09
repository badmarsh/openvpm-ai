"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { PersistedChatMessage } from "./agent-chat-history";

function toolCallsCountLabel(
  count: number,
  t: (key: string, fallback: string, params?: Record<string, any>) => string,
) {
  if (count === 1) {
    return t("agent.trace.toolCallSingular", "1 tool call", { count });
  }
  if (count >= 2 && count <= 4) {
    return t("agent.trace.toolCallFew", `${count} tool calls`, { count });
  }
  return t("agent.trace.toolCallMany", `${count} tool calls`, { count });
}

export function AgentMessageBubble({
  message,
  onCopy,
  isCopied,
}: {
  message: PersistedChatMessage;
  onCopy: () => void;
  isCopied: boolean;
}) {
  const { t } = useI18n();
  const [traceOpen, setTraceOpen] = useState(false);
  const isUser = message.role === "user";

  return (
    <div className={cn("flex group", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed relative shadow-xs",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-xs"
            : message.isError
              ? "border border-destructive/30 bg-destructive/5 text-destructive rounded-tl-xs"
              : "bg-muted text-foreground border border-border/40 rounded-tl-xs",
        )}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>

        {!isUser && (
          <button
            type="button"
            onClick={onCopy}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-background/40 text-muted-foreground hover:text-foreground"
            title={t("agent.copyReply", "Kopírovať odpoveď")}
          >
            {isCopied ? (
              <Check className="h-3 w-3 text-emerald-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        )}

        {message.toolCalls && message.toolCalls.length > 0 ? (
          <div className="mt-2.5 border-t border-border/60 pt-2">
            <button
              type="button"
              onClick={() => setTraceOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              {traceOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <Wrench className="h-3.5 w-3.5" />
              {toolCallsCountLabel(message.toolCalls.length, t)}
            </button>
            {traceOpen ? (
              <ul className="mt-2 space-y-2">
                {message.toolCalls.map((call, i) => (
                  <li
                    key={i}
                    className={cn(
                      "rounded-md border p-2 font-mono text-[11px]",
                      call.error
                        ? "border-destructive/30 bg-destructive/5 text-destructive"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    <div className="font-semibold text-foreground">
                      {call.name}
                    </div>
                    <div className="mt-1 break-all">
                      {JSON.stringify(call.input)}
                    </div>
                    {call.error ? (
                      <div className="mt-1 text-destructive">⚠ {call.error}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-3.5 py-2.5 rounded-tl-xs">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
