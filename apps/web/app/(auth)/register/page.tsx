"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  PawPrint,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { cn, isValidEmail, initials } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const BRAND = "#0d9488";

const INCLUDED = [
  { icon: CalendarDays, label: "Smart scheduling" },
  { icon: Stethoscope, label: "Records & SOAP notes" },
  { icon: CreditCard, label: "Billing & invoicing" },
  { icon: Sparkles, label: "Built-in AI agent" },
  { icon: FileText, label: "Public API & webhooks" },
];

/** A friendly owner name derived from the email, for the live preview only. */
function previewOwner(email: string): string {
  const local = email.split("@")[0]?.trim();
  if (!local) return "Dr. Jane Smith";
  const words = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1));
  return words.join(" ") || "Dr. Jane Smith";
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <RegisterPageInner />
    </Suspense>
  );
}

function WorkspaceMark({ practiceName }: { practiceName: string }) {
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md text-sm font-semibold text-white"
      style={{ backgroundColor: BRAND }}
    >
      {practiceName.trim() ? (
        initials(practiceName)
      ) : (
        <PawPrint className="h-5 w-5" />
      )}
    </div>
  );
}

function PlatformPreview({
  practiceName,
  email,
}: {
  practiceName: string;
  email: string;
}) {
  const displayPractice = practiceName.trim() || "Neighborhood Veterinary";
  const displayOwner = previewOwner(email);
  const accentSoft = `${BRAND}14`;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-emerald-100 bg-white shadow-xl shadow-rose-200/20">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <WorkspaceMark practiceName={displayPractice} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">
              {displayPractice}
            </p>
            <p className="truncate text-xs text-slate-500">Main Location</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 sm:flex">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Trial ready
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[58px_minmax(0,1fr)]">
        <div className="border-r border-slate-100 bg-slate-50/70 p-2">
          {[CalendarDays, Stethoscope, Users, ShieldCheck].map((Icon, index) => (
            <div
              key={index}
              className={cn(
                "mb-2 flex h-10 w-10 items-center justify-center rounded-md text-slate-400",
                index === 0 && "bg-white text-emerald-700 shadow-sm"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          ))}
        </div>

        <div className="min-w-0 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Today's visits", "18"],
              ["Messages", "7"],
              ["Open invoices", "$2.4k"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-md border border-slate-100 bg-slate-50 p-3"
              >
                <p className="text-[11px] font-medium uppercase text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-950">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="rounded-md border border-slate-100 bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Today</p>
                  <p className="text-xs text-slate-500">
                    Schedule seeded for setup
                  </p>
                </div>
                <div
                  className="rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ backgroundColor: accentSoft, color: BRAND }}
                >
                  Live
                </div>
              </div>
              {[
                ["9:00", "Wellness exam", "Biscuit Avery"],
                ["10:30", "Dental estimate", "Luna Rivera"],
                ["1:15", "Recheck", "Mango Brooks"],
              ].map(([time, title, patient], index) => (
                <div
                  key={time}
                  className="mb-2 grid grid-cols-[48px_minmax(0,1fr)] rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2 last:mb-0"
                >
                  <p className="text-xs font-medium text-slate-500">{time}</p>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-950">
                      {title}
                    </p>
                    <p className="truncate text-xs text-slate-500">{patient}</p>
                  </div>
                  {index === 0 && (
                    <div
                      className="col-start-2 mt-2 h-1.5 w-28 rounded-full motion-safe:animate-pulse"
                      style={{ backgroundColor: BRAND }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-950">
                Included in your trial
              </p>
              <div className="mt-3 space-y-2">
                {INCLUDED.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 rounded-md border border-slate-100 bg-white px-2.5 py-2 text-xs"
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ backgroundColor: accentSoft, color: BRAND }}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="font-medium text-slate-700">{label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-md bg-white p-3">
                <p className="text-xs text-slate-500">First admin</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-950">
                  {displayOwner}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloudIntent = searchParams.get("intent") === "cloud";
  const [practiceName, setPracticeName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const registerMutation = trpc.auth.register.useMutation({
    // Email verification is a SOFT requirement: drop the user straight into the
    // product (where the value tour runs) and nudge them to confirm via a banner.
    onSuccess: async () => {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (result?.ok) {
        router.push("/?tour=start");
        router.refresh();
      } else {
        toast.success("Account created — please sign in.");
        router.push("/login");
      }
    },
    onError: (err) => {
      toast.error(err.message);
      setError(err.message);
      setLoading(false);
    },
  });

  function validate(): string | null {
    if (practiceName.trim().length < 2)
      return "Add your practice name to continue.";
    if (!isValidEmail(email)) return "Add a valid work email.";
    if (password.length < 8)
      return "Use at least 8 characters for the password.";
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setLoading(true);
    registerMutation.mutate({
      email: email.trim().toLowerCase(),
      password,
      practiceName: practiceName.trim(),
    });
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#fdf2f8_45%,#ecfdf5_100%)] p-3 text-slate-950 sm:p-4 lg:h-screen lg:overflow-hidden lg:p-6">
      <main
        id="main-content"
        className="mx-auto grid w-full max-w-7xl gap-4 lg:h-full lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.78fr)]"
      >
        <OnboardingPreviewPanel practiceName={practiceName} email={email} />

        <section className="order-1 flex min-h-0 items-center justify-center lg:order-2">
          <div className="flex w-full flex-col rounded-lg border border-white/80 bg-white p-5 shadow-xl shadow-rose-200/30 sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700"
              >
                <PawPrint className="h-4 w-4" />
                OpenVPM {cloudIntent ? "Cloud" : ""}
              </Link>
              {cloudIntent ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  No card for 14 days
                </span>
              ) : null}
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold text-emerald-700">
                Start your free trial
              </p>
              <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-slate-950">
                Create your workspace
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Spin up a full OpenVPM Cloud practice in under a minute. You land
                straight in the product — explore everything, then add billing
                whenever you are ready.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
              {error ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <FormField label="Practice name" htmlFor="practiceName">
                <Input
                  id="practiceName"
                  value={practiceName}
                  onChange={(e) => setPracticeName(e.target.value)}
                  placeholder="Neighborhood Veterinary"
                  autoFocus
                  required
                />
              </FormField>

              <FormField label="Work email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@clinic.com"
                  required
                />
              </FormField>

              <FormField
                label="Password"
                htmlFor="password"
                description="At least 8 characters."
              >
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  minLength={8}
                  required
                />
              </FormField>

              <Button type="submit" disabled={loading} className="mt-1 w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating your workspace
                  </>
                ) : (
                  <>
                    Create workspace
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-900">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                14-day full-access trial. No credit card needed
                {cloudIntent ? " — then $49/location + $10/user." : "."}
              </div>
            </form>

            <p className="mt-5 text-center text-xs text-slate-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-emerald-700 hover:underline"
              >
                Sign in
              </Link>
              {cloudIntent ? " · Self-host stays free and fully unlocked." : null}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function OnboardingPreviewPanel({
  practiceName,
  email,
}: {
  practiceName: string;
  email: string;
}) {
  return (
    <section className="order-2 flex min-h-0 flex-col rounded-lg border border-white/80 bg-white/70 p-5 shadow-xl shadow-rose-200/30 backdrop-blur sm:p-6 lg:order-1">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white bg-white/80 px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Hosted trial workspace
          </div>
          <h2 className="mt-4 max-w-xl font-heading text-3xl font-bold tracking-tight text-slate-950 lg:text-4xl">
            Your clinic, running on OpenVPM in a minute.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            We create your practice with a working schedule and sample patients
            so you can explore the real product right away — then guide you
            through what matters.
          </p>
        </div>
        <div className="hidden rounded-md border border-white bg-white/80 p-3 text-sm shadow-sm sm:block">
          <div className="flex items-center gap-2 font-semibold text-slate-950">
            <BadgeDollarSign className="h-4 w-4 text-emerald-700" />
            Trial first
          </div>
          <p className="mt-1 text-xs text-slate-500">$49/location + $10/user</p>
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1">
        <PlatformPreview practiceName={practiceName} email={email} />
      </div>
    </section>
  );
}
