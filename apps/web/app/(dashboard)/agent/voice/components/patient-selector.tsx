"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface PatientSelectorProps {
  value: {
    id: string;
    name: string;
    species?: string | null;
    clientName: string;
  } | null;
  onChange: (patient: {
    id: string;
    name: string;
    species?: string | null;
    clientName: string;
  } | null) => void;
}

export function PatientSelector({ value, onChange }: PatientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const results = trpc.patients.search.useQuery(
    { query: search },
    { enabled: search.length >= 2 },
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value
            ? `${value.name} (${value.clientName})`
            : "Vyhľadať pacienta..."}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-2" align="start">
        <Input
          placeholder="Hľadať pacienta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8"
          autoFocus
        />
        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {search.length < 2 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Zadajte aspoň 2 znaky
            </p>
          ) : results.isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Hľadám...
            </p>
          ) : !results.data || results.data.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Žiadni pacienti
            </p>
          ) : (
            results.data.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                onClick={() => {
                  const clientFullName = [p.clientFirstName, p.clientLastName].filter(Boolean).join(" ");
                  onChange({
                    id: p.id,
                    name: p.name ?? "Neznámy pacient",
                    species: p.species ?? null,
                    clientName: clientFullName,
                  });
                  setOpen(false);
                  setSearch("");
                }}
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {p.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[p.clientFirstName, p.clientLastName].filter(Boolean).join(" ")}
                    {p.species ? ` · ${p.species}` : ""}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
