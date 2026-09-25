"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { AlertTriangle, Clock, CreditCard } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { trialCalendarDaysLeft } from "@/lib/billing/trial-days";
import { useI18n } from "@/lib/i18n";

/**
 * Trial countdown / read-only indicator in the TopBar. Admin-only and hidden on
 * self-host (billing not enforced) or once a paid subscription is active.
 * During the trial the badge opens the single native billing surface where the
 * clinic can compare monthly and annual billing before entering Stripe.
 */
export function TrialBadge() {
  const { t } = useI18n();
  const { data: session, status } = useSession();
  const isAdmin = status === "authenticated" && session?.user?.role === "admin";

  const { data, isLoading, error } = trpc.subscription.get.useQuery(undefined, {
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (!isAdmin) return null;

  // Don't show a spinner during initial load – in self-host mode (no
  // HOSTED_BILLING_ENABLED) the query resolves quickly to billingEnforced=false
  // and the badge disappears entirely. A loading flash is more confusing than
  // simply waiting for the resolved state.
  if (isLoading) return null;

  if (error || !data) {
    return (
      <Link
        href="/settings?tab=billing"
        className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {t("layout.trialBadge.statusUnavailable", "Billing status unavailable")}
      </Link>
    );
  }

  if (!data.billingEnforced || data.billingStatus === "active") {
    return null;
  }

  if (data.billingStatus === "past_due") {
    return (
      <Link
        href="/settings?tab=billing"
        className="inline-flex items-center gap-1.5 rounded-full border border-warning-muted/50 bg-warning-muted/30 px-3 py-1 text-xs font-medium text-warning-muted-foreground transition-colors hover:bg-warning-muted/50"
      >
        <CreditCard className="h-3.5 w-3.5" />
        {t(
          "layout.trialBadge.paymentRetrying",
          "Payment retrying · Review billing",
        )}
      </Link>
    );
  }

  if (data.billingStatus === "unpaid") {
    return (
      <Link
        href="/settings?tab=billing"
        className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
      >
        <CreditCard className="h-3.5 w-3.5" />
        {t("layout.trialBadge.paymentUnpaid", "Payment unpaid · Read only")}
      </Link>
    );
  }

  // A Stripe subscription can legitimately remain `trialing` after Checkout
  // while the saved card waits for the free trial to end. Never offer another
  // Checkout in that state; it could create a duplicate subscription.
  if (data.hasSubscription) {
    return (
      <Link
        href="/settings?tab=billing"
        className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 transition-colors hover:bg-teal-100"
      >
        <CreditCard className="h-3.5 w-3.5" />
        {t(
          "layout.trialBadge.billingConnected",
          "Billing connected · Manage billing",
        )}
      </Link>
    );
  }

  const trialing = data.billingStatus === "trialing" && data.trialEndsAt;
  if (trialing) {
    const days = trialCalendarDaysLeft(data.trialEndsAt, data.timezone) ?? 0;
    const urgent = days <= 3;
    return (
      <Link
        href="/settings?tab=billing"
        aria-label={t("layout.trialBadge.activateAccount", "Activate account")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
          urgent
            ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
            : "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100",
        )}
      >
        <Clock className="h-3.5 w-3.5" />
        {days === 0
          ? t("layout.trialBadge.trialEndsToday", "Trial ends today")
          : days === 1
            ? t(
                "layout.trialBadge.daysLeftInTrialSingular",
                "1 day left in trial",
                { days: 1 },
              )
            : days >= 2 && days <= 4
              ? t(
                  "layout.trialBadge.daysLeftInTrialFew",
                  `${days} days left in trial`,
                  { days },
                )
              : t(
                  "layout.trialBadge.daysLeftInTrial",
                  `${days} days left in trial`,
                  { days },
                )}
        <span className="font-semibold">
          {" · "}
          {t("layout.trialBadge.activateAccount", "Activate account")}
        </span>
      </Link>
    );
  }

  // Billing enforced, not trialing, no full access → lapsed / read-only.
  if (!data.hasFullAccess) {
    return (
      <Link
        href="/settings?tab=billing"
        className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
      >
        <Clock className="h-3.5 w-3.5" />
        {t(
          "layout.trialBadge.trialEnded",
          "Trial ended, read only · Turn it back on",
        )}
      </Link>
    );
  }

  return null;
}
