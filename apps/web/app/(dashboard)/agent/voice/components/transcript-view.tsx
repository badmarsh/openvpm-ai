"use client";

import { Textarea } from "@/components/ui/textarea";

interface TranscriptViewProps {
  transcript: string;
  editable?: boolean;
  onChange?: (value: string) => void;
}

export function TranscriptView({
  transcript,
  editable = false,
  onChange,
}: TranscriptViewProps) {
  if (!transcript) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Surová transkripcia</h3>
      {editable ? (
        <Textarea
          value={transcript}
          onChange={(e) => onChange?.(e.target.value)}
          rows={6}
          className="font-mono text-sm"
        />
      ) : (
        <div className="rounded-md border bg-muted/50 p-3 font-mono text-sm whitespace-pre-wrap">
          {transcript}
        </div>
      )}
    </div>
  );
}
