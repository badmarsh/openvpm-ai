"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Renders sanitized markdown with a strict whitelist of safe formatting tags.
 * Disallows raw HTML, scripts, iframes, and external links to prevent XSS.
 */
export function SafeMarkdown({ content, className }: SafeMarkdownProps) {
  return (
    <div className={cn("prose prose-stone dark:prose-invert max-w-none text-sm leading-relaxed", className)}>
      <ReactMarkdown
        allowedElements={["p", "b", "strong", "i", "em", "u", "ul", "ol", "li", "br"]}
        unwrapDisallowed
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
