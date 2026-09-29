"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/**
 * TooltipHint — ergonomic replacement for the native `title` attribute on
 * interactive controls. Unlike `title`, the hint is styled, announced to
 * keyboard users (opens on focus) and usable on touch (long-press).
 *
 *   <TooltipHint content={t("…")}>
 *     <Button variant="ghost" size="icon" aria-label={t("…")}>…</Button>
 *   </TooltipHint>
 *
 * The app-level Providers already mount a single TooltipProvider, so hints
 * can be used anywhere without extra wiring. An empty/missing content renders
 * the child untouched, which keeps i18n fallbacks cheap.
 */
function TooltipHint({
  content,
  side,
  children,
}: {
  content: React.ReactNode;
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["side"];
  children: React.ReactElement;
}) {
  if (content === undefined || content === null || content === "") {
    return children;
  }
  // Disabled controls swallow pointer events and cannot receive focus, so a
  // trigger on the control itself would never open the hint — the very case
  // where it matters ("why is this disabled?"). Wrap it in a span that keeps
  // hover working and is itself focusable for keyboard/screen-reader users.
  const childProps = children.props as {
    disabled?: boolean;
    "aria-disabled"?: boolean | "true" | "false";
  };
  const childDisabled =
    childProps.disabled === true || childProps["aria-disabled"] === true;
  return (
    <Tooltip>
      {childDisabled ? (
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            aria-label={typeof content === "string" ? content : undefined}
            className="inline-flex"
          >
            {children}
          </span>
        </TooltipTrigger>
      ) : (
        <TooltipTrigger asChild>{children}</TooltipTrigger>
      )}
      <TooltipContent side={side}>{content}</TooltipContent>
    </Tooltip>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipHint };
