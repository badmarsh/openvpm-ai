import sk from "@/messages/sk.json";
import en from "@/messages/en.json";

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

export const translations: Record<Locale, Record<string, any>> = {
  sk,
  en,
};
