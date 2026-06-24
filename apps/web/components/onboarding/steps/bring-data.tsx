"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileSpreadsheet,
  Loader2,
  PlugZap,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { StepHandle, StepProps } from "../journey-types";

type Choice = "import" | "api" | "keep";

const CLIENT_COLUMNS =
  "firstName, lastName, email, phone, address, city, state, zip";
const PET_COLUMNS =
  "clientEmail, name, species, breed, sex, dob, color, microchipNumber";

const textareaClass =
  "w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

const fileInputClass =
  "block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-emerald-700";

// Read a chosen file to text so we can pass the CSV string to the import calls.
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsText(file);
  });
}

/**
 * Step 4: choose how real data gets in. Import from a file now, connect by API
 * later, or keep the sample data for now (the default and the skip behavior).
 */
export function BringDataStep({
  register,
  setState,
}: Pick<StepProps, "register" | "setState">) {
  const importClients = trpc.data.importClientsCsv.useMutation();
  const importPatients = trpc.data.importPatientsCsv.useMutation();

  // Default to keeping the sample data; the skip behavior matches this too.
  const [choice, setChoice] = useState<Choice>("keep");
  const [clientsCsv, setClientsCsv] = useState("");
  const [petsCsv, setPetsCsv] = useState("");
  const [clientsFileName, setClientsFileName] = useState("");
  const [petsFileName, setPetsFileName] = useState("");
  const [result, setResult] = useState<{
    clients: number;
    pets: number;
    errors: string[];
  } | null>(null);

  async function onPickFile(
    e: React.ChangeEvent<HTMLInputElement>,
    setCsv: (v: string) => void,
    which: "clients" | "pets"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileText(file);
      setCsv(text);
      if (which === "clients") setClientsFileName(file.name);
      else setPetsFileName(file.name);
    } catch {
      toast.error("Could not read that file. Try again.");
    }
  }

  // Picking a choice updates the shared state so finish knows whether to clear
  // the sample data. Only an actual file import (with real rows pasted in)
  // replaces it; "connect later" and "keep" both leave the sample data alone.
  const hasRealRows =
    choice === "import" && (clientsCsv.trim().length > 0 || petsCsv.trim().length > 0);
  useEffect(() => {
    setState({ keepSampleData: !hasRealRows });
  }, [hasRealRows, setState]);

  useEffect(() => {
    register({
      async onContinue() {
        // Only the file path does extra work on Continue; the others just move on.
        if (choice !== "import") return true;
        if (!clientsCsv.trim() && !petsCsv.trim()) return true;

        const errors: string[] = [];
        let clientsImported = 0;
        let petsImported = 0;

        if (clientsCsv.trim()) {
          const r = await importClients.mutateAsync({ csv: clientsCsv.trim() });
          clientsImported = r.imported ?? 0;
          if (r.errors?.length) errors.push(...r.errors);
        }
        if (petsCsv.trim()) {
          const r = await importPatients.mutateAsync({ csv: petsCsv.trim() });
          petsImported = r.imported ?? 0;
          if (r.errors?.length) errors.push(...r.errors);
        }
        setResult({ clients: clientsImported, pets: petsImported, errors });
        toast.success(
          `Added ${clientsImported} clients and ${petsImported} pets`
        );
        // Stay on the step so they can see the result before moving on.
        return false;
      },
    });
  }, [register, choice, clientsCsv, petsCsv, importClients, importPatients]);

  const importing = importClients.isPending || importPatients.isPending;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">
        Bring in your real clients and pets. You own this data and can export it
        any time.
      </p>

      <div className="grid gap-3">
        <ChoiceCard
          active={choice === "import"}
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title="Import from a file"
          subtitle="Paste your clients and pets from a spreadsheet."
          onClick={() => setChoice("import")}
        />
        {choice === "import" ? (
          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs text-slate-500">
              Pick a CSV file for each one, or paste the rows below. The file
              picker is the easy way.
            </p>
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">
                Clients
              </span>
              <p className="text-xs text-slate-500">
                Columns: {CLIENT_COLUMNS}
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => onPickFile(e, setClientsCsv, "clients")}
                className={fileInputClass}
                aria-label="Choose a clients CSV file"
              />
              {clientsFileName ? (
                <p className="text-xs text-emerald-700">
                  Loaded {clientsFileName}
                </p>
              ) : null}
              <textarea
                rows={4}
                className={textareaClass}
                value={clientsCsv}
                onChange={(e) => setClientsCsv(e.target.value)}
                placeholder={`firstName,lastName,email,phone,address,city,state,zip`}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Pets</span>
              <p className="text-xs text-slate-500">Columns: {PET_COLUMNS}</p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => onPickFile(e, setPetsCsv, "pets")}
                className={fileInputClass}
                aria-label="Choose a pets CSV file"
              />
              {petsFileName ? (
                <p className="text-xs text-emerald-700">Loaded {petsFileName}</p>
              ) : null}
              <textarea
                rows={4}
                className={textareaClass}
                value={petsCsv}
                onChange={(e) => setPetsCsv(e.target.value)}
                placeholder={`clientEmail,name,species,breed,sex,dob,color,microchipNumber`}
              />
            </div>
            {importing ? (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Adding your data
              </p>
            ) : null}
            {result ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <p className="font-medium">
                  Added {result.clients} clients and {result.pets} pets.
                </p>
                {result.errors.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-amber-800">
                    {result.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {result.errors.length > 5 ? (
                      <li>and {result.errors.length - 5} more</li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="mt-1">Press Continue when you are ready.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <ChoiceCard
          active={choice === "api"}
          icon={<PlugZap className="h-5 w-5" />}
          title="Connect later by API"
          subtitle="Move data in from another system whenever you want."
          onClick={() => setChoice("api")}
        />
        {choice === "api" ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
            <p>
              Your data stays yours, and you can connect by API on your own
              schedule. Find your keys and import tools in settings.
            </p>
            <Link
              href="/settings?tab=data"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
            >
              Open settings
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : null}

        <ChoiceCard
          active={choice === "keep"}
          icon={<Sparkles className="h-5 w-5" />}
          title="Keep the sample data for now"
          subtitle="Explore with the example pets we set up for you."
          onClick={() => setChoice("keep")}
        />
      </div>
    </div>
  );
}

function ChoiceCard({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-white p-4 text-left transition-colors",
        active
          ? "border-emerald-300 ring-1 ring-emerald-300"
          : "border-slate-200 hover:border-slate-300"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">{subtitle}</span>
      </span>
      {active ? (
        <Check className="h-5 w-5 shrink-0 text-emerald-600" />
      ) : null}
    </button>
  );
}
