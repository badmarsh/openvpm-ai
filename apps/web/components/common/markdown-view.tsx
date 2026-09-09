"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * GFM markdown renderer. Import this module ONLY via next/dynamic with
 * `{ ssr: false }` — react-markdown + remark-gfm are heavy (~100 KB+) and
 * must never land in a page's initial bundle. See the agent pages for usage.
 */
export function MarkdownView({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
