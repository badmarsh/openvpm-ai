"use client";

import { Download, Printer, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import type { PersistedChatMessage } from "./agent-chat-history";

export function exportConversationToMarkdown(
  messages: PersistedChatMessage[],
  clinicTitle?: string,
): string {
  const dateStr = new Date().toLocaleString("sk-SK");
  let md = `# OpenVPM AI Asistent — Záznam konverzácie\n`;
  md += `**Pracovisko:** ${clinicTitle || "Veterinárna prax"}  \n`;
  md += `**Dátum a čas:** ${dateStr}\n\n---\n\n`;

  for (const m of messages) {
    const speaker =
      m.role === "user" ? "🧑‍⚕️ Veterinárny lekár" : "🤖 OpenVPM AI Copilot";
    md += `### ${speaker}\n${m.content}\n\n`;
    if (m.toolCalls && m.toolCalls.length > 0) {
      md += `<details><summary>Použité nástroje (${m.toolCalls.length})</summary>\n\n`;
      for (const call of m.toolCalls) {
        md += `- **${call.name}**: \`${JSON.stringify(call.input)}\` ${call.error ? `*(Chyba: ${call.error})*` : ""}\n`;
      }
      md += `\n</details>\n\n`;
    }
  }

  return md;
}

export function AgentExportButtons({
  messages,
  clinicName,
}: {
  messages: PersistedChatMessage[];
  clinicName?: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  if (messages.length === 0) return null;

  const handleCopyMarkdown = () => {
    const md = exportConversationToMarkdown(messages, clinicName);
    navigator.clipboard.writeText(md);
    setCopied(true);
    toast.success(t("agent.export.copied", "Záznam konverzácie skopírovaný v Markdown formáte"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const md = exportConversationToMarkdown(messages, clinicName);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openvpm-agent-chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("agent.export.downloaded", "Záznam konverzácie stiahnutý"));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopyMarkdown}
        title={t("agent.export.copyTitle", "Kopírovať ako Markdown")}
        className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{t("agent.export.copy", "Kopírovať")}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownloadMarkdown}
        title={t("agent.export.downloadTitle", "Stiahnuť .md súbor")}
        className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("agent.export.download", "Stiahnuť")}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handlePrint}
        title={t("agent.export.printTitle", "Tlačiť")}
        className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
      >
        <Printer className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
