"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, Check, Sparkles, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTour } from "@/components/tour/tour-provider";

/**
 * Dismissible dashboard card that nudges the admin through the few remaining
 * setup steps (branding, team, billing). Driven by real practice state and the
 * tour's finish handoff. Admin-only; hidden once dismissed or all steps done.
 */
export function FinishSetupCard() {
  const { start } = useTour();
  const [hidden, setHidden] = useState(false);
  const { data: session, status } = useSession();
  const isAdmin =
    status === "authenticated" && session?.user?.role === "admin";

  const opts = {
    enabled: isAdmin,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  } as const;
  const state = trpc.settings.getOnboardingState.useQuery(undefined, opts);
  const onboarding = trpc.settings.onboardingStatus.useQuery(undefined, opts);
  const practice = trpc.settings.getPractice.useQuery(undefined, opts);
  const sub = trpc.subscription.get.useQuery(undefined, opts);
  const dismiss = trpc.settings.dismissSetup.useMutation();

  if (!state.data || hidden || state.data.setupDismissed) return null;
  // The first-run journey owns setup until it finishes. Only show this gentle
  // reminder afterward (for anything that was skipped).
  if (!onboarding.data?.completedAt) return null;

  const enforced = sub.data?.billingEnforced ?? false;
  const tasks = [
    {
      key: "logo",
      label: "Add your logo & brand color",
      done: !!practice.data?.logoUrl,
      href: "/settings?tab=practice",
    },
    {
      key: "team",
      label: "Invite your team",
      done: (sub.data?.billableSeatCount ?? 1) > 1,
      href: "/settings?tab=staff",
    },
    ...(enforced
      ? [
          {
            key: "billing",
            label: "Add billing to keep your data after the trial",
            done: !!sub.data?.hasBillingAccount,
            href: "/settings?tab=billing",
          },
        ]
      : []),
  ];

  const doneCount = tasks.filter((t) => t.done).length;
  if (doneCount === tasks.length) return null;

  function onDismiss() {
    setHidden(true);
    dismiss.mutate();
  }

  return (
    <div className="relative rounded-lg border border-primary/30 bg-primary/5 p-5">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss setup card"
        className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-base font-semibold">
            Finish setting up {practice.data?.name ?? "your practice"}
          </p>
          <p className="text-sm text-muted-foreground">
            {doneCount} of {tasks.length} done — a few quick steps to make it
            yours.
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {tasks.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className={cn(
                  "flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent",
                  t.done ? "border-border text-muted-foreground" : "border-primary/30"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    t.done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 text-transparent"
                  )}
                >
                  <Check className="h-3 w-3" />
                </span>
                <span className={cn("font-medium", t.done && "line-through")}>
                  {t.label}
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => start()}>
              Replay the product tour
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
