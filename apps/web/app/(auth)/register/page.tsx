"use client";

import { Suspense, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ImageIcon,
  Loader2,
  LockKeyhole,
  MailCheck,
  PawPrint,
  Plus,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const CLOUD_STEPS = [
  {
    key: "practice",
    label: "Practice",
    title: "Start with the clinic",
    body: "Name the workspace and first location exactly how your team should see it.",
    icon: Building2,
  },
  {
    key: "owner",
    label: "Owner",
    title: "Add yourself",
    body: "This becomes the first admin account for the practice.",
    icon: UserRound,
  },
  {
    key: "brand",
    label: "Brand",
    title: "Make it feel like yours",
    body: "Add a logo preview and choose a quiet accent color for setup.",
    icon: ImageIcon,
  },
  {
    key: "team",
    label: "Team",
    title: "Stage the first invites",
    body: "Capture who should be invited after you verify the owner login.",
    icon: Users,
  },
  {
    key: "account",
    label: "Account",
    title: "Create the workspace",
    body: "Payment comes later. Start the full 14-day Cloud trial now.",
    icon: LockKeyhole,
  },
] as const;

const ROLE_LABELS = {
  veterinarian: "Veterinarian",
  technician: "Technician",
  front_desk: "Front desk",
  viewer: "Viewer",
} as const;

const BRAND_COLORS = ["#0d9488", "#16a34a", "#f97316", "#db2777"] as const;

type CloudStepKey = (typeof CLOUD_STEPS)[number]["key"];
type TeamRole = keyof typeof ROLE_LABELS;
type TeamMemberDraft = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
};

function isValidEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value);
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "OV";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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

function WorkspaceMark({
  practiceName,
  logoPreview,
  brandColor,
}: {
  practiceName: string;
  logoPreview: string | null;
  brandColor: string;
}) {
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md text-sm font-semibold text-white"
      style={{ backgroundColor: brandColor }}
    >
      {logoPreview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoPreview} alt="" className="h-full w-full object-cover" />
      ) : practiceName.trim() ? (
        initials(practiceName)
      ) : (
        <PawPrint className="h-5 w-5" />
      )}
    </div>
  );
}

