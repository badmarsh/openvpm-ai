"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench, Copy, Check } from "lucide-react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { PersistedChatMessage } from "./agent-chat-history";

const MarkdownView = dynamic(
  () =>
    import("@/components/common/markdown-view").then(
      (mod) => mod.MarkdownView,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-1.5 py-1" aria-hidden="true">
        <div className="h-3 w-3/4 rounded bg-foreground/10" />
        <div className="h-3 w-full rounded bg-foreground/10" />
      </div>
    ),
  },
);

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
        {!isUser && !message.isError && (
          <div className="flex items-center gap-1.5 mb-1.5 pr-7">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
              {t("agent.aiGeneratedBadge", "Vygenerované AI Asistentom")}
            </span>
          </div>
        )}
        {isUser || message.isError ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <MarkdownView className="prose prose-sm max-w-none dark:prose-invert text-xs leading-relaxed text-foreground break-words prose-p:my-1.5 prose-p:text-xs prose-p:leading-relaxed first:prose-p:mt-0 last:prose-p:mb-0 prose-headings:my-2 prose-headings:text-sm prose-headings:font-semibold prose-headings:text-foreground prose-ul:my-1.5 prose-ul:list-disc prose-ul:pl-4 prose-ol:my-1.5 prose-ol:list-decimal prose-ol:pl-4 prose-li:my-0.5 prose-li:text-xs prose-strong:font-semibold prose-strong:text-foreground prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-background/60 prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[11px] prose-pre:my-2 prose-pre:rounded-md prose-pre:bg-background/80 prose-pre:p-2.5">
            {message.content}
          </MarkdownView>
        )}

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
