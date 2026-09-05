"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  MessageSquare,
  FileText,
  List,
  ListOrdered,
  Bold,
  AlignLeft,
  Save,
  Users,
  Calendar,
  LayoutDashboard,
  Search,
  Copy,
  Check,
  X,
  Play,
  Sparkles,
  Mic,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface VoiceCommandItem {
  id: string;
  phrase: string;
  category: "documentation" | "formatting" | "navigation";
  categoryLabel: string;
  description: string;
  exampleUsage: string;
  icon: React.ElementType;
  badgeColor: string;
  actionKey: string;
}

export const VOICE_COMMANDS: VoiceCommandItem[] = [
  // 1. Dokumentačné Príkazy
  {
    id: "doc-new-note",
    phrase: "Nová poznámka pacienta",
    category: "documentation",
    categoryLabel: "Dokumentačné Príkazy",
    description: "Vyčistí rozpracované diktovanie a pripraví novú poznámku pre pacienta.",
    exampleUsage: "„Nová poznámka pacienta... Pes prichádza na kontrolu po operácii...“",
    icon: FileText,
    badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    actionKey: "new_note",
  },
  {
    id: "doc-start-consultation",
    phrase: "Začať konzultáciu",
    category: "documentation",
    categoryLabel: "Dokumentačné Príkazy",
    description: "Spustí mikrofón a začne zaznamenávať klinickú konzultáciu.",
    exampleUsage: "„Začať konzultáciu... pacient mačka 3 roky...“",
    icon: Mic,
    badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    actionKey: "start_consultation",
  },
  {
    id: "doc-end-note",
    phrase: "Ukončiť poznámku",
    category: "documentation",
    categoryLabel: "Dokumentačné Príkazy",
    description: "Zastaví nahrávanie zvuku a spustí AI prepis s extrakciou SOAP.",
    exampleUsage: "„...kontrola o 7 dní. Ukončiť poznámku.“",
    icon: Play,
    badgeColor: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    actionKey: "end_note",
  },
  {
    id: "doc-save-document",
    phrase: "Uložiť dokument",
    category: "documentation",
    categoryLabel: "Dokumentačné Príkazy",
    description: "Uloží vygenerovaný SOAP nález priamo do karty pacienta v kartotéke.",
    exampleUsage: "„Uložiť dokument“ po kontrole extrahovaných sekcií.",
    icon: Save,
    badgeColor: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    actionKey: "save_document",
  },

  // 2. Formátovacie Príkazy
  {
    id: "fmt-new-paragraph",
    phrase: "Nový odsek",
    category: "formatting",
    categoryLabel: "Formátovacie Príkazy",
    description: "Vloží nový riadok a odsek do klinického textu.",
    exampleUsage: "„...sliznice ružové. Nový odsek. Palpácia brucha nebolestivá...“",
    icon: AlignLeft,
    badgeColor: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    actionKey: "new_paragraph",
  },
  {
    id: "fmt-bullet-point",
    phrase: "Odrážka",
    category: "formatting",
    categoryLabel: "Formátovacie Príkazy",
    description: "Vloží odrážkový bod (•) pre prehľadný zoznam symptómov alebo liečiv.",
    exampleUsage: "„Odrážka amoxicilín 250 miligramov. Odrážka meloxikam...“",
    icon: List,
    badgeColor: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200 dark:border-sky-800",
    actionKey: "bullet_point",
  },
  {
    id: "fmt-numbered-list",
    phrase: "Číslovaný zoznam",
    category: "formatting",
    categoryLabel: "Formátovacie Príkazy",
    description: "Vloží číslovaný bod (1., 2., ...) do terapeutického plánu.",
    exampleUsage: "„Číslovaný zoznam aplikovať kvapky do očí dvakrát denne...“",
    icon: ListOrdered,
    badgeColor: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    actionKey: "numbered_list",
  },
  {
    id: "fmt-bold-text",
    phrase: "Tučný text",
    category: "formatting",
    categoryLabel: "Formátovacie Príkazy",
    description: "Zvýrazní nasledujúci veterinárny pojem alebo diagnózu tučným písmom.",
    exampleUsage: "„Tučný text podozrenie na akútnu pankreatitídu tučný text ukončiť...“",
    icon: Bold,
    badgeColor: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 border-violet-200 dark:border-violet-800",
    actionKey: "bold_text",
  },

  // 3. Navigačné Príkazy
  {
    id: "nav-patients",
    phrase: "Prejsť na pacientov",
    category: "navigation",
    categoryLabel: "Navigačné Príkazy",
    description: "Presmeruje do kartotéky a zoznamu pacientov (/patients).",
    exampleUsage: "„Prejsť na pacientov“",
    icon: Users,
    badgeColor: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    actionKey: "go_to_patients",
  },
  {
    id: "nav-appointments",
    phrase: "Otvoriť termíny",
    category: "navigation",
    categoryLabel: "Navigačné Príkazy",
    description: "Presmeruje na kalendár a rozvrh termínov kliniky (/appointments).",
    exampleUsage: "„Otvoriť termíny“",
    icon: Calendar,
    badgeColor: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    actionKey: "open_appointments",
  },
  {
    id: "nav-dashboard",
    phrase: "Zobraziť prehľad",
    category: "navigation",
    categoryLabel: "Navigačné Príkazy",
    description: "Otvorí hlavný manažérsky dashboard kliniky (/dashboard).",
    exampleUsage: "„Zobraziť prehľad“",
    icon: LayoutDashboard,
    badgeColor: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
    actionKey: "show_dashboard",
  },
  {
    id: "nav-records",
    phrase: "Hľadať v záznamoch",
    category: "navigation",
    categoryLabel: "Navigačné Príkazy",
    description: "Otvorí zoznam klinických záznamov a SOAP protokolov (/records).",
    exampleUsage: "„Hľadať v záznamoch“",
    icon: Search,
    badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    actionKey: "search_records",
  },
];