function PlatformPreview({
  practiceName,
  locationName,
  ownerName,
  logoPreview,
  brandColor,
  teamMembers,
  activeStep,
}: {
  practiceName: string;
  locationName: string;
  ownerName: string;
  logoPreview: string | null;
  brandColor: string;
  teamMembers: TeamMemberDraft[];
  activeStep: CloudStepKey;
}) {
  const visibleTeam = teamMembers.filter((member) => member.name.trim() || member.email.trim());
  const displayPractice = practiceName.trim() || "Neighborhood Veterinary";
  const displayLocation = locationName.trim() || "Main Location";
  const displayOwner = ownerName.trim() || "Dr. Jane Smith";
  const accentSoft = `${brandColor}14`;
  const accentBorder = `${brandColor}33`;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-emerald-100 bg-white shadow-xl shadow-rose-200/20">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <WorkspaceMark
            practiceName={displayPractice}
            logoPreview={logoPreview}
            brandColor={brandColor}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">
              {displayPractice}
            </p>
            <p className="truncate text-xs text-slate-500">{displayLocation}</p>
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
              <div key={label} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-medium uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="rounded-md border border-slate-100 bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Today</p>
                  <p className="text-xs text-slate-500">Schedule seeded for setup</p>
                </div>
                <div
                  className="rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ backgroundColor: accentSoft, color: brandColor }}
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
                    <p className="truncate text-sm font-medium text-slate-950">{title}</p>
                    <p className="truncate text-xs text-slate-500">{patient}</p>
                  </div>
                  {index === 0 && (
                    <div
                      className="col-start-2 mt-2 h-1.5 w-28 rounded-full motion-safe:animate-pulse"
                      style={{ backgroundColor: brandColor }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-950">Launch checklist</p>
              <div className="mt-3 space-y-2">
                {[
                  ["practice", "Workspace", practiceName.trim()],
                  ["owner", "Owner", ownerName.trim()],
                  ["brand", "Brand", logoPreview || brandColor !== "#0d9488"],
                  ["team", "Team", visibleTeam.length],
                  ["account", "Login", false],
                ].map(([key, label, done]) => (
                  <div
                    key={String(key)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border bg-white px-2.5 py-2 text-xs",
                      key === activeStep ? "border-emerald-200" : "border-slate-100"
                    )}
                    style={key === activeStep ? { backgroundColor: accentSoft } : undefined}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full border"
                      style={{
                        borderColor: done ? brandColor : accentBorder,
                        color: done ? brandColor : "#94a3b8",
                      }}
                    >
                      {done ? <Check className="h-3 w-3" /> : null}
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
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [locationName, setLocationName] = useState("Main Location");
  const [brandColor, setBrandColor] = useState<(typeof BRAND_COLORS)[number]>("#0d9488");
  const [logoName, setLogoName] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberDraft[]>([
    { id: "team-1", name: "", email: "", role: "technician" },
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [verificationEmailSent, setVerificationEmailSent] = useState<
    boolean | null
  >(null);

  const currentStep = CLOUD_STEPS[stepIndex]!;
  const completeTeamMembers = useMemo(
    () =>
      teamMembers
        .map((member) => ({
          name: member.name.trim(),
          email: member.email.trim().toLowerCase(),
          role: member.role,
        }))
        .filter((member) => member.name && isValidEmail(member.email)),
    [teamMembers]
  );

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (data) => {
      if (data?.verificationRequired) {
        setVerificationUrl(data.verificationUrl ?? null);
        setVerificationEmailSent(data.verificationEmailSent ?? null);
        setVerifySent(true);
        setLoading(false);
        return;
      }

      toast.success("Account created. Redirecting...");
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.ok) {
        router.push("/");
        router.refresh();
      }
    },
    onError: (err) => {
      toast.error(err.message);
      setError(err.message);
      setLoading(false);
    },
  });

  function stepError(): string | null {
    if (currentStep.key === "practice") {
      if (practiceName.trim().length < 2) return "Add the practice name to continue.";
      if (locationName.trim().length < 2) return "Add the first location name.";
    }
    if (currentStep.key === "owner" && name.trim().length < 2) {
      return "Add your name so the owner account is recognizable.";
    }
    if (currentStep.key === "account") {
      if (!isValidEmail(email)) return "Add a valid work email.";
      if (password.length < 8) return "Use at least 8 characters for the password.";
    }
    return null;
  }

  function goNext() {
    const message = stepError();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStepIndex((value) => Math.min(value + 1, CLOUD_STEPS.length - 1));
  }

  function goBack() {
    setError("");
    setStepIndex((value) => Math.max(value - 1, 0));
  }

  function updateTeamMember(id: string, patch: Partial<TeamMemberDraft>) {
    setTeamMembers((members) =>
      members.map((member) => (member.id === id ? { ...member, ...patch } : member))
    );
  }

  function addTeamMember() {
    setTeamMembers((members) => [
      ...members,
      {
        id: `team-${Date.now()}-${members.length}`,
        name: "",
        email: "",
        role: "technician",
      },
    ]);
  }

  function removeTeamMember(id: string) {
    setTeamMembers((members) =>
      members.length === 1 ? members : members.filter((member) => member.id !== id)
    );
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = stepError();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setLoading(true);
    registerMutation.mutate({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      practiceName: practiceName.trim(),
      locationName: locationName.trim(),
      onboardingDraft: {
        logoName: logoName || undefined,
        brandColor,
        teamMembers: completeTeamMembers,
      },
    });
  }

  const previewProps = {
    practiceName,
    locationName,
    ownerName: name,
    logoPreview,
    brandColor,
    teamMembers,
    activeStep: currentStep.key,
  };

  if (verifySent) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#fdf2f8_45%,#ecfdf5_100%)] p-3 text-slate-950 sm:p-4 lg:h-screen lg:overflow-hidden lg:p-6">
        <main
          id="main-content"
          className="mx-auto grid w-full max-w-7xl gap-4 lg:h-full lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.78fr)]"
        >
          <OnboardingPreviewPanel {...previewProps} />
          <section className="order-1 flex items-center justify-center lg:order-2">
            <div className="w-full rounded-lg border border-white/80 bg-white p-6 shadow-xl shadow-rose-200/30 sm:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <MailCheck className="h-5 w-5" />
              </div>
              <p className="mt-5 text-sm font-semibold text-emerald-700">
                Workspace created
              </p>
              <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-950">
                Verify the owner account.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                We created a private OpenVPM Cloud workspace for{" "}
                <span className="font-medium text-slate-950">{practiceName}</span>.
                Verify <span className="font-medium text-slate-950">{email}</span>{" "}
                to open the full trial and continue setup.
              </p>

              {verificationEmailSent === false && (
                <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Email delivery is not configured in this preview, so use the
                  test verification link below.
                </div>
              )}

              {verificationUrl ? (
                <Button asChild className="mt-6 w-full">
                  <Link href={verificationUrl}>
                    Continue with preview verification
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <p className="mt-5 text-sm text-slate-600">
                  Check your inbox for the verification email. The link expires in
                  24 hours.
                </p>
              )}

              <Link
                href="/login"
                className="mt-4 inline-flex w-full justify-center text-sm text-emerald-700 hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#fdf2f8_45%,#ecfdf5_100%)] p-3 text-slate-950 sm:p-4 lg:h-screen lg:overflow-hidden lg:p-6">
      <main
        id="main-content"
        className="mx-auto grid w-full max-w-7xl gap-4 lg:h-full lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.78fr)]"
      >
        <OnboardingPreviewPanel {...previewProps} />

        <section className="order-1 flex min-h-0 items-center justify-center lg:order-2">
          <div className="flex w-full min-h-0 flex-col rounded-lg border border-white/80 bg-white p-5 shadow-xl shadow-rose-200/30 sm:p-6 lg:max-h-full">
            <div>
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

              <div className="mt-5 flex items-center gap-2">
                {CLOUD_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = index === stepIndex;
                  const isDone = index < stepIndex;
                  return (
                    <button
                      key={step.key}
                      type="button"
                      disabled={index > stepIndex}
                      onClick={() => setStepIndex(index)}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 rounded-md border px-2 py-2 text-left transition-colors",
                        isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-100 bg-slate-50 text-slate-500",
                        index > stepIndex && "cursor-default opacity-60"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                          isActive || isDone ? "bg-white text-emerald-700" : "bg-white text-slate-400"
                        )}
                      >
                        {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                      </span>
                      <span className="hidden truncate text-xs font-medium sm:block">
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <p className="text-sm font-semibold text-emerald-700">
                  Step {stepIndex + 1} of {CLOUD_STEPS.length}
                </p>
                <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-slate-950">
                  {currentStep.title}
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">{currentStep.body}</p>

                {error ? (
                  <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}

                <div className="mt-5">{renderStep()}</div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={goBack}
                  disabled={stepIndex === 0 || loading}
                  className="min-w-24"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                {currentStep.key === "account" ? (
                  <Button type="submit" disabled={loading} className="min-w-44">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating
                      </>
                    ) : (
                      <>
                        Create workspace
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button type="button" onClick={goNext} disabled={loading} className="min-w-32">
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-emerald-700 hover:underline">
                Sign in
              </Link>
              {cloudIntent ? " · Self-host stays free and fully unlocked." : null}
            </p>
          </div>
        </section>
      </main>
    </div>
  );

  function renderStep() {
    switch (currentStep.key) {
      case "practice":
        return (
          <div className="grid gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-800">
                Practice name
              </span>
              <Input
                value={practiceName}
                onChange={(e) => setPracticeName(e.target.value)}
                placeholder="Neighborhood Veterinary"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-800">
                First location
              </span>
              <Input
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Main Location"
                required
              />
            </label>
            <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
              This creates one practice tenant and one starting location. Every
              record created from here is scoped to that tenant.
            </div>
          </div>
        );
      case "owner":
        return (
          <div className="grid gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-800">
                Your name
              </span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Jane Smith"
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Role</p>
                <p className="mt-1 font-semibold text-slate-950">Practice admin</p>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Access</p>
                <p className="mt-1 font-semibold text-slate-950">Full trial</p>
              </div>
            </div>
          </div>
        );
      case "brand":
        return (
          <div className="grid gap-4">
            <div className="flex items-center gap-4 rounded-md border border-slate-100 bg-slate-50 p-4">
              <WorkspaceMark
                practiceName={practiceName}
                logoPreview={logoPreview}
                brandColor={brandColor}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {practiceName.trim() || "Your practice"}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {logoName || "Logo preview is optional"}
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Upload className="h-4 w-4" />
                Logo
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleLogoChange}
                />
              </label>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-800">Accent</p>
              <div className="flex gap-2">
                {BRAND_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use ${color}`}
                    onClick={() => setBrandColor(color)}
                    className={cn(
                      "h-9 w-9 rounded-md border-2 bg-white p-1",
                      brandColor === color ? "border-slate-950" : "border-transparent"
                    )}
                  >
                    <span
                      className="block h-full w-full rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              The logo is only previewed here. After email verification, upload the
              final file from practice settings.
            </p>
          </div>
        );
      case "team":
        return (
          <div className="grid gap-3">
            {teamMembers.map((member, index) => (
              <div key={member.id} className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">
                    Team member {index + 1}
                  </p>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-destructive disabled:opacity-40"
                    onClick={() => removeTeamMember(member.id)}
                    disabled={teamMembers.length === 1}
                    aria-label="Remove team member"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_1.15fr]">
                  <Input
                    value={member.name}
                    onChange={(e) => updateTeamMember(member.id, { name: e.target.value })}
                    placeholder="Alex Morgan"
                  />
                  <Input
                    value={member.email}
                    onChange={(e) => updateTeamMember(member.id, { email: e.target.value })}
                    placeholder="alex@clinic.com"
                    type="email"
                  />
                </div>
                <select
                  value={member.role}
                  onChange={(e) =>
                    updateTeamMember(member.id, { role: e.target.value as TeamRole })
                  }
                  className="h-10 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={addTeamMember}
              disabled={teamMembers.length >= 4}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add another
            </Button>
            <p className="text-xs leading-5 text-slate-500">
              These are staged for setup. Seats are billed only when active staff
              users are created in the practice.
            </p>
          </div>
        );
      case "account":
        return (
          <div className="grid gap-4">
            {cloudIntent ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Cloud base</p>
                  <p className="mt-1 font-semibold text-slate-950">$49/location</p>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Staff seats</p>
                  <p className="mt-1 font-semibold text-slate-950">$10/user</p>
                </div>
              </div>
            ) : null}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-800">
                Work email
              </span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.com"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-800">
                Password
              </span>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </label>
            <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
              No card today. You will verify email, enter the workspace, and review
              billing only when you are ready.
            </div>
          </div>
        );
      default:
        return null;
    }
  }
}

function OnboardingPreviewPanel(props: {
  practiceName: string;
  locationName: string;
  ownerName: string;
  logoPreview: string | null;
  brandColor: string;
  teamMembers: TeamMemberDraft[];
  activeStep: CloudStepKey;
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
            Set up the practice before payment enters the room.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Build the tenant, preview the workflow, verify the owner account, then
            decide when to keep OpenVPM Cloud.
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
        <PlatformPreview {...props} />
      </div>
    </section>
  );
}
