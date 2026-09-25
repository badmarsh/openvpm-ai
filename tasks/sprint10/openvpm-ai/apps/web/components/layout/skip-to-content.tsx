"use client";

import { useI18n } from "@/lib/i18n";

export function SkipToContent() {
  const { t } = useI18n();

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {t("common.skipToMainContent", "Prejsť na hlavný obsah")}
    </a>
  );
}
