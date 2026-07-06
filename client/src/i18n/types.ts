export type Locale = 'pl' | 'en' | 'de';

export type TranslationTree = { [key: string]: string | TranslationTree };

export const LOCALE_STORAGE_KEY = 'cap_locale';

export const LOCALE_META: Record<
  Locale,
  { label: string; flag: string; title: string }
> = {
  pl: { label: 'Polski', flag: '🇵🇱', title: 'Polski' },
  en: { label: 'English', flag: '🇬🇧', title: 'English' },
  de: { label: 'Deutsch', flag: '🇩🇪', title: 'Deutsch' },
};