export interface VoiceCommandsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExecuteCommand?: (actionKey: string, phrase: string) => void;
}

export function VoiceCommandsModal({
  open,
  onOpenChange,
  onExecuteCommand,
}: VoiceCommandsModalProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const filteredCommands = useMemo(() => {
    return VOICE_COMMANDS.filter((cmd) => {
      const matchCategory =
        activeCategory === "all" || cmd.category === activeCategory;
      const matchSearch =
        !search.trim() ||
        cmd.phrase.toLowerCase().includes(search.toLowerCase()) ||
        cmd.description.toLowerCase().includes(search.toLowerCase()) ||
        cmd.exampleUsage.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [activeCategory, search]);

  const copyPhrase = (cmd: VoiceCommandItem) => {
    navigator.clipboard.writeText(cmd.phrase);
    setCopiedId(cmd.id);
    toast.success(`Príkaz „${cmd.phrase}“ bol skopírovaný`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExecute = (cmd: VoiceCommandItem) => {
    onOpenChange(false);
    toast.info(`Vykonávam príkaz: „${cmd.phrase}“`);
    onExecuteCommand?.(cmd.actionKey, cmd.phrase);
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl bg-card border rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-violet-500/25">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Hlasové Príkazy</h2>
                <Badge variant="outline" className="text-[10px] font-mono gap-1 border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300">
                  <Sparkles className="h-2.5 w-2.5" /> STT Control
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Vyslovte príkaz počas nahrávania pre automatické formátovanie, uloženie alebo navigáciu.
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: "Všetky" },
              { id: "documentation", label: "Dokumentačné" },
              { id: "formatting", label: "Formátovacie" },
              { id: "navigation", label: "Navigačné" },
            ].map((cat) => (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 text-xs px-2.5 rounded-lg whitespace-nowrap",
                  activeCategory === cat.id &&
                    "bg-violet-600 hover:bg-violet-700 text-white",
                )}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </Button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filtrovať príkazy..."
              className="pl-8 h-8 text-xs bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Command Cards List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredCommands.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenašli sa žiadne príkazy pre zadané kritériá.
            </div>
          ) : (
            filteredCommands.map((cmd) => {
              const Icon = cmd.icon;
              const isCopied = copiedId === cmd.id;

              return (
                <div
                  key={cmd.id}
                  className="group rounded-xl border bg-card hover:border-violet-300 dark:hover:border-violet-800 p-4 transition-all hover:shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:text-violet-600 group-hover:bg-violet-50 dark:group-hover:bg-violet-950/40 transition-colors shrink-0 mt-0.5 sm:mt-0">
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-foreground">
                          „{cmd.phrase}“
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-medium border", cmd.badgeColor)}
                        >
                          {cmd.categoryLabel}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {cmd.description}
                      </p>

                      <div className="mt-1 text-[11px] text-muted-foreground/80 italic">
                        Príklad: {cmd.exampleUsage}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2.5"
                      onClick={() => copyPhrase(cmd)}
                      title="Skopírovať príkaz"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Skopírované</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Kopírovať</span>
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/60 border border-violet-200 dark:border-violet-800"
                      onClick={() => handleExecute(cmd)}
                    >
                      <span>Vyskúšať</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Info */}
        <div className="px-6 py-3.5 border-t bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Mic className="h-3.5 w-3.5 text-violet-600" />
            <span>Pre rozpoznanie príkazu hovorte zreteľne do mikrofónu.</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Zavrieť
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
