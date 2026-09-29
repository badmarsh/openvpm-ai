import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("action confirmation dialog", () => {
  const source = readFileSync(
    "components/common/action-confirmation-dialog.tsx",
    "utf8",
  );

  it("is built on the shared Radix dialog primitive (focus trap, Escape, scroll lock)", () => {
    expect(source).toContain('from "@/components/ui/dialog"');
    expect(source).toContain("<DialogTitle");
    expect(source).toContain("<DialogDescription");
    // The primitive owns the portal and focus management now; the hand-rolled
    // duplicates were removed with the unification onto ui/dialog.
    expect(source).not.toContain("createPortal(");
    expect(source).not.toContain("document.body.style.overflow");
    expect(source).not.toContain('event.key !== "Tab"');
  });

  it("blocks dismissal while an action is pending", () => {
    expect(source).toContain("onEscapeKeyDown");
    expect(source).toContain("onPointerDownOutside");
    expect(source).toContain("if (isPending) event.preventDefault()");
    expect(source).toContain("if (!nextOpen && !isPending) onCancel()");
    expect(source).toContain("disabled={isPending || !reasonIsValid}");
  });

  it("keeps the reason input contract and initial focus target", () => {
    expect(source).toContain("reason.minLength");
    expect(source).toContain("reason.maxLength");
    expect(source).toContain("aria-invalid={reason.value.length > 0 && !reasonIsValid}");
    expect(source).toContain("onOpenAutoFocus");
    expect(source).toContain('htmlFor={reasonId}');
  });
});
