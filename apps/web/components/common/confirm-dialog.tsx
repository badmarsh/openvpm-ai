"use client";

import { ActionConfirmationDialog } from "@/components/common/action-confirmation-dialog";
import type { ConfirmDialogOptions } from "@/lib/hooks/use-confirm-dialog";

export interface ConfirmDialogProps {
  open: boolean;
  options: ConfirmDialogOptions;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  options,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <ActionConfirmationDialog
      open={open}
      title={options.title}
      description={options.description}
      confirmLabel={options.confirmLabel ?? "Potvrdiť"}
      cancelLabel={options.cancelLabel}
      confirmVariant={options.confirmVariant ?? "default"}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
