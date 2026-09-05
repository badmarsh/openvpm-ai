"use client";

import { Textarea } from "@/components/ui/textarea";

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
}

const SECTION_LABELS: Record<keyof SoapSectionsData, { label: string; description: string }> = {
  subjective: {
    label: "Subjektívne (S)",
    description: "Anamnéza, sťažnosti majiteľa",
  },
  objective: {
    label: "Objektívne (O)",
    description: "Fyzikálne vyšetrenie, vitálne funkcie",
  },
  assessment: {
    label: "Diagnóza (A)",
    description: "Pracovná / diferenciálna diagnóza",
  },
  plan: {
    label: "Plán (P)",
    description: "Lieky, dávky, diéta, kontrola",
  },
};

export function SoapPreview({
  sections,
  editable = false,
  onChange,
}: SoapPreviewProps) {
  const update = (key: keyof SoapSectionsData, value: string) => {
    onChange?.({ ...sections, [key]: value });
  };

  const hasContent = Object.values(sections).some((v) => v.trim().length > 0);
  if (!hasContent && !editable) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">SOAP záznam</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(SECTION_LABELS) as Array<keyof SoapSectionsData>).map(
          (key) => (
            <div key={key} className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">
                  {SECTION_LABELS[key].label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {SECTION_LABELS[key].description}
                </span>
              </div>
              {editable ? (
                <Textarea
                  value={sections[key]}
                  onChange={(e) => update(key, e.target.value)}
                  rows={4}
                  className="text-sm"
                  placeholder={`Zadajte ${key}...`}
                />
              ) : (
                <div className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap min-h-[60px]">
                  {sections[key] || (
                    <span className="text-muted-foreground italic">
                      Prázdne
                    </span>
                  )}
                </div>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
