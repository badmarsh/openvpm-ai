"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  translations,
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  type LocaleOption,
} from "./loader";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (
    key: string,
    fallback?: string,
    params?: Record<string, string | number>
  ) => string;
  locales: LocaleOption[];
}

const I18nContext = createContext<I18nContextType | null>(null);

function getNestedValue(
  obj: Record<string, any>,
  path: string
): string | undefined {
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/{([a-zA-Z0-9_]+)}/g, (match, key) => {
    return key in params ? String(params[key]) : match;
  });
}

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  try {
    // 1. Check NEXT_LOCALE cookie
    const match = document.cookie.match(new RegExp("(^| )NEXT_LOCALE=([^;]+)"));
    if (match && (match[2] === "sk" || match[2] === "en")) {
      return match[2] as Locale;
    }

    // 2. Check localStorage
    const saved = localStorage.getItem("openvpm_locale");
    if (saved === "sk" || saved === "en") {
      return saved as Locale;
    }

    // Default to Slovak unless explicitly chosen otherwise
  } catch {
    // Fall back to default
  }

  return DEFAULT_LOCALE;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    initialLocale ?? DEFAULT_LOCALE
  );

  useEffect(() => {
    const detected = getStoredLocale();
    if (detected !== locale) {
      setLocaleState(detected);
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = detected;
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem("openvpm_locale", newLocale);
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
      if (typeof document !== "undefined") {
        document.documentElement.lang = newLocale;
      }
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (
      key: string,
      fallback?: string,
      params?: Record<string, string | number>
    ): string => {
      // 1. Try active locale dictionary
      let val = getNestedValue(translations[locale] || {}, key);

      // 2. Upstream rule: fallback to English
      if (val === undefined && locale !== "en") {
        val = getNestedValue(translations["en"] || {}, key);
      }

      // 3. Fallback to Slovak if active was English and key was missing
      if (val === undefined && locale !== "sk") {
        val = getNestedValue(translations["sk"] || {}, key);
      }

      // 4. Fallback to provided fallback string, or key itself
      const resolved = val !== undefined ? val : (fallback ?? key);

      return interpolate(resolved, params);
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      locales: LOCALES,
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (
        key: string,
        fallback?: string,
        params?: Record<string, string | number>
      ) => {
        const val =
          getNestedValue(translations[DEFAULT_LOCALE] || {}, key) ??
          fallback ??
          key;
        return interpolate(val, params);
      },
      locales: LOCALES,
    };
  }
  return ctx;
}
