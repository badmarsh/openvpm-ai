"use client";

import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, splitLink } from "@trpc/client";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import superjson from "superjson";
import { Analytics } from "@vercel/analytics/next";
import { filterVercelAnalyticsEvent } from "./analytics-privacy";
import { createAppQueryClient } from "./query-client";
import { trpc } from "./trpc";
import { I18nProvider } from "./i18n";
import { GuiThemeProvider } from "./theme/theme-context";

export const ACTIVE_THEME = "light";

export function Providers({ children }: { children: React.ReactNode }) {
  // Purge any rogue service workers and stale browser caches on localhost
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1")
    ) {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
      }
      if ("caches" in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        });
      }
    }
  }, []);

  const [queryClient] = useState(() => createAppQueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        splitLink({
          condition: (operation) =>
            [
              "records.searchPatientHistory",
              "visitTreatmentPlans.searchCatalog",
              "visitTreatmentPlans.quote",
            ].includes(operation.path),
          true: httpBatchLink({
            url: "/api/trpc",
            transformer: superjson,
            methodOverride: "POST",
          }),
          false: httpBatchLink({
            url: "/api/trpc",
            transformer: superjson,
          }),
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme={ACTIVE_THEME}
            forcedTheme={ACTIVE_THEME}
            enableSystem={false}
          >
            <I18nProvider>
              <GuiThemeProvider>
                {children}
                <Toaster richColors position="bottom-right" />
                <Analytics beforeSend={filterVercelAnalyticsEvent} />
              </GuiThemeProvider>
            </I18nProvider>
          </ThemeProvider>
        </SessionProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
