"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { TourProvider } from "@/components/tour/tour-provider";
import { OnboardingJourneyProvider } from "@/components/onboarding/journey-overlay";
import { WelcomeProvider } from "@/components/welcome/welcome-provider";
import { BrandTheme } from "@/components/brand/brand-theme";
import { VerifyEmailBanner } from "@/components/layout/verify-email-banner";
import { DemoConversionBar } from "@/components/demo/demo-conversion-bar";
import { DemoFunnelTracker } from "@/components/demo/demo-funnel-tracker";
import { RecoveryReviewBanner } from "@/components/layout/recovery-review-banner";
import { ScribeWidget } from "@/components/layout/scribe-widget";
import { useI18n } from "@/lib/i18n";

// The Cmd+K spotlight (cmdk + search UI) is only needed once the user opens
// it. Code-splitting keeps it out of every dashboard page's initial bundle;
// it renders only while open, so the chunk loads on first open at the latest.
const CommandSearch = dynamic(
  () =>
    import("@/components/common/command-search").then(
      (mod) => mod.CommandSearch,
    ),
  { ssr: false },
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen((prev) => !prev);
    }
    if (e.key === "Escape") {
      setSearchOpen(false);
      setMobileNavOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <TourProvider>
      <OnboardingJourneyProvider>
        <WelcomeProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar className="hidden lg:flex" />
          {mobileNavOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Main navigation"
              className="fixed inset-0 z-50 lg:hidden"
            >
              <button
                type="button"
                aria-label={t("common.closeNavigation", "Zavrieť navigáciu")}
                className="absolute inset-0 bg-black/40"
                onClick={() => setMobileNavOpen(false)}
              />
              <div className="relative flex h-full w-72 max-w-[85vw] bg-surface shadow-xl">
                <Sidebar
                  className="h-full"
                  collapsible={false}
                  onNavigate={() => setMobileNavOpen(false)}
                  width="full"
                />
                <button
                  type="button"
                  aria-label={t("common.closeNavigation", "Zavrieť navigáciu")}
                  className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          <div className="flex min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden">
            <TopBar
              onMenuOpen={() => setMobileNavOpen(true)}
              onSearchOpen={() => setSearchOpen(true)}
            />
            <DemoConversionBar />
            <DemoFunnelTracker />
            <VerifyEmailBanner />
            <RecoveryReviewBanner />
            <main
              id="main-content"
              className="min-w-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto bg-surface p-4 sm:p-6"
            >
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </div>
          {searchOpen ? (
            <CommandSearch
              open={searchOpen}
              onClose={() => setSearchOpen(false)}
            />
          ) : null}
          <ScribeWidget />
        </div>
        </WelcomeProvider>
      </OnboardingJourneyProvider>
      <BrandTheme />
    </TourProvider>
  );
}
