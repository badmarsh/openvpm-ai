"use client";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface SoapSectionsData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface SoapPreviewProps {
  sections: SoapSectionsData;
  editable?: boolean;
  onChange?: (sections: SoapSectionsData) => void;
  compact?: boolean;
}

const SECTION_LABELS: Record<
  keyof SoapSectionsData,
  { label: string; letter: string; color: string; description: string }
> = {
  subjective: {
    label: "Subjektívne",
    letter: "S",
    color: "border-l-blue-500",
    description: "Anamnéza, sťažnosti",
  },
  objective: {
    label: "Objektívne",
    letter: "O",
    color: "border-l-green-500",
    description: "Vyšetrenie, vitálne funkcie",
  },
  assessment: {
    label: "Diagnóza",
    letter: "A",
    color: "border-l-amber-500",
    description: "Pracovná diagnóza",
  },
  plan: {
    label: "Plán",
    letter: "P",
    color: "border-l-purple-500",
    description: "Lieky, dávky, kontrola",
  },
};

export function SoapPreview({
  sections,
  editable = false,
  onChange,
  compact = false,
}: SoapPreviewProps) {
  const update = (key: keyof SoapSectionsData, value: string) => {
    onChange?.({ ...sections, [key]: value });
  };

  const hasContent = Object.values(sections).some((v) => v.trim().length > 0);
  if (!hasContent && !editable) return null;

  const layout = compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2";

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">SOAP záznam</h3>
      <div className={cn("grid gap-3", layout)}>
        {(Object.keys(SECTION_LABELS) as Array<keyof SoapSectionsData>).map(
          (key) => {
            const config = SECTION_LABELS[key];
            return (
              <div
                key={key}
                className={cn(
                  "rounded-md border border-l-4 bg-background",
                  config.color,
                )}
              >
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                  <span
                    className={cn(
                      "h-5 w-5 rounded text-xs font-bold flex items-center justify-center text-white",
                      key === "subjective" && "bg-blue-500",
                      key === "objective" && "bg-green-500",
                      key === "assessment" && "bg-amber-500",
                      key === "plan" && "bg-purple-500",
                    )}
                  >
                    {config.letter}
                  </span>
                  <span className="text-xs font-medium">{config.label}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {config.description}
                  </span>
                </div>
                {editable ? (
                  <Textarea
                    value={sections[key]}
                    onChange={(e) => update(key, e.target.value)}
                    rows={compact ? 2 : 3}
                    className="text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
                    placeholder={`Zadajte ${config.label.toLowerCase()}...`}
                  />
                ) : (
                  <div className="p-3 text-sm whitespace-pre-wrap min-h-[40px]">
                    {sections[key] || (
                      <span className="text-muted-foreground italic">
                        Prázdne
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
