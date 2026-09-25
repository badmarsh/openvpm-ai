"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneOff, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface SupportSessionControlsProps {
  sessionCode?: string;
  onEnd: () => void;
  isActive: boolean;
}

export function SupportSessionControls({
  sessionCode,
  onEnd,
  isActive,
}: SupportSessionControlsProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copyCode = useCallback(() => {
    if (sessionCode) {
      navigator.clipboard.writeText(sessionCode);
      setCopied(true);
      toast.success(t("toast.codeCopied", "Kód skopírovaný"));
      setTimeout(() => setCopied(false), 2000);
    }
  }, [sessionCode, t]);

  const handleEnd = useCallback(() => {
    onEnd();
    toast.info(t("toast.sessionEnded", "Relácia podpory ukončená"));
  }, [onEnd, t]);

  return (
    <div className="flex items-center gap-3">
      {sessionCode && (
        <div className="flex items-center gap-2 bg-stone-100 rounded-md px-3 py-1.5">
          <span className="text-xs font-mono font-bold tracking-widest text-stone-700">
            {sessionCode}
          </span>
          <button
            onClick={copyCode}
            className="text-stone-400 hover:text-stone-600 transition-colors"
            title={t("support.copyCode", "Kopírovať kód")}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {isActive && (
        <Button
          variant="destructive"
          size="sm"
          onClick={handleEnd}
          className="gap-2"
        >
          <PhoneOff className="w-4 h-4" />
          {t("support.endSession", "Ukončiť reláciu")}
        </Button>
      )}
    </div>
  );
}

/**
 * Agent join form — enter session code to connect.
 */
export function AgentJoinForm({
  onJoin,
}: {
  onJoin: (code: string) => void;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) {
      onJoin(code.toUpperCase());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
        placeholder="ABC123"
        maxLength={6}
        className="w-28 font-mono text-center uppercase tracking-widest"
      />
      <Button type="submit" size="sm" disabled={code.length !== 6}>
        {t("support.join", "Pripojiť sa")}
      </Button>
    </form>
  );
}
