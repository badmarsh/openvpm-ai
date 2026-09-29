"use client";

import { useId, useRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";

type ReasonInput = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
};

/**
 * ActionConfirmationDialog — the single confirmation dialog implementation.
 *
 * Both <ConfirmDialog> (options-driven, pairs with useConfirmDialog) and direct
 * callers render through this component, which is built on the shared Radix
 * <Dialog>: focus is trapped inside, focus is restored to the trigger on close,
 * Escape and the backdrop dismiss (suppressed while an action is pending),
 * and body scroll is locked. Hand-rolled portals, keydown traps and overflow
 * juggling were removed in favour of the primitive so every confirmation in the
 * app behaves identically — the replacement for native window.confirm().
 */
export function ActionConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmVariant = "default",
  isPending = false,
  reason,
  children,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: "default" | "destructive";
  isPending?: boolean;
  reason?: ReasonInput;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const reasonId = useId();
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const hasReason = reason !== undefined;

  const trimmedReason = reason?.value.trim() ?? "";
  const reasonIsValid = reason
    ? trimmedReason.length >= (reason.minLength ?? 1) &&
      trimmedReason.length <= (reason.maxLength ?? Number.POSITIVE_INFINITY)
    : true;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isPending) onCancel();
      }}
    >
      <DialogContent
        className="w-full max-w-lg gap-4 bg-card p-5"
        onEscapeKeyDown={(event) => {
          if (isPending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isPending) event.preventDefault();
        }}
        onOpenAutoFocus={(event) => {
          // Keep the historical focus target instead of Radix's first-focusable
          // default: the reason textarea, otherwise the confirm button.
          event.preventDefault();
          (hasReason ? reasonRef.current : confirmRef.current)?.focus();
        }}
      >
        <DialogTitle className="font-heading text-lg font-semibold">
          {title}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {description}
        </DialogDescription>

        {reason ? (
          <div>
            <label htmlFor={reasonId} className="text-sm font-medium">
              {reason.label}
            </label>
            <Textarea
              ref={reasonRef}
              id={reasonId}
              className="mt-2"
              value={reason.value}
              placeholder={reason.placeholder}
              minLength={reason.minLength}
              maxLength={reason.maxLength}
              aria-invalid={reason.value.length > 0 && !reasonIsValid}
              onChange={(event) => reason.onChange(event.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {reason.minLength
                ? `${reason.minLength} characters minimum. `
                : null}
              {reason.maxLength
                ? `${reason.value.length}/${reason.maxLength}`
                : null}
            </p>
          </div>
        ) : null}

        {children ? <div>{children}</div> : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={isPending} onClick={onCancel}>
            {cancelLabel ?? t("common.cancel", "Cancel")}
          </Button>
          <Button
            ref={confirmRef}
            variant={confirmVariant}
            disabled={isPending || !reasonIsValid}
            onClick={onConfirm}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
