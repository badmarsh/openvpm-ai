import sk from "@/messages/sk.json";

export type Locale = "sk" | "en";

export const DEFAULT_LOCALE: Locale = "sk";

export interface LocaleOption {
  code: Locale;
  label: string;
  flag: string;
}

export const LOCALES: LocaleOption[] = [
  { code: "sk", label: "Slovenčina", flag: "🇸🇰" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export type Dictionary = Record<string, any>;

/**
 * Only the default-locale dictionary ships in the initial client bundle.
 * The English dictionary (~290 KB raw) is code-split into its own chunk and
 * fetched on demand via {@link loadDictionary} — EN users and the EN fallback
 * chain get it, everyone else never downloads it.
 *
 * Both JSON files remain the single source of truth; key symmetry between
 * sk.json and en.json is unaffected by how they are loaded.
 */
const dictionaries: Record<Locale, Dictionary | null> = {
  sk: sk as Dictionary,
  en: null,
};

let enLoad: Promise<Dictionary> | null = null;

/** Synchronous read with default-locale fallback (never throws). */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE]!;
}

/**
 * Ensures the dictionary for `locale` is available. Resolves immediately for
 * the default locale; dynamically imports the code-split chunk otherwise.
 * Safe to call repeatedly — the import is cached after the first call.
 */
export function loadDictionary(locale: Locale): Promise<Dictionary> {
  const cached = dictionaries[locale];
  if (cached) return Promise.resolve(cached);
  if (locale === "en") {
    enLoad ??= import("@/messages/en.json").then((mod) => {
      const dict =
        (mod as { default?: Dictionary }).default ??
        (mod as unknown as Dictionary);
      dictionaries.en = dict;
      return dict;
    });
    return enLoad;
  }
  return Promise.resolve(dictionaries[DEFAULT_LOCALE]!);
}
