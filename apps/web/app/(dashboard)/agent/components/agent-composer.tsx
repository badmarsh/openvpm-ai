"use client";

import type { RefObject } from "react";
import { ArrowUp, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { AGENT_INSTRUCTION_MAX_LENGTH } from "@/lib/agent/policy";

export function AgentComposer({
  instruction,
  onInstructionChange,
  onSubmit,
  disabled,
  isPending,
  canRun,
  needsBillingSetup,
  instructionInvalid,
  allowWrites,
  textareaRef,
}: {
  instruction: string;
  onInstructionChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  isPending: boolean;
  canRun: boolean;
  needsBillingSetup: boolean;
  instructionInvalid: boolean;
  allowWrites: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const { t } = useI18n();

  return (
    <div className="p-3 border-t border-border bg-card">
      <div
        data-tour="agent-input"
        className="rounded-xl border border-border bg-muted/20 p-2 shadow-xs focus-within:border-primary/40 focus-within:bg-background transition-colors"
      >
        <textarea
          ref={textareaRef}
          value={instruction}
          onChange={(e) => {
            onInstructionChange(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          rows={1}
          maxLength={AGENT_INSTRUCTION_MAX_LENGTH}
          aria-invalid={instructionInvalid || undefined}
          disabled={!canRun || isPending}
          placeholder={
            canRun
              ? t(
                  "agent.composer.placeholder",
                  "Ask the agent anything…  (Enter to send, Shift+Enter for a new line)",
                )
              : needsBillingSetup
                ? t(
                    "agent.composer.placeholderNoCard",
                    "Add a card to try AI.",
                  )
                : t(
                    "agent.composer.placeholderUnavailable",
                    "The agent is not available right now.",
                  )
          }
          className="max-h-36 w-full resize-none bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground"
        />

        <div className="flex items-center justify-between gap-3 px-1 pt-1">
          <span className="text-[10px] text-muted-foreground font-mono">
            {instruction.length > 0 && `${instruction.length}/${AGENT_INSTRUCTION_MAX_LENGTH}`}
          </span>

          <Button
            type="button"
            size="sm"
            onClick={onSubmit}
            disabled={disabled}
            aria-label={t("agent.composer.send", "Send")}
            className="h-8 px-3 rounded-lg gap-1.5 text-xs font-semibold"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{t("agent.composer.sending", "Odosielam...")}</span>
              </>
            ) : (
              <>
                <span>{t("agent.composer.send", "Odoslať")}</span>
                <ArrowUp className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>

      {allowWrites ? (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-[11px] text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            {t(
              "agent.composer.writeWarning",
              "Write mode can create appointments or record patient vitals. It turns off automatically after this run.",
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
