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


export function parseSenderIdentity(rawHeader: string | null | undefined, rawContent?: string | null): {
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
} {
  let fromStr = rawHeader || "";
  if (!fromStr && rawContent) {
    const m = rawContent.match(/From:[ \t]*([^\r\n]+)/i);
    if (m) fromStr = m[1].trim();
  }

  let email = "";
  let fullName = "";

  const emailMatch =
    fromStr.match(/<([^>]+)>/) ||
    fromStr.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    email = emailMatch[1].trim().toLowerCase();
  }

  const nameMatch =
    fromStr.match(/^["']?([^"'<]+)["']?\s*</) || fromStr.match(/^([^<]+)</);
  if (nameMatch && nameMatch[1].trim()) {
    fullName = nameMatch[1].trim();
  } else if (email) {
    const localPart = email.split("@")[0];
    const parts = localPart.split(/[._-]/).filter((p) => isNaN(Number(p)) && p.length > 1);
    if (parts.length > 0) {
      fullName = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
    }
  }

  const nameTokens = fullName.trim().split(/\s+/);
  let firstName = "";
  let lastName = "";
  if (nameTokens.length === 1 && nameTokens[0]) {
    firstName = nameTokens[0];
    lastName = "Klient";
  } else if (nameTokens.length >= 2) {
    firstName = nameTokens[0];
    lastName = nameTokens.slice(1).join(" ");
  }

  return { email, fullName, firstName, lastName };
}


