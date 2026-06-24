"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { cn, isValidEmail } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <RegisterPageInner />
    </Suspense>
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
        toast.success("Account created. Please sign in.");
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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left pane: the form, on clean white */}
      <div className="flex items-center justify-center bg-white px-6 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <PawPrint className="h-4 w-4" />
            </span>
            OpenVPM {cloudIntent ? "Cloud" : ""}
          </Link>

          <h1 className="mt-8 font-heading text-3xl font-bold tracking-tight text-slate-950">
            Create your workspace
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Start using OpenVPM in about a minute. You own your data, and smart
            AI tools are built in.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
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

            <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Free for 14 days. No card needed.
            </p>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right pane: gradient with a clean platform preview */}
      <div className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#fff7ed_0%,#fdf2f8_45%,#ecfdf5_100%)] lg:flex lg:flex-col">
        <div className="px-12 pt-16">
          <h2 className="max-w-md font-heading text-3xl font-bold tracking-tight text-slate-950">
            The practice system you own.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
            Run your day, keep clean records, and send bills. Smart AI tools are
            built in, and your data stays yours to export any time.
          </p>
        </div>

        <div className="flex flex-1 items-end justify-center px-10 pt-10">
          <PlatformPreview />
        </div>
      </div>
    </div>
  );
}

const NAV = [
  "Dashboard",
  "Patients",
  "Schedule",
  "Records",
  "Billing",
  "Inventory",
];

const KPIS = [
  ["Today's visits", "8"],
  ["New patients", "3"],
  ["Revenue", "$1.2k"],
];

const TODAY = [
  ["9:00", "Wellness exam", "Biscuit"],
  ["11:30", "Vaccines", "Luna"],
  ["2:00", "Recheck", "Mango"],
];

/** A clean, value-first snapshot of the real app: sidebar plus the dashboard. */
function PlatformPreview() {
  return (
    <div className="w-full max-w-xl overflow-hidden rounded-t-2xl border border-white/80 bg-white shadow-2xl shadow-rose-200/40">
      <div className="flex h-[440px]">
        {/* Sidebar */}
        <aside className="w-40 shrink-0 border-r border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center gap-2 px-1 pb-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <PawPrint className="h-3.5 w-3.5" />
            </span>
            <span className="font-heading text-sm font-semibold text-slate-900">
              OpenVPM
            </span>
          </div>
          <nav className="space-y-1">
            {NAV.map((label, i) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium",
                  i === 0 ? "bg-primary/10 text-primary" : "text-slate-500"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-sm",
                    i === 0 ? "bg-primary" : "bg-slate-300"
                  )}
                />
                {label}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-heading text-sm font-semibold text-slate-900">
              Dashboard
            </p>
            <span className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
              New
            </span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-3">
              {KPIS.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-100 bg-white p-3"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-slate-100 bg-white p-3">
              <p className="text-xs font-semibold text-slate-900">Today</p>
              <div className="mt-2 space-y-1.5">
                {TODAY.map(([t, title, pet]) => (
                  <div
                    key={t}
                    className="flex items-center gap-3 rounded-md bg-slate-50/80 px-2.5 py-1.5"
                  >
                    <span className="text-[11px] font-medium text-slate-500">
                      {t}
                    </span>
                    <span className="text-xs font-medium text-slate-900">
                      {title}
                    </span>
                    <span className="ml-auto text-[11px] text-slate-500">
                      {pet}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
