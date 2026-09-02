import { id } from "./id";
import { en } from "./en";

export type Language = "id" | "en";

export const translations = { id, en } as const;

export type TranslationKey = keyof typeof id;

export function t(lang: Language, key: TranslationKey): string {
  return translations[lang][key];
}
