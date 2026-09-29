"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCopy, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const STORAGE_KEY = "openvpm:migration-review:v1";

const reviewSteps = [
  {
    id: "totals",
    titleKey: "migrationArchive.guide.stepTotalsTitle",
    title: "Confirm the high-level totals",
    detailKey: "migrationArchive.guide.stepTotalsDetail",
    detail: "Check that the client, patient, reminder, service, and product counts look plausible.",
  },
  {
    id: "known-records",
    titleKey: "migrationArchive.guide.stepKnownRecordsTitle",
    title: "Find a few familiar clients and patients",
    detailKey: "migrationArchive.guide.stepKnownRecordsDetail",
    detail: "Use search and open several records you know well. Confirm identity and relationships before clinical use.",
  },
  {
    id: "care-history",
    titleKey: "migrationArchive.guide.stepCareHistoryTitle",
    title: "Review care history",
    detailKey: "migrationArchive.guide.stepCareHistoryDetail",
    detail: "Sample prior appointments, prescriptions, fills, lab reports, and reminders across different years.",
  },
  {
    id: "business-history",
    titleKey: "migrationArchive.guide.stepBusinessHistoryTitle",
    title: "Review business history",
    detailKey: "migrationArchive.guide.stepBusinessHistoryDetail",
    detail: "Sample historical documents and financial records. These are reference history, not live receivables.",
  },
  {
    id: "exceptions",
    titleKey: "migrationArchive.guide.stepExceptionsTitle",
    title: "Sample items marked Needs review",
    detailKey: "migrationArchive.guide.stepExceptionsDetail",
    detail: "Check a few familiar examples. OpenVPM remains responsible for the bulk reconciliation queue.",
  },
] as const;

type StepId = (typeof reviewSteps)[number]["id"];

function readCompleted(): StepId[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set<StepId>(reviewSteps.map((step) => step.id));
    return parsed.filter(
      (value): value is StepId => typeof value === "string" && allowed.has(value as StepId),
    );
  } catch {
    return [];
  }
}

export function MigrationReviewChecklist() {
  const { t } = useI18n();
  const [completed, setCompleted] = useState<StepId[]>([]);
  const [ready, setReady] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    setCompleted(readCompleted());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
    } catch {
      // Browsers may disable session storage. The checklist remains usable in
      // memory and never falls back to a server write.
    }
  }, [completed, ready]);

  const completedSet = useMemo(() => new Set(completed), [completed]);
  const progress = Math.round((completed.length / reviewSteps.length) * 100);

  function toggle(id: StepId) {
    setCompleted((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  async function copyIssueTemplate() {
    try {
      await navigator.clipboard.writeText(
        "Migration review issue\nCategory: \nOpenVPM record reference: \nWhat I expected: \nWhat I observed: \n\nDo not include names, contact details, medical details, or source-system identifiers.",
      );
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 2500);
  }

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="border-b border-border bg-primary/[0.04]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <CardTitle>
                {t("migrationArchive.guide.title", "Data validation guide")}
              </CardTitle>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {t(
                "migrationArchive.guide.description",
                "Work through a small, representative sample before relying on the imported history. Your checklist stays in this browser session and is never written to clinic records.",
              )}
            </p>
          </div>
          <div className="min-w-40 rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {t("migrationArchive.guide.progress", "Review progress")}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {completed.length}/{reviewSteps.length}
              </span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={t("migrationArchive.guide.progress", "Migration review progress")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-6">
        <nav aria-label="Data validation shortcuts" className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/clients">
              {t("migrationArchive.guide.findClient", "Find a familiar client")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/patients">
              {t("migrationArchive.guide.findPatient", "Find a familiar patient")}
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="#archive-records">
              {t("migrationArchive.guide.browseHistory", "Browse imported history")}
            </Link>
          </Button>
        </nav>

        <ol className="grid gap-3 lg:grid-cols-2">
          {reviewSteps.map((step) => {
            const checked = completedSet.has(step.id);
            return (
              <li key={step.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(step.id)}
                  className={cn(
                    "flex h-full w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    checked
                      ? "border-primary/40 bg-primary/[0.06]"
                      : "border-border bg-card hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background",
                    )}
                    aria-hidden="true"
                  >
                    {checked ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span>
                    <span className="block font-medium">
                      {t(step.titleKey, step.title)}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                      {t(step.detailKey, step.detail)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              {t("migrationArchive.guide.issueTitle", "Found something that looks wrong?")}
            </p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {t(
                "migrationArchive.guide.issueDescription",
                "Copy a privacy-safe report outline. Use only the OpenVPM record reference—never paste names, contact information, medical detail, or old-system identifiers into email or chat.",
              )}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {t(
                "migrationArchive.guide.issueDisclaimer",
                "Completing this checklist records no approval and never releases protected review mode.",
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={copyIssueTemplate}>
              <ClipboardCopy className="mr-2 h-4 w-4" aria-hidden="true" />
              {copyState === "copied"
                ? t("migrationArchive.guide.templateCopied", "Template copied")
                : copyState === "failed"
                  ? t("migrationArchive.guide.copyUnavailable", "Copy unavailable")
                  : t("migrationArchive.guide.copyTemplate", "Copy safe issue template")}
            </Button>
            {completed.length ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCompleted([])}
              >
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("migrationArchive.guide.reset", "Reset")}
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
