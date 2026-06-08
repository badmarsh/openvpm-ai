"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Check, Building2, Users, Database, Rocket } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: Building2,
    title: "Confirm your practice details",
    body: "Set your practice name, country, currency, tax rate, and timezone.",
    href: "/settings?tab=practice",
    cta: "Open practice settings",
  },
  {
    icon: Users,
    title: "Invite your team",
    body: "Add veterinarians, technicians, and front-desk staff so everyone can log in.",
    href: "/settings?tab=staff",
    cta: "Manage staff",
  },
  {
    icon: Database,
    title: "Bring in your data",
    body: "Import clients and patients from your current system, or start fresh.",
    href: "/settings?tab=data",
    cta: "Import data",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const status = trpc.settings.onboardingStatus.useQuery(undefined, { retry: false });

  const clearDemo = trpc.settings.clearDemoData.useMutation({
    onSuccess: () => {
      utils.settings.onboardingStatus.invalidate();
      toast.success("Demo data cleared");
    },
    onError: (e) => toast.error(e.message),
  });
  const complete = trpc.settings.completeOnboarding.useMutation({
    onSuccess: () => {
      toast.success("You're all set!");
      router.push("/");
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  if (status.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center">
        <Rocket className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-3 font-heading text-2xl font-bold">Welcome to OpenVPM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A few quick steps to get your practice running. Your dashboard is
          pre-filled with demo data so you can explore right away.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.title}
              className="flex items-start gap-4 rounded-lg border border-border bg-card p-5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
              <Link href={s.href}>
                <Button variant="outline" size="sm">
                  {s.cta}
                </Button>
              </Link>
            </div>
          );
        })}
      </div>

      {status.data?.hasDemoData && (
        <div className="mt-6 flex items-center justify-between rounded-lg border border-border bg-muted/30 p-5">
          <div>
            <h3 className="font-medium">Clear the demo data</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Remove the sample clients, patients, and appointments when you&apos;re
              ready to go live with real data.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={clearDemo.isPending}
            onClick={() => clearDemo.mutate()}
          >
            {clearDemo.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Clear demo data
          </Button>
        </div>
      )}

      <div className="mt-8 flex justify-end gap-3">
        <Link href="/">
          <Button variant="ghost">Skip for now</Button>
        </Link>
        <Button disabled={complete.isPending} onClick={() => complete.mutate()}>
          {complete.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Finish setup
        </Button>
      </div>
    </div>
  );
}
