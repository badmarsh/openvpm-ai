"use client";

import { useState, useEffect } from "react";
import { Mic, X, Search, ChevronRight, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function ScribeWidget() {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Zjednodusene vyhladavanie pacientov pre rychlu hlasovu konzultaciu
  const { data: patients, isLoading } = trpc.patients.search.useQuery(
    { query: debouncedSearch },
    { enabled: open && debouncedSearch.trim().length >= 2 },
  );

  const startConsultation = (patientId?: string) => {
    setOpen(false);
    setSearch("");
    if (patientId) {
      router.push(`/agent/voice?patientId=${patientId}`);
    } else {
      router.push("/agent/voice");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="lg"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all p-0 flex items-center justify-center z-50 text-primary-foreground focus:outline-none focus:ring-4 focus:ring-primary/25"
          title={t("scribe.title", "AI Voice Scribe - Voice Consultation")}
          aria-label="AI Voice Scribe"
        >
          <Mic className="h-6 w-6 text-primary-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-84 p-0 shadow-2xl rounded-2xl border-primary/20 mb-2 bg-card text-card-foreground overflow-hidden"
      >
        {/* Header */}
        <div className="bg-primary/5 p-4 border-b flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-primary flex items-center gap-2 text-sm">
              <Mic className="w-4 h-4 text-primary" />
              <span>AI Voice Scribe</span>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                <Sparkles className="w-2.5 h-2.5" /> STT
              </span>
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("scribe.description", "Search for a patient to start a voice consultation and generate SOAP notes.")}
          </p>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b bg-background/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("scribe.searchPlaceholder", "Search patient...")}
              className="pl-9 h-9 text-xs bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Patients List Results */}
        <div className="max-h-64 overflow-y-auto p-2 flex flex-col gap-1">
          {debouncedSearch.trim().length < 2 ? (
            <div className="text-center py-6 px-4 text-xs text-muted-foreground">
              {t("scribe.minCharsHint", "Enter at least 2 characters to search for a patient")}
            </div>
          ) : isLoading ? (
            <div className="text-center py-6 px-4 text-xs text-muted-foreground">
              {t("scribe.searching", "Searching records...")}
            </div>
          ) : !patients || patients.length === 0 ? (
            <div className="text-center py-6 px-4 text-xs text-muted-foreground">
              {t("scribe.noPatientsFound", "No patients found.")}
            </div>
          ) : (
            patients.map((patient) => {
              const clientName = [patient.clientFirstName, patient.clientLastName]
                .filter(Boolean)
                .join(" ");

              return (
                <Button
                  key={patient.id}
                  variant="ghost"
                  className="justify-between h-auto py-2.5 px-3 hover:bg-primary/10 rounded-xl transition-all"
                  onClick={() => startConsultation(patient.id)}
                >
                  <div className="flex flex-col items-start gap-0.5 text-left min-w-0">
                    <span className="font-semibold text-xs text-foreground truncate max-w-[200px]">
                      {patient.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                      {patient.species || "Pacient"}
                      {patient.breed ? ` • ${patient.breed}` : ""}
                      {clientName ? ` (${clientName})` : ""}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Button>
              );
            })
          )}
        </div>

        {/* Quick Footer Action: Voice Workspace */}
        <div className="p-2 border-t bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-primary hover:text-primary hover:bg-primary/10 justify-center gap-1.5 h-8 font-medium"
            onClick={() => startConsultation()}
          >
            <span>{t("scribe.startWithoutPatient", "Start dictation without selection")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
