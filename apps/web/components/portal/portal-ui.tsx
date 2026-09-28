/**
 * Shared primitives for the client portal (Pet Portal).
 *
 * The portal is a **light-only, client-facing** surface: it paints its own white
 * background and injects the practice brand colour as `--primary`. It therefore
 * must not use the dashboard's theme-dependent tokens (`bg-card`,
 * `text-muted-foreground`), which would flip with the clinic's dark mode.
 *
 * What it *can* share is one vocabulary for status colour. Before this file the
 * same state rendered as two different pills on two pages (an invoice `sent` and
 * an appointment `scheduled` were both blue, but `in_exam` and `estimate` were
 * both purple by accident), and the colour pairs were copy-pasted into every
 * page. These constants are the single definition point: the portal sweep's
 * mechanical contract (`pnpm ui:check`) fails if a raw palette utility appears
 * anywhere else under `app/portal/**` or `components/portal/**`.
 *
 * Presentation only — this file holds no logic, and the mapping keeps the exact
 * colours the portal already used, so nothing changes visually except that the
 * same state now looks the same everywhere.
 */

import type { ReactNode } from "react";

export const PORTAL_TONE_CLASS = {
  /** upcoming, sent, scheduled */
  info: "bg-blue-100 text-blue-700",
  /** checked in, waiting, due soon, pending */
  waiting: "bg-amber-100 text-amber-700",
  /** in exam, estimate, in progress */
  progress: "bg-purple-100 text-purple-700",
  /** checked out, paid, up to date, active */
  done: "bg-green-100 text-green-700",
  /** no-show, overdue, error */
  problem: "bg-red-100 text-red-700",
  /** finished, historical, inactive */
  neutral: "bg-gray-100 text-gray-600",
} as const;

export type PortalTone = keyof typeof PORTAL_TONE_CLASS;

/** Softer background for cards and notices (border + fill + text). */
export const PORTAL_NOTICE_CLASS = {
  info: "border-blue-200 bg-blue-50 text-blue-800",
  done: "border-green-200 bg-green-50 text-green-800",
  problem: "border-red-200 bg-red-50 text-red-700",
} as const;

export type PortalNoticeTone = keyof typeof PORTAL_NOTICE_CLASS;

/**
 * Semantic text colour for a state that is good or bad in isolation: money owed
 * vs in credit, a weight trend, an error message. The call site carries the
 * meaning, the token carries the colour.
 */
export const PORTAL_TEXT_CLASS = {
  positive: "text-green-600",
  negative: "text-red-600",
} as const;

/** Icon tiles in the portal's quick-link grid. */
export const PORTAL_TILE_CLASS = {
  info: "bg-blue-50 text-blue-600",
  done: "bg-green-50 text-green-600",
} as const;

export const PORTAL_PILL_CLASS =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

export function PortalPill({
  tone,
  className = "",
  children,
}: {
  tone: PortalTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`${PORTAL_PILL_CLASS} ${PORTAL_TONE_CLASS[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function PortalNotice({
  tone,
  className = "",
  children,
}: {
  tone: PortalNoticeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-lg border ${PORTAL_NOTICE_CLASS[tone]} ${className}`}>
      {children}
    </div>
  );
}
