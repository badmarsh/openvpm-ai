/**
 * Email content cleaner for clinical inbox.
 * Strips verbose email thread history, signatures and mobile headers
 * to keep the clinic inbox clean, readable and actionable.
 */

export function cleanEmailBody(raw: string | null | undefined): {
  cleanText: string;
  hasQuotedHistory: boolean;
  rawText: string;
} {
  if (!raw) {
    return { cleanText: "", hasQuotedHistory: false, rawText: "" };
  }

  const rawText = raw;
  let text = raw.replace(/^From:[^\n]+\n*/i, "").trim();

  // Check if text starts directly with quote marker
  if (/^(On\s+.+?\s+wrote:|Dňa\s+.+?\s+napísal:?)/i.test(text)) {
    return {
      cleanText: "[Preposlaná správa bez nového textu]",
      hasQuotedHistory: true,
      rawText,
    };
  }

  let hasQuotedHistory = false;
  const quoteMarkers = [
    /\n\s*On\s+.+?\s+wrote:/im,
    /\n\s*Dňa\s+.+?\s+napísal/im,
    /\n\s*----------\s*Forwarded message/i,
    /\n\s*----------\s*Preposlaná správa/i,
    /\n\s*_{10,}/,
  ];

  for (const marker of quoteMarkers) {
    const match = text.search(marker);
    if (match !== -1) {
      hasQuotedHistory = true;
      text = text.substring(0, match);
    }
  }

  const lines = text.split("\n");
  const filteredLines = lines.filter((line) => {
    if (line.trim().startsWith(">")) {
      hasQuotedHistory = true;
      return false;
    }
    return true;
  });
  text = filteredLines.join("\n");

  // Remove common mobile signatures
  text = text.replace(
    /\n*\s*(Odoslané z (iPhonu|telefónu|môjho zariadenia)|Sent from my iPhone).*$/is,
    ""
  );

  const cleanText = text.trim() || (hasQuotedHistory ? "[Iba citovaný text]" : "[Prázdna správa]");

  return {
    cleanText,
    hasQuotedHistory,
    rawText,
  };
}

