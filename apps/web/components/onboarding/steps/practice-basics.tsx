"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import type { StepHandle } from "../journey-types";

// Same regions the settings page offers. Choosing a country auto-fills
// currency and tax for you on the server, so you do not have to.
const COUNTRIES: { code: string; label: string }[] = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "IE", label: "Ireland" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
];

// Mirrors the TIMEZONES list on the settings page.
const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "Europe/London",
  "Europe/Dublin",
  "Australia/Sydney",
];

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/**
 * Step 1: capture the clinic name, country, and timezone. Continue saves them
 * with updatePractice (which also fills in currency and tax from the country).
 */
export function PracticeBasicsStep({ register }: { register: (h: StepHandle) => void }) {
  const { data: practice, isLoading } = trpc.settings.getPractice.useQuery();
  const updatePractice = trpc.settings.updatePractice.useMutation();

  const [name, setName] = useState("");
  const [country, setCountry] = useState("US");
  const [timezone, setTimezone] = useState("America/New_York");
  const [filled, setFilled] = useState(false);

  // Prefill once from the saved practice without stomping later edits.
  useEffect(() => {
    if (filled || !practice) return;
    setName(practice.name ?? "");
    setCountry(practice.country ?? "US");
    setTimezone(practice.timezone ?? "America/New_York");
    setFilled(true);
  }, [practice, filled]);

  useEffect(() => {
    register({
      async onContinue() {
        const trimmed = name.trim();
        if (!trimmed) return true; // nothing to save; let them move on
        await updatePractice.mutateAsync({
          name: trimmed,
          country,
          timezone,
        });
        return true;
      },
    });
  }, [register, name, country, timezone, updatePractice]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        This is your clinic, and your data. Add a few basics so OpenVPM feels
        right. You can change all of this later in settings.
      </p>

      <FormField label="Practice name" htmlFor="ob-practice-name">
        <Input
          id="ob-practice-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Neighborhood Veterinary"
          autoFocus
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Country" htmlFor="ob-country">
          <select
            id="ob-country"
            className={selectClass}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Time zone" htmlFor="ob-timezone">
          <select
            id="ob-timezone"
            className={selectClass}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </FormField>
      </div>
    </div>
  );
}
