"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * GFM markdown renderer. Import this module ONLY via next/dynamic with
 * `{ ssr: false }` — react-markdown + remark-gfm are heavy (~100 KB+) and
 * must never land in a page's initial bundle. See the agent pages for usage.
 */
export function MarkdownView({
  children,
  className,
  components,
}: {
  children: string;
  className?: string;
  components?: Components;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => (
            <div className="my-2 w-full overflow-x-auto">
              <table
                {...props}
                className="min-w-full divide-y divide-border text-xs"
              />
            </div>
          ),
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:opacity-80"
            />
          ),
          ...components,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
