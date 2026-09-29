"use client";

import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function AllergyForm({
  allergyName,
  setAllergyName,
  allergySeverity,
  setAllergySeverity,
  allergyReaction,
  setAllergyReaction,
  canSubmit,
  isPending,
  onSubmit,
  onCancel,
}: {
  allergyName: string;
  setAllergyName: (v: string) => void;
  allergySeverity: "mild" | "moderate" | "severe";
  setAllergySeverity: (v: "mild" | "moderate" | "severe") => void;
  allergyReaction: string;
  setAllergyReaction: (v: string) => void;
  canSubmit: boolean;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-2">
      <div className="w-full sm:w-44">
        <label
          htmlFor="allergy-allergen"
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          {t("patients.profile.allergen", "Allergen")}
        </label>
        <input
          id="allergy-allergen"
          type="text"
          value={allergyName}
          maxLength={255}
          required
          placeholder="Penicillin"
          onChange={(event) => setAllergyName(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label
          htmlFor="allergy-severity"
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          {t("patients.profile.severity", "Severity")}
        </label>
        <select
          id="allergy-severity"
          value={allergySeverity}
          onChange={(event) =>
            setAllergySeverity(
              event.target.value as "mild" | "moderate" | "severe",
            )
          }
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="mild">
            {t("patients.profile.severityMild", "Mild")}
          </option>
          <option value="moderate">
            {t("patients.profile.severityModerate", "Moderate")}
          </option>
          <option value="severe">
            {t("patients.profile.severitySevere", "Severe")}
          </option>
        </select>
      </div>
      <div className="w-full sm:w-56">
        <label
          htmlFor="allergy-reaction"
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          {t("patients.profile.reactionOptional", "Reaction (optional)")}
        </label>
        <input
          id="allergy-reaction"
          type="text"
          value={allergyReaction}
          maxLength={2000}
          placeholder={t("patients.profile.reactionPlaceholder", "e.g. facial swelling, pruritus")}
          onChange={(event) => setAllergyReaction(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-3.5 w-3.5" />
          )}
          {isPending
            ? t("common.saving", "Saving...")
            : t("patients.profile.saveAllergy", "Save allergy")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("common.cancel", "Cancel")}
        </Button>
      </div>
    </form>
  );
}